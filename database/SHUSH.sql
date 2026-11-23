/* ============================================================================
   SHUSH - database (SQL Server / SSMS, T-SQL)
   Covers: Sign Up + Log In, and the faculty console (dashboard, table layout,
   rewards, history, maintenance, device settings).

   Run this whole script in SSMS (New Query -> Execute / F5).
   Safe to run again on an existing SHUSH database: every step checks first.
   Requires SQL Server 2016 SP1 or newer (uses CREATE OR ALTER).
   ============================================================================ */

-- Same session options in SSMS and sqlcmd, so stored procedures behave the same on every machine.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 1) DATABASE -----------------------------------------------------------------
IF DB_ID(N'SHUSH') IS NULL
    CREATE DATABASE SHUSH;
GO

USE SHUSH;
GO

-- 2) FACULTY TABLE ------------------------------------------------------------
IF OBJECT_ID(N'dbo.Faculty', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Faculty
    (
        Id              INT IDENTITY(1,1)  NOT NULL CONSTRAINT PK_Faculty PRIMARY KEY,
        FacultyId       NVARCHAR(30)       NOT NULL,   -- e.g. FAC-2024-8901
        FirstName       NVARCHAR(50)       NOT NULL,
        LastName        NVARCHAR(50)       NOT NULL,
        MiddleInitial   NVARCHAR(2)        NULL,
        Email           NVARCHAR(254)      NOT NULL,
        PasswordHash    VARBINARY(64)      NOT NULL,   -- SHA2-512 of (password + salt)
        PasswordSalt    UNIQUEIDENTIFIER   NOT NULL,   -- random per user
        IsActive        BIT                NOT NULL CONSTRAINT DF_Faculty_IsActive DEFAULT (1),
        CreatedAt       DATETIME2(0)       NOT NULL CONSTRAINT DF_Faculty_CreatedAt DEFAULT (SYSUTCDATETIME()),
        LastLoginAt     DATETIME2(0)       NULL,

        CONSTRAINT UQ_Faculty_FacultyId UNIQUE (FacultyId),
        CONSTRAINT UQ_Faculty_Email     UNIQUE (Email)
    );
END
GO

-- 2b) Faculty have one role, so the old Role column (Faculty / Admin) is removed.
-- Existing databases only: its own batch, because SQL Server checks a whole batch before
-- running it. Safe to run any number of times.
IF COL_LENGTH(N'dbo.Faculty', N'Role') IS NOT NULL
BEGIN
    DECLARE @drop NVARCHAR(MAX) = N'';
    DECLARE @colId INT = COLUMNPROPERTY(OBJECT_ID(N'dbo.Faculty'), N'Role', 'ColumnId');
    SELECT @drop += N'ALTER TABLE dbo.Faculty DROP CONSTRAINT ' + QUOTENAME(name) + N'; '
    FROM sys.check_constraints
    -- CK_Faculty_Role was added with ALTER TABLE, so SQL Server lists it as a table-level check
    -- (parent_column_id = 0); match it by its text as well.
    WHERE parent_object_id = OBJECT_ID(N'dbo.Faculty')
      AND (parent_column_id = @colId OR definition LIKE N'%[[]Role]%');
    SELECT @drop += N'ALTER TABLE dbo.Faculty DROP CONSTRAINT ' + QUOTENAME(name) + N'; '
    FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.Faculty') AND parent_column_id = @colId;
    SET @drop += N'ALTER TABLE dbo.Faculty DROP COLUMN Role;';
    EXEC sys.sp_executesql @drop;
END
GO

-- 3) SIGN UP ------------------------------------------------------------------
-- Returns one row: Success (1/0), Message
CREATE OR ALTER PROCEDURE dbo.usp_SignUp
    @FacultyId       NVARCHAR(30),
    @FirstName       NVARCHAR(50),
    @LastName        NVARCHAR(50),
    @MiddleInitial   NVARCHAR(2) = NULL,
    @Email           NVARCHAR(254),
    @Password        NVARCHAR(128),
    @ConfirmPassword NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;

    -- Clean up inputs
    SET @FacultyId     = UPPER(LTRIM(RTRIM(@FacultyId)));
    SET @FirstName     = LTRIM(RTRIM(@FirstName));
    SET @LastName      = LTRIM(RTRIM(@LastName));
    SET @MiddleInitial = NULLIF(UPPER(LTRIM(RTRIM(@MiddleInitial))), N'');
    SET @Email         = LOWER(LTRIM(RTRIM(@Email)));

    -- Validation
    IF ISNULL(@FacultyId, N'') = N'' OR ISNULL(@FirstName, N'') = N''
       OR ISNULL(@LastName, N'') = N'' OR ISNULL(@Email, N'') = N''
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Please fill in all required fields.' AS Message;
        RETURN;
    END

    IF @Email NOT LIKE N'_%@_%._%' OR @Email LIKE N'% %'
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Please enter a valid email address.' AS Message;
        RETURN;
    END

    IF LEN(ISNULL(@Password, N'')) < 8
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Password must be at least 8 characters.' AS Message;
        RETURN;
    END

    IF @Password <> @ConfirmPassword
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Passwords do not match.' AS Message;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.Faculty WHERE FacultyId = @FacultyId)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'That Faculty ID is already registered.' AS Message;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.Faculty WHERE Email = @Email)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'That email address is already registered.' AS Message;
        RETURN;
    END

    -- Salt + hash the password (the plain password is never stored)
    DECLARE @Salt UNIQUEIDENTIFIER = NEWID();
    DECLARE @Hash VARBINARY(64) =
        HASHBYTES('SHA2_512', @Password + CAST(@Salt AS NVARCHAR(36)));

    BEGIN TRY
        INSERT INTO dbo.Faculty
            (FacultyId, FirstName, LastName, MiddleInitial, Email, PasswordHash, PasswordSalt)
        VALUES
            (@FacultyId, @FirstName, @LastName, @MiddleInitial, @Email, @Hash, @Salt);

        SELECT CAST(1 AS BIT) AS Success, N'Account created successfully.' AS Message;
    END TRY
    BEGIN CATCH
        -- 2627 / 2601 = unique constraint violation (e.g. two sign-ups at the same instant)
        IF ERROR_NUMBER() IN (2627, 2601)
            SELECT CAST(0 AS BIT) AS Success, N'Faculty ID or email is already registered.' AS Message;
        ELSE
            SELECT CAST(0 AS BIT) AS Success, N'Something went wrong. Please try again.' AS Message;
    END CATCH
END
GO

-- 4) LOG IN -------------------------------------------------------------------
-- Returns one row: Success (1/0), Message, plus user details when successful
CREATE OR ALTER PROCEDURE dbo.usp_Login
    @FacultyId NVARCHAR(30),
    @Password  NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;

    SET @FacultyId = UPPER(LTRIM(RTRIM(@FacultyId)));

    DECLARE @Id INT, @Salt UNIQUEIDENTIFIER, @StoredHash VARBINARY(64), @IsActive BIT;

    SELECT @Id = Id, @Salt = PasswordSalt, @StoredHash = PasswordHash, @IsActive = IsActive
    FROM dbo.Faculty
    WHERE FacultyId = @FacultyId;

    -- Same message for "no such user" and "wrong password" so IDs can't be guessed
    IF @Id IS NULL
       OR @StoredHash <> HASHBYTES('SHA2_512', @Password + CAST(@Salt AS NVARCHAR(36)))
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Invalid Faculty ID or password.' AS Message,
               CAST(NULL AS INT) AS Id, CAST(NULL AS NVARCHAR(30)) AS FacultyId,
               CAST(NULL AS NVARCHAR(50)) AS FirstName, CAST(NULL AS NVARCHAR(50)) AS LastName,
               CAST(NULL AS NVARCHAR(254)) AS Email;
        RETURN;
    END

    IF @IsActive = 0
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'This account has been deactivated.' AS Message,
               CAST(NULL AS INT) AS Id, CAST(NULL AS NVARCHAR(30)) AS FacultyId,
               CAST(NULL AS NVARCHAR(50)) AS FirstName, CAST(NULL AS NVARCHAR(50)) AS LastName,
               CAST(NULL AS NVARCHAR(254)) AS Email;
        RETURN;
    END

    UPDATE dbo.Faculty SET LastLoginAt = SYSUTCDATETIME() WHERE Id = @Id;

    SELECT CAST(1 AS BIT) AS Success, N'Login successful.' AS Message,
           Id, FacultyId, FirstName, LastName, Email
    FROM dbo.Faculty
    WHERE Id = @Id;
END
GO

/* ============================================================================
   FACULTY CONSOLE - reference data
   Times are stored in UTC. The server works out "today", "this week" and
   "this month" in the library's time zone and passes them in.
   ============================================================================ */

-- 5) LIBRARY TABLES (seats + floor-plan position) -----------------------------
IF OBJECT_ID(N'dbo.LibraryTable', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LibraryTable
    (
        Id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryTable PRIMARY KEY,
        TableNo     INT               NOT NULL CONSTRAINT UQ_LibraryTable_No UNIQUE,
        SeatCount   TINYINT           NOT NULL CONSTRAINT CK_LibraryTable_Seats CHECK (SeatCount BETWEEN 1 AND 20),
        GridCol     TINYINT           NOT NULL,    -- floor plan: column (0 = left)
        GridRow     TINYINT           NOT NULL,    -- floor plan: row (0 = top)
        GridWidth   TINYINT           NOT NULL CONSTRAINT DF_LibraryTable_W DEFAULT (2),
        GridHeight  TINYINT           NOT NULL CONSTRAINT DF_LibraryTable_H DEFAULT (2),
        IsActive    BIT               NOT NULL CONSTRAINT DF_LibraryTable_Active DEFAULT (1)
    );
END
GO

IF COL_LENGTH(N'dbo.LibraryTable', N'IsSample') IS NULL
    ALTER TABLE dbo.LibraryTable ADD IsSample BIT NOT NULL CONSTRAINT DF_LibraryTable_Sample DEFAULT (0);
GO

-- 6) DEVICES (one ESP32 per table; thresholds live here) ----------------------
IF OBJECT_ID(N'dbo.Device', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Device
    (
        Id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Device PRIMARY KEY,
        DeviceCode  NVARCHAR(20)      NOT NULL CONSTRAINT UQ_Device_Code UNIQUE,   -- e.g. SHUSH-T03
        TableId     INT               NOT NULL CONSTRAINT UQ_Device_Table UNIQUE
                                      CONSTRAINT FK_Device_Table REFERENCES dbo.LibraryTable (Id),
        Threshold   INT               NOT NULL CONSTRAINT DF_Device_Threshold DEFAULT (1600)
                                      CONSTRAINT CK_Device_Threshold CHECK (Threshold BETWEEN 0 AND 4095),
        LastStatus  NVARCHAR(12)      NULL
                                      CONSTRAINT CK_Device_Status CHECK (LastStatus IN (N'QUIET', N'LOUD', N'ALERT', N'MAINTENANCE')),
        LastLevel   INT               NULL,
        LastSeenAt  DATETIME2(0)      NULL,
        IsSample    BIT               NOT NULL CONSTRAINT DF_Device_Sample DEFAULT (0)
    );
END
GO

IF COL_LENGTH(N'dbo.Device', N'LoudSince') IS NULL
    ALTER TABLE dbo.Device ADD LoudSince DATETIME2(0) NULL;
GO

-- 6b) HOURLY ROLLED-UP SENSOR READINGS (ambient + occupied noise per table/hour)
IF OBJECT_ID(N'dbo.DeviceHourlyReading', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DeviceHourlyReading
    (
        TableId      INT          NOT NULL CONSTRAINT FK_DeviceHourlyReading_Table REFERENCES dbo.LibraryTable (Id),
        DeviceId     INT          NOT NULL CONSTRAINT FK_DeviceHourlyReading_Device REFERENCES dbo.Device (Id),
        HourUtc      DATETIME2(0) NOT NULL,
        ReadingCount INT          NOT NULL,
        LevelSum     BIGINT       NOT NULL,
        MinLevel     INT          NOT NULL,
        MaxLevel     INT          NOT NULL,
        IsSample     BIT          NOT NULL CONSTRAINT DF_DeviceHourlyReading_Sample DEFAULT (0),
        CONSTRAINT PK_DeviceHourlyReading PRIMARY KEY (TableId, HourUtc)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DeviceHourlyReading_HourUtc')
    CREATE INDEX IX_DeviceHourlyReading_HourUtc ON dbo.DeviceHourlyReading (HourUtc);
GO

-- 6c) LIBRARY SETTINGS (single-row configuration) -------------------------
IF OBJECT_ID(N'dbo.LibrarySetting', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LibrarySetting
    (
        Id              INT          NOT NULL CONSTRAINT PK_LibrarySetting PRIMARY KEY CONSTRAINT CK_LibrarySetting_Singleton CHECK (Id = 1),
        WorkStartHour   TINYINT      NOT NULL CONSTRAINT DF_LibrarySetting_WorkStart DEFAULT (8)  CONSTRAINT CK_LibrarySetting_Start CHECK (WorkStartHour BETWEEN 0 AND 22),
        WorkEndHour     TINYINT      NOT NULL CONSTRAINT DF_LibrarySetting_WorkEnd   DEFAULT (17) CONSTRAINT CK_LibrarySetting_End   CHECK (WorkEndHour BETWEEN 1 AND 23),
        ExcludeWeekends BIT          NOT NULL CONSTRAINT DF_LibrarySetting_Weekends  DEFAULT (0),
        UpdatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_LibrarySetting_Updated   DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_LibrarySetting_Range CHECK (WorkEndHour > WorkStartHour)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LibrarySetting WHERE Id = 1)
    INSERT INTO dbo.LibrarySetting (Id, WorkStartHour, WorkEndHour, ExcludeWeekends) VALUES (1, 8, 17, 0);
GO

-- 7) STUDENTS (only what rewards need; the student side will extend this) -----
IF OBJECT_ID(N'dbo.Student', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Student
    (
        Id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Student PRIMARY KEY,
        StudentNo   NVARCHAR(30)      NOT NULL CONSTRAINT UQ_Student_No UNIQUE,
        FullName    NVARCHAR(100)     NOT NULL,
        IsSample    BIT               NOT NULL CONSTRAINT DF_Student_Sample DEFAULT (0)
    );
END
GO

-- 7b) STUDENT DETAILS: separate name fields, section (e.g. BSIT-3D) -----------
IF COL_LENGTH(N'dbo.Student', N'FirstName') IS NULL
    ALTER TABLE dbo.Student ADD FirstName NVARCHAR(50) NULL;
GO
IF COL_LENGTH(N'dbo.Student', N'LastName') IS NULL
    ALTER TABLE dbo.Student ADD LastName NVARCHAR(50) NULL;
GO
IF COL_LENGTH(N'dbo.Student', N'MiddleInitial') IS NULL
    ALTER TABLE dbo.Student ADD MiddleInitial NVARCHAR(2) NULL;
GO
IF COL_LENGTH(N'dbo.Student', N'Section') IS NULL
    ALTER TABLE dbo.Student ADD Section NVARCHAR(20) NULL;
GO
IF COL_LENGTH(N'dbo.Student', N'RegisteredAt') IS NULL
    ALTER TABLE dbo.Student ADD RegisteredAt DATETIME2(0) NULL;
GO

-- 8) SESSIONS (one per table visit) -------------------------------------------
-- AvgLevel is the table's average raw noise level during the session; it is the
-- "table noise" used for Quietest Visitor. EndedAt IS NULL = session in progress.
IF OBJECT_ID(N'dbo.LibrarySession', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LibrarySession
    (
        Id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibrarySession PRIMARY KEY,
        TableId     INT                  NOT NULL CONSTRAINT FK_LibrarySession_Table REFERENCES dbo.LibraryTable (Id),
        StartedAt   DATETIME2(0)         NOT NULL,
        EndedAt     DATETIME2(0)         NULL,
        AvgLevel    INT                  NULL,
        HadAlert    BIT                  NOT NULL CONSTRAINT DF_LibrarySession_Alert DEFAULT (0),
        IsSample    BIT                  NOT NULL CONSTRAINT DF_LibrarySession_Sample DEFAULT (0),
        CONSTRAINT CK_LibrarySession_Times CHECK (EndedAt IS NULL OR EndedAt >= StartedAt)
    );
END
GO

-- 8b) Existing databases: a session is one student, so it no longer stores a group size.
-- Its own batch: SQL Server checks a whole batch before running it, so a statement that
-- names a column dropped in the same batch could fail. Safe to run any number of times.
IF COL_LENGTH(N'dbo.LibrarySession', N'GroupSize') IS NOT NULL
BEGIN
    DECLARE @drop NVARCHAR(MAX) = N'';
    DECLARE @colId INT = COLUMNPROPERTY(OBJECT_ID(N'dbo.LibrarySession'), N'GroupSize', 'ColumnId');
    SELECT @drop += N'ALTER TABLE dbo.LibrarySession DROP CONSTRAINT ' + QUOTENAME(name) + N'; '
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.LibrarySession') AND parent_column_id = @colId;
    SELECT @drop += N'ALTER TABLE dbo.LibrarySession DROP CONSTRAINT ' + QUOTENAME(name) + N'; '
    FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.LibrarySession') AND parent_column_id = @colId;
    SET @drop += N'ALTER TABLE dbo.LibrarySession DROP COLUMN GroupSize;';
    EXEC sys.sp_executesql @drop;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LibrarySession_Table_Started')
    CREATE INDEX IX_LibrarySession_Table_Started ON dbo.LibrarySession (TableId, StartedAt);
GO

-- Open sessions (EndedAt IS NULL) are looked up on every page load: seats, stale-session cleanup.
-- A plain index (not a filtered one), so it works no matter how the script is run.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LibrarySession_Open')
    CREATE INDEX IX_LibrarySession_Open ON dbo.LibrarySession (EndedAt, StartedAt) INCLUDE (TableId);
GO

-- 9) SESSION MEMBERS (each member receives the session's table score) ---------
IF OBJECT_ID(N'dbo.SessionMember', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SessionMember
    (
        SessionId   BIGINT NOT NULL CONSTRAINT FK_SessionMember_Session REFERENCES dbo.LibrarySession (Id),
        StudentId   INT    NOT NULL CONSTRAINT FK_SessionMember_Student REFERENCES dbo.Student (Id),
        CONSTRAINT PK_SessionMember PRIMARY KEY (SessionId, StudentId)
    );
END
GO

-- "Which sessions did this student have?" (active session, history, rewards).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SessionMember_Student')
    CREATE INDEX IX_SessionMember_Student ON dbo.SessionMember (StudentId, SessionId);
GO

-- 10) ALERTS (noise above threshold for 5 continuous seconds) -----------------
IF OBJECT_ID(N'dbo.Alert', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Alert
    (
        Id           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Alert PRIMARY KEY,
        DeviceId     INT                  NOT NULL CONSTRAINT FK_Alert_Device REFERENCES dbo.Device (Id),
        TableId      INT                  NOT NULL CONSTRAINT FK_Alert_Table REFERENCES dbo.LibraryTable (Id),
        SessionId    BIGINT               NULL     CONSTRAINT FK_Alert_Session REFERENCES dbo.LibrarySession (Id),
        Level        INT                  NOT NULL,
        Threshold    INT                  NOT NULL,
        TriggeredAt  DATETIME2(0)         NOT NULL,
        IsSample     BIT                  NOT NULL CONSTRAINT DF_Alert_Sample DEFAULT (0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Alert_TriggeredAt')
    CREATE INDEX IX_Alert_TriggeredAt ON dbo.Alert (TriggeredAt);
GO

-- 11) MAINTENANCE WINDOWS (suspend alerts for one table or all tables) --------
-- TableId NULL = all tables. EndedEarlyAt is set when staff end it before EndsAt.
IF OBJECT_ID(N'dbo.MaintenanceWindow', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MaintenanceWindow
    (
        Id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MaintenanceWindow PRIMARY KEY,
        TableId       INT               NULL CONSTRAINT FK_Maintenance_Table REFERENCES dbo.LibraryTable (Id),
        Reason        NVARCHAR(200)     NOT NULL,
        StartsAt      DATETIME2(0)      NOT NULL,
        EndsAt        DATETIME2(0)      NOT NULL,
        EndedEarlyAt  DATETIME2(0)      NULL,
        CreatedBy     NVARCHAR(30)      NOT NULL,   -- faculty ID
        CreatedAt     DATETIME2(0)      NOT NULL CONSTRAINT DF_Maintenance_Created DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_Maintenance_Times CHECK (EndsAt > StartsAt)
    );
END
GO

/* ============================================================================
   FACULTY CONSOLE - stored procedures
   The Node server can only run procedures (see create_app_login.sql), so every
   query the console needs lives here.
   ============================================================================ */

-- 12) LAYOUT: every table with its device, seats taken and any session in progress
CREATE OR ALTER PROCEDURE dbo.usp_Layout_Get
AS
BEGIN
    SET NOCOUNT ON;

    SELECT t.TableNo, t.SeatCount, t.GridCol, t.GridRow, t.GridWidth, t.GridHeight,
           t.IsSample AS TableIsSample,
           d.DeviceCode, d.Threshold, d.LastStatus, d.LastLevel, d.LastSeenAt, d.IsSample,
           s.Id AS SessionId, s.StartedAt AS SessionStartedAt,
           occ.Occupied
    FROM dbo.LibraryTable AS t
    LEFT JOIN dbo.Device AS d ON d.TableId = t.Id
    OUTER APPLY
    (
        SELECT TOP (1) ls.Id, ls.StartedAt
        FROM dbo.LibrarySession AS ls
        WHERE ls.TableId = t.Id AND ls.EndedAt IS NULL
        ORDER BY ls.StartedAt DESC
    ) AS s
    OUTER APPLY
    (
        SELECT COUNT(*) AS Occupied
        FROM dbo.LibrarySession AS ls2
        WHERE ls2.TableId = t.Id AND ls2.EndedAt IS NULL
    ) AS occ
    WHERE t.IsActive = 1
    ORDER BY t.TableNo;
END
GO

-- 13) DASHBOARD COUNTS since the start of the library day ---------------------
CREATE OR ALTER PROCEDURE dbo.usp_Dashboard_Summary
    @DayStart DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        (SELECT COUNT(*) FROM dbo.LibrarySession WHERE StartedAt >= @DayStart) AS SessionsToday,
        (SELECT COUNT(DISTINCT sm.StudentId)
           FROM dbo.SessionMember AS sm
           JOIN dbo.LibrarySession AS s ON s.Id = sm.SessionId
          WHERE s.StartedAt >= @DayStart)                                       AS StudentsToday,
        (SELECT COUNT(*) FROM dbo.Alert WHERE TriggeredAt >= @DayStart)         AS AlertsToday;
END
GO

-- 14) RECENT ALERTS -----------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.usp_Alert_Recent
    @Since DATETIME2(0),
    @Top   INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@Top)
           CAST(a.Id AS BIGINT) AS Id, t.TableNo, d.DeviceCode,
           a.Level, a.Threshold, a.TriggeredAt, a.IsSample
    FROM dbo.Alert AS a
    JOIN dbo.LibraryTable AS t ON t.Id = a.TableId
    JOIN dbo.Device AS d       ON d.Id = a.DeviceId
    WHERE a.TriggeredAt >= @Since
    ORDER BY a.TriggeredAt DESC, a.Id DESC;
END
GO

-- 15) MAINTENANCE: windows in effect at @Now ----------------------------------
CREATE OR ALTER PROCEDURE dbo.usp_Maintenance_Active
    @Now DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT m.Id,
           t.TableNo,
           CAST(CASE WHEN m.TableId IS NULL THEN 1 ELSE 0 END AS BIT) AS AllTables,
           m.Reason, m.StartsAt, m.EndsAt, m.CreatedBy
    FROM dbo.MaintenanceWindow AS m
    LEFT JOIN dbo.LibraryTable AS t ON t.Id = m.TableId
    WHERE m.EndedEarlyAt IS NULL
      AND m.StartsAt <= @Now
      AND m.EndsAt > @Now
    ORDER BY m.EndsAt, m.Id;
END
GO

-- 16) MAINTENANCE: start a window (@TableNo NULL = all tables) ---------------
-- Returns: Success, Message, Id
CREATE OR ALTER PROCEDURE dbo.usp_Maintenance_Start
    @TableNo   INT = NULL,
    @Reason    NVARCHAR(200),
    @StartsAt  DATETIME2(0),
    @EndsAt    DATETIME2(0),
    @CreatedBy NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TableId INT = NULL;

    IF @TableNo IS NOT NULL
    BEGIN
        SELECT @TableId = Id FROM dbo.LibraryTable WHERE TableNo = @TableNo AND IsActive = 1;
        IF @TableId IS NULL
        BEGIN
            SELECT CAST(0 AS BIT) AS Success, N'That table does not exist.' AS Message, CAST(NULL AS INT) AS Id;
            RETURN;
        END
    END

    IF @EndsAt <= @StartsAt
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'The end time must be after the start time.' AS Message, CAST(NULL AS INT) AS Id;
        RETURN;
    END

    INSERT INTO dbo.MaintenanceWindow (TableId, Reason, StartsAt, EndsAt, CreatedBy)
    VALUES (@TableId, @Reason, @StartsAt, @EndsAt, @CreatedBy);

    SELECT CAST(1 AS BIT) AS Success, N'Maintenance started.' AS Message, CAST(SCOPE_IDENTITY() AS INT) AS Id;
END
GO

-- 17) MAINTENANCE: end a window early -----------------------------------------
-- Returns: Success, Message
CREATE OR ALTER PROCEDURE dbo.usp_Maintenance_End
    @Id  INT,
    @Now DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.MaintenanceWindow
       SET EndedEarlyAt = @Now
     WHERE Id = @Id
       AND EndedEarlyAt IS NULL
       AND StartsAt <= @Now
       AND EndsAt > @Now;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS BIT) AS Success, N'That maintenance period is not active.' AS Message;
    ELSE
        SELECT CAST(1 AS BIT) AS Success, N'Maintenance ended.' AS Message;
END
GO

-- 18) DEVICE SETTINGS: change a device's threshold ----------------------------
-- Returns: Success, Message
CREATE OR ALTER PROCEDURE dbo.usp_Device_SetThreshold
    @DeviceCode NVARCHAR(20),
    @Threshold  INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @Threshold IS NULL OR @Threshold < 0 OR @Threshold > 4095
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Threshold must be a whole number from 0 to 4095.' AS Message;
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Device WHERE DeviceCode = @DeviceCode)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'That device does not exist.' AS Message;
        RETURN;
    END

    UPDATE dbo.Device SET Threshold = @Threshold WHERE DeviceCode = @DeviceCode;

    SELECT CAST(1 AS BIT) AS Success, N'Threshold saved.' AS Message;
END
GO

-- 18a) DEVICE SETTINGS: connect a device to a table (or change the table's device code)
-- A table has at most one device and a device belongs to one table. If the table already has a device,
-- its code is changed and the old readings are cleared (alerts already recorded are kept).
-- Returns: Success, Message
CREATE OR ALTER PROCEDURE dbo.usp_Device_Assign
    @TableNo    INT,
    @DeviceCode NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    SET @DeviceCode = LTRIM(RTRIM(@DeviceCode));
    IF @DeviceCode IS NULL OR LEN(@DeviceCode) < 1 OR LEN(@DeviceCode) > 20
       OR @DeviceCode LIKE N'%[^A-Za-z0-9-]%'
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Device code must be 1 to 20 letters, numbers or dashes.' AS Message; RETURN;
    END

    DECLARE @TableId INT;
    SELECT @TableId = Id FROM dbo.LibraryTable WHERE TableNo = @TableNo AND IsActive = 1;
    IF @TableId IS NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'That table does not exist.' AS Message; RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.Device WHERE DeviceCode = @DeviceCode AND TableId <> @TableId)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, CONCAT(N'Device ', @DeviceCode, N' is already connected to another table.') AS Message; RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.Device WHERE TableId = @TableId)
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.Device WHERE TableId = @TableId AND DeviceCode = @DeviceCode)
        BEGIN
            SELECT CAST(1 AS BIT) AS Success, CONCAT(N'Device ', @DeviceCode, N' is already connected to Table ', @TableNo, N'.') AS Message; RETURN;
        END
        UPDATE dbo.Device
           SET DeviceCode = @DeviceCode, LastLevel = NULL, LastStatus = NULL, LastSeenAt = NULL, IsSample = 0
         WHERE TableId = @TableId;
    END
    ELSE
        INSERT INTO dbo.Device (DeviceCode, TableId, IsSample) VALUES (@DeviceCode, @TableId, 0);

    SELECT CAST(1 AS BIT) AS Success, CONCAT(N'Device ', @DeviceCode, N' is now connected to Table ', @TableNo, N'.') AS Message;
END
GO

-- 18b) HARDWARE HOOK: one noise reading from a device -------------------------
-- Called by POST /api/device/readings (server/src/routes/device.js).
-- Records hourly ambient roll-ups (even when no student session is active),
-- updates open sessions' running average, updates device status and raises
-- an alert once noise stays above Threshold for 5 continuous seconds.
-- Returns: Success, Message, Threshold, Status
CREATE OR ALTER PROCEDURE dbo.usp_Device_Reading
    @DeviceCode NVARCHAR(20),
    @Level      INT,
    @ReceivedAt DATETIME2(0)   -- UTC
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @DeviceId INT, @TableId INT, @Threshold INT, @LoudSince DATETIME2(0);
    DECLARE @Status NVARCHAR(12), @HourUtc DATETIME2(0), @OpenSessionId BIGINT;

    SELECT @DeviceId = Id, @TableId = TableId, @Threshold = Threshold, @LoudSince = LoudSince
    FROM dbo.Device
    WHERE DeviceCode = @DeviceCode;

    IF @DeviceId IS NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success,
               N'That device does not exist.' AS Message,
               CAST(NULL AS INT) AS Threshold,
               CAST(NULL AS NVARCHAR(12)) AS Status;
        RETURN;
    END

    SET @HourUtc = DATEADD(HOUR, DATEDIFF(HOUR, 0, @ReceivedAt), 0);

    BEGIN TRANSACTION;

    UPDATE dbo.DeviceHourlyReading
       SET DeviceId     = @DeviceId,
           ReadingCount = ReadingCount + 1,
           LevelSum     = LevelSum + @Level,
           MinLevel     = CASE WHEN @Level < MinLevel THEN @Level ELSE MinLevel END,
           MaxLevel     = CASE WHEN @Level > MaxLevel THEN @Level ELSE MaxLevel END,
           IsSample     = 0
     WHERE TableId = @TableId AND HourUtc = @HourUtc;

    IF @@ROWCOUNT = 0
        INSERT INTO dbo.DeviceHourlyReading (TableId, DeviceId, HourUtc, ReadingCount, LevelSum, MinLevel, MaxLevel, IsSample)
        VALUES (@TableId, @DeviceId, @HourUtc, 1, @Level, @Level, @Level, 0);

    UPDATE dbo.LibrarySession
       SET AvgLevel = CASE WHEN AvgLevel IS NULL THEN @Level ELSE (AvgLevel + @Level) / 2 END
     WHERE TableId = @TableId AND EndedAt IS NULL;

    IF @Level > @Threshold
    BEGIN
        IF @LoudSince IS NULL
        BEGIN
            SET @LoudSince = @ReceivedAt;
            SET @Status = N'LOUD';
        END
        ELSE IF DATEDIFF(SECOND, @LoudSince, @ReceivedAt) >= 5
        BEGIN
            SET @Status = N'ALERT';
            IF NOT EXISTS (SELECT 1 FROM dbo.Alert WHERE DeviceId = @DeviceId AND TriggeredAt > DATEADD(SECOND, -5, @ReceivedAt))
            BEGIN
                SELECT TOP (1) @OpenSessionId = Id
                FROM dbo.LibrarySession
                WHERE TableId = @TableId AND EndedAt IS NULL
                ORDER BY StartedAt DESC;

                INSERT INTO dbo.Alert (DeviceId, TableId, SessionId, Level, Threshold, TriggeredAt, IsSample)
                VALUES (@DeviceId, @TableId, @OpenSessionId, @Level, @Threshold, @ReceivedAt, 0);
            END
            UPDATE dbo.LibrarySession
               SET HadAlert = 1
             WHERE TableId = @TableId AND EndedAt IS NULL;
        END
        ELSE
            SET @Status = N'LOUD';
    END
    ELSE
    BEGIN
        SET @LoudSince = NULL;
        SET @Status = CASE WHEN @Level >= (@Threshold * 85) / 100 THEN N'LOUD' ELSE N'QUIET' END;
    END

    UPDATE dbo.Device
       SET LastLevel = @Level,
           LastStatus = @Status,
           LastSeenAt = @ReceivedAt,
           LoudSince = @LoudSince,
           IsSample = 0
     WHERE Id = @DeviceId;

    COMMIT;

    SELECT CAST(1 AS BIT) AS Success,
           N'Reading recorded.' AS Message,
           @Threshold AS Threshold,
           @Status AS Status;
END
GO

-- 18c) WORKING-HOURS ANALYTICS: hourly rolled-up sensor readings --------------
CREATE OR ALTER PROCEDURE dbo.usp_Noise_HourlyReadings
    @From    DATETIME2(0),
    @To      DATETIME2(0),
    @TableNo INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT hr.HourUtc,
           t.TableNo,
           CAST(ROUND(hr.LevelSum * 1.0 / NULLIF(hr.ReadingCount, 0), 0) AS INT) AS AvgLevel,
           hr.MinLevel,
           hr.MaxLevel,
           hr.ReadingCount,
           hr.IsSample
    FROM dbo.DeviceHourlyReading AS hr
    JOIN dbo.LibraryTable AS t ON t.Id = hr.TableId
    WHERE hr.HourUtc >= @From
      AND hr.HourUtc < @To
      AND (@TableNo IS NULL OR t.TableNo = @TableNo)
    ORDER BY hr.HourUtc, t.TableNo;
END
GO

-- 18d) SETTINGS: get and save working hours -----------------------------------
CREATE OR ALTER PROCEDURE dbo.usp_Settings_WorkingHours_Get
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (1)
           CAST(WorkStartHour AS INT) AS StartHour,
           CAST(WorkEndHour AS INT)   AS EndHour,
           ExcludeWeekends
    FROM dbo.LibrarySetting
    WHERE Id = 1;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Settings_WorkingHours_Set
    @StartHour       INT,
    @EndHour         INT,
    @ExcludeWeekends BIT
AS
BEGIN
    SET NOCOUNT ON;

    IF @StartHour IS NULL OR @EndHour IS NULL OR @StartHour < 0 OR @StartHour > 22
       OR @EndHour < 1 OR @EndHour > 23 OR @EndHour <= @StartHour
    BEGIN
        SELECT CAST(0 AS BIT) AS Success,
               N'Opening hour must be earlier than closing hour (0 to 23).' AS Message,
               CAST(NULL AS INT) AS StartHour,
               CAST(NULL AS INT) AS EndHour,
               CAST(NULL AS BIT) AS ExcludeWeekends;
        RETURN;
    END

    UPDATE dbo.LibrarySetting
       SET WorkStartHour   = @StartHour,
           WorkEndHour     = @EndHour,
           ExcludeWeekends = ISNULL(@ExcludeWeekends, 0),
           UpdatedAt       = SYSUTCDATETIME()
     WHERE Id = 1;

    IF @@ROWCOUNT = 0
        INSERT INTO dbo.LibrarySetting (Id, WorkStartHour, WorkEndHour, ExcludeWeekends)
        VALUES (1, @StartHour, @EndHour, ISNULL(@ExcludeWeekends, 0));

    SELECT CAST(1 AS BIT) AS Success,
           N'Working hours saved.' AS Message,
           CAST(@StartHour AS INT) AS StartHour,
           CAST(@EndHour AS INT) AS EndHour,
           CAST(ISNULL(@ExcludeWeekends, 0) AS BIT) AS ExcludeWeekends;
END
GO

-- 19) REWARDS: completed sessions with each member, all time ------------------
-- The server works out the leaderboards from these rows (server/src/services/rewards.js).
CREATE OR ALTER PROCEDURE dbo.usp_Rewards_Sessions
AS
BEGIN
    SET NOCOUNT ON;

    SELECT st.Id AS StudentId, st.FullName, st.Section,
           s.Id AS SessionId, t.TableNo,
           s.StartedAt, s.EndedAt, s.AvgLevel, s.HadAlert,
           CAST(CASE WHEN s.IsSample = 1 OR st.IsSample = 1 THEN 1 ELSE 0 END AS BIT) AS IsSample
    FROM dbo.SessionMember AS sm
    JOIN dbo.LibrarySession AS s ON s.Id = sm.SessionId
    JOIN dbo.Student        AS st ON st.Id = sm.StudentId
    JOIN dbo.LibraryTable   AS t  ON t.Id = s.TableId
    WHERE s.EndedAt IS NOT NULL
    ORDER BY st.Id, s.StartedAt;
END
GO

-- 20) HISTORY: alerts, maintenance and sessions in one timeline ---------------
-- @Kind: NULL (all), 'alert', 'maintenance' or 'session'. @TableNo: NULL = all tables.
-- A table filter also includes maintenance that covers all tables.
CREATE OR ALTER PROCEDURE dbo.usp_History_Get
    @From    DATETIME2(0),
    @To      DATETIME2(0),
    @Kind    NVARCHAR(12) = NULL,
    @TableNo INT          = NULL,
    @Top     INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TableId INT = NULL;
    IF @TableNo IS NOT NULL
        SELECT @TableId = Id FROM dbo.LibraryTable WHERE TableNo = @TableNo;

    ;WITH Events AS
    (
        SELECT N'alert' AS Kind,
               a.TriggeredAt AS OccurredAt,
               t.TableNo,
               CAST(N'Noise above threshold' AS NVARCHAR(200)) AS Summary,
               CAST(CONCAT(N'Level ', a.Level, N' (threshold ', a.Threshold, N') on ', d.DeviceCode) AS NVARCHAR(400)) AS Detail,
               a.IsSample
        FROM dbo.Alert AS a
        JOIN dbo.LibraryTable AS t ON t.Id = a.TableId
        JOIN dbo.Device AS d       ON d.Id = a.DeviceId
        WHERE (@Kind IS NULL OR @Kind = N'alert')
          AND (@TableId IS NULL OR a.TableId = @TableId)

        UNION ALL

        SELECT N'maintenance',
               m.StartsAt,
               t.TableNo,
               CAST(CASE WHEN m.TableId IS NULL
                         THEN N'Maintenance: all tables'
                         ELSE CONCAT(N'Maintenance: table ', t.TableNo) END AS NVARCHAR(200)),
               CAST(CONCAT(m.Reason, N' (by ', m.CreatedBy, N')') AS NVARCHAR(400)),
               CAST(0 AS BIT)
        FROM dbo.MaintenanceWindow AS m
        LEFT JOIN dbo.LibraryTable AS t ON t.Id = m.TableId
        WHERE (@Kind IS NULL OR @Kind = N'maintenance')
          AND (@TableId IS NULL OR m.TableId IS NULL OR m.TableId = @TableId)

        UNION ALL

        SELECT N'session',
               s.StartedAt,
               t.TableNo,
               CAST(N'Student session' AS NVARCHAR(200)),
               CAST(CASE WHEN s.EndedAt IS NULL
                         THEN N'In progress'
                         ELSE CONCAT(N'Average level ', s.AvgLevel, N' over ',
                                     DATEDIFF(MINUTE, s.StartedAt, s.EndedAt), N' min') END AS NVARCHAR(400)),
               s.IsSample
        FROM dbo.LibrarySession AS s
        JOIN dbo.LibraryTable AS t ON t.Id = s.TableId
        WHERE (@Kind IS NULL OR @Kind = N'session')
          AND (@TableId IS NULL OR s.TableId = @TableId)
    )
    SELECT TOP (@Top) Kind, OccurredAt, TableNo, Summary, Detail, IsSample
    FROM Events
    WHERE OccurredAt >= @From AND OccurredAt < @To
    ORDER BY OccurredAt DESC;
END
GO

/* ============================================================================
   STUDENTS, SESSIONS AND TABLE MANAGEMENT
   ============================================================================ */

-- 21) STUDENT SIGN UP ---------------------------------------------------------
-- Student number: XX-XXXX (e.g. 21-0001). Section: BSIT-3D, BSCS-1D, BSEE-2D ...
-- Returns: Success, Message
CREATE OR ALTER PROCEDURE dbo.usp_Student_Register
    @StudentNo     NVARCHAR(30),
    @LastName      NVARCHAR(50),
    @FirstName     NVARCHAR(50),
    @MiddleInitial NVARCHAR(2) = NULL,
    @Section       NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    SET @StudentNo     = LTRIM(RTRIM(@StudentNo));
    SET @LastName      = LTRIM(RTRIM(@LastName));
    SET @FirstName     = LTRIM(RTRIM(@FirstName));
    SET @MiddleInitial = NULLIF(UPPER(LTRIM(RTRIM(@MiddleInitial))), N'');
    SET @Section       = UPPER(LTRIM(RTRIM(@Section)));

    IF @StudentNo NOT LIKE N'[0-9][0-9]-[0-9][0-9][0-9][0-9]'
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Student number must look like 21-0001.' AS Message;
        RETURN;
    END

    IF ISNULL(@LastName, N'') = N'' OR ISNULL(@FirstName, N'') = N''
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Please enter your first and last name.' AS Message;
        RETURN;
    END

    IF @Section NOT LIKE N'BS[A-Z][A-Z]%-[1-6][A-Z]'
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Section must look like BSIT-3D.' AS Message;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.Student WHERE StudentNo = @StudentNo)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'That student number is already registered.' AS Message;
        RETURN;
    END

    INSERT INTO dbo.Student (StudentNo, FullName, FirstName, LastName, MiddleInitial, Section, RegisteredAt)
    VALUES (@StudentNo,
            CONCAT(@LastName, N', ', @FirstName,
                   CASE WHEN @MiddleInitial IS NULL THEN N'' ELSE CONCAT(N' ', @MiddleInitial, N'.') END),
            @FirstName, @LastName, @MiddleInitial, @Section, SYSUTCDATETIME());

    SELECT CAST(1 AS BIT) AS Success, N'Account created successfully.' AS Message;
END
GO

-- 22) STUDENT LOOKUP (login step 1) -------------------------------------------
CREATE OR ALTER PROCEDURE dbo.usp_Student_Find
    @StudentNo NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (1) Id, StudentNo, FirstName, LastName, MiddleInitial, Section, FullName
    FROM dbo.Student
    WHERE StudentNo = LTRIM(RTRIM(@StudentNo));
END
GO

-- 23) STUDENT'S OPEN SESSION (if any) -----------------------------------------
CREATE OR ALTER PROCEDURE dbo.usp_Student_ActiveSession
    @StudentId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (1) s.Id AS SessionId, t.TableNo, s.StartedAt
    FROM dbo.SessionMember AS sm
    JOIN dbo.LibrarySession AS s ON s.Id = sm.SessionId
    JOIN dbo.LibraryTable   AS t ON t.Id = s.TableId
    WHERE sm.StudentId = @StudentId AND s.EndedAt IS NULL
    ORDER BY s.StartedAt DESC;
END
GO

-- 24) START A SESSION (choose table, confirm) ---------------------------------
-- Checks the student is free, the table exists, is not under maintenance, and has
-- a free seat (one student takes one seat). Runs in one transaction with a row lock on the table.
-- Returns: Success, Message, SessionId
CREATE OR ALTER PROCEDURE dbo.usp_Session_Start
    @StudentId INT,
    @TableNo   INT,
    @Now       DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @TableId INT, @Seats INT, @Occupied INT, @SessionId BIGINT;

    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM dbo.SessionMember AS sm
               JOIN dbo.LibrarySession AS s ON s.Id = sm.SessionId
               WHERE sm.StudentId = @StudentId AND s.EndedAt IS NULL)
    BEGIN
        ROLLBACK;
        SELECT CAST(0 AS BIT) AS Success, N'You already have a table. End your current session first.' AS Message,
               CAST(NULL AS BIGINT) AS SessionId;
        RETURN;
    END

    SELECT @TableId = t.Id, @Seats = t.SeatCount
    FROM dbo.LibraryTable AS t WITH (UPDLOCK, HOLDLOCK)
    WHERE t.TableNo = @TableNo AND t.IsActive = 1;

    IF @TableId IS NULL
    BEGIN
        ROLLBACK;
        SELECT CAST(0 AS BIT) AS Success, N'That table does not exist.' AS Message, CAST(NULL AS BIGINT) AS SessionId;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.MaintenanceWindow
               WHERE EndedEarlyAt IS NULL AND StartsAt <= @Now AND EndsAt > @Now
                 AND (TableId IS NULL OR TableId = @TableId))
    BEGIN
        ROLLBACK;
        SELECT CAST(0 AS BIT) AS Success, N'That table is under maintenance right now.' AS Message,
               CAST(NULL AS BIGINT) AS SessionId;
        RETURN;
    END

    SELECT @Occupied = COUNT(*)
    FROM dbo.LibrarySession
    WHERE TableId = @TableId AND EndedAt IS NULL;

    IF @Occupied >= @Seats
    BEGIN
        ROLLBACK;
        SELECT CAST(0 AS BIT) AS Success,
               CONCAT(N'Table ', @TableNo, N' is full.') AS Message,
               CAST(NULL AS BIGINT) AS SessionId;
        RETURN;
    END

    INSERT INTO dbo.LibrarySession (TableId, StartedAt, IsSample)
    VALUES (@TableId, @Now, 0);
    SET @SessionId = CAST(SCOPE_IDENTITY() AS BIGINT);

    INSERT INTO dbo.SessionMember (SessionId, StudentId) VALUES (@SessionId, @StudentId);

    COMMIT;

    SELECT CAST(1 AS BIT) AS Success, N'Session started.' AS Message, @SessionId AS SessionId;
END
GO

-- 25) END A SESSION (student leaves the table) --------------------------------
-- Returns: Success, Message
CREATE OR ALTER PROCEDURE dbo.usp_Session_End
    @StudentId INT,
    @Now       DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE s
       SET s.EndedAt = @Now
    FROM dbo.LibrarySession AS s
    WHERE s.EndedAt IS NULL
      AND EXISTS (SELECT 1 FROM dbo.SessionMember AS sm WHERE sm.SessionId = s.Id AND sm.StudentId = @StudentId);

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS BIT) AS Success, N'You do not have a table in use.' AS Message;
    ELSE
        SELECT CAST(1 AS BIT) AS Success, N'Session ended.' AS Message;
END
GO

-- 26) CLOSE SESSIONS LEFT OPEN -------------------------------------------------
-- A session can run for at most @MaxHours; longer ones are closed at that limit.
CREATE OR ALTER PROCEDURE dbo.usp_Session_CloseStale
    @Now      DATETIME2(0),
    @MaxHours INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.LibrarySession
       SET EndedAt = DATEADD(HOUR, @MaxHours, StartedAt)
     WHERE EndedAt IS NULL
       AND StartedAt <= DATEADD(HOUR, -@MaxHours, @Now);   -- same rule, written so the index can be used
END
GO

-- 27) TABLES: add a table ------------------------------------------------------
-- Returns: Success, Message
CREATE OR ALTER PROCEDURE dbo.usp_Table_Add
    @TableNo   INT,
    @SeatCount INT,
    @GridCol   INT,
    @GridRow   INT,
    @GridWidth INT,
    @GridHeight INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @TableNo IS NULL OR @TableNo < 1 OR @TableNo > 999
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Table number must be between 1 and 999.' AS Message; RETURN;
    END
    IF @SeatCount IS NULL OR @SeatCount < 1 OR @SeatCount > 20
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Seats must be between 1 and 20.' AS Message; RETURN;
    END
    IF @GridCol < 0 OR @GridCol > 11 OR @GridRow < 0 OR @GridRow > 99
       OR @GridWidth < 1 OR @GridWidth > 12 OR @GridHeight < 1 OR @GridHeight > 12
       OR @GridCol + @GridWidth > 12
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'That spot on the floor plan is outside the grid.' AS Message; RETURN;
    END
    IF EXISTS (SELECT 1 FROM dbo.LibraryTable WHERE TableNo = @TableNo)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, CONCAT(N'Table ', @TableNo, N' already exists.') AS Message; RETURN;
    END
    IF EXISTS (SELECT 1 FROM dbo.LibraryTable
               WHERE IsActive = 1
                 AND GridCol < @GridCol + @GridWidth AND GridCol + GridWidth > @GridCol
                 AND GridRow < @GridRow + @GridHeight AND GridRow + GridHeight > @GridRow)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'That spot on the floor plan is already taken.' AS Message; RETURN;
    END

    INSERT INTO dbo.LibraryTable (TableNo, SeatCount, GridCol, GridRow, GridWidth, GridHeight, IsActive, IsSample)
    VALUES (@TableNo, @SeatCount, @GridCol, @GridRow, @GridWidth, @GridHeight, 1, 0);

    SELECT CAST(1 AS BIT) AS Success, CONCAT(N'Table ', @TableNo, N' added.') AS Message;
END
GO

-- 28) TABLES: change seat count ------------------------------------------------
-- Cannot go below the number of people seated right now.
-- Returns: Success, Message
CREATE OR ALTER PROCEDURE dbo.usp_Table_SetSeats
    @TableNo   INT,
    @SeatCount INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @SeatCount IS NULL OR @SeatCount < 1 OR @SeatCount > 20
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Seats must be between 1 and 20.' AS Message; RETURN;
    END

    DECLARE @TableId INT, @Occupied INT;
    SELECT @TableId = Id FROM dbo.LibraryTable WHERE TableNo = @TableNo AND IsActive = 1;
    IF @TableId IS NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'That table does not exist.' AS Message; RETURN;
    END

    SELECT @Occupied = COUNT(*)
    FROM dbo.LibrarySession WHERE TableId = @TableId AND EndedAt IS NULL;

    IF @SeatCount < @Occupied
    BEGIN
        SELECT CAST(0 AS BIT) AS Success,
               CONCAT(N'Table ', @TableNo, N' has ', @Occupied, N' students seated, so it cannot have fewer than ', @Occupied, N' seats.') AS Message;
        RETURN;
    END

    UPDATE dbo.LibraryTable SET SeatCount = @SeatCount WHERE Id = @TableId;

    SELECT CAST(1 AS BIT) AS Success, CONCAT(N'Table ', @TableNo, N' now has ', @SeatCount, N' seats.') AS Message;
END
GO

-- 28b) TABLES: change the table number and/or the seat count in one step ------
-- @NewTableNo NULL = keep the number. @SeatCount NULL = keep the seats.
-- The number must be free, and seats cannot go below the number of people seated right now.
-- Sessions, devices and maintenance point at the table's Id, so renumbering keeps all of them.
-- Returns: Success, Message
CREATE OR ALTER PROCEDURE dbo.usp_Table_Update
    @TableNo    INT,
    @NewTableNo INT = NULL,
    @SeatCount  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @NewTableNo IS NOT NULL AND (@NewTableNo < 1 OR @NewTableNo > 999)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Table number must be between 1 and 999.' AS Message; RETURN;
    END
    IF @SeatCount IS NOT NULL AND (@SeatCount < 1 OR @SeatCount > 20)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Seats must be between 1 and 20.' AS Message; RETURN;
    END

    DECLARE @TableId INT, @Occupied INT;
    SELECT @TableId = Id FROM dbo.LibraryTable WHERE TableNo = @TableNo AND IsActive = 1;
    IF @TableId IS NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'That table does not exist.' AS Message; RETURN;
    END

    IF @NewTableNo IS NOT NULL AND @NewTableNo <> @TableNo
       AND EXISTS (SELECT 1 FROM dbo.LibraryTable WHERE TableNo = @NewTableNo)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, CONCAT(N'Table ', @NewTableNo, N' already exists.') AS Message; RETURN;
    END

    IF @SeatCount IS NOT NULL
    BEGIN
        SELECT @Occupied = COUNT(*) FROM dbo.LibrarySession WHERE TableId = @TableId AND EndedAt IS NULL;
        IF @SeatCount < @Occupied
        BEGIN
            SELECT CAST(0 AS BIT) AS Success,
                   CONCAT(N'Table ', @TableNo, N' has ', @Occupied, N' students seated, so it cannot have fewer than ', @Occupied, N' seats.') AS Message;
            RETURN;
        END
    END

    UPDATE dbo.LibraryTable
       SET TableNo   = COALESCE(@NewTableNo, TableNo),
           SeatCount = COALESCE(@SeatCount, SeatCount)
     WHERE Id = @TableId;

    SELECT CAST(1 AS BIT) AS Success,
           CONCAT(N'Table ', @TableNo,
                  CASE WHEN @NewTableNo IS NOT NULL AND @NewTableNo <> @TableNo
                       THEN CONCAT(N' is now Table ', @NewTableNo) ELSE N'' END,
                  CASE WHEN @SeatCount IS NOT NULL
                       THEN CONCAT(CASE WHEN @NewTableNo IS NOT NULL AND @NewTableNo <> @TableNo THEN N', ' ELSE N' ' END,
                                   N'has ', @SeatCount, N' seats')
                       ELSE N'' END,
                  N'.') AS Message;
END
GO

-- 28c) TABLES: delete a table ---------------------------------------------------
-- Permanently removes the table, its device and everything recorded for it (sessions, alerts,
-- hourly readings, maintenance windows). A table with students seated right now is refused.
-- All or nothing. The row lock is the same one usp_Session_Start takes, so nobody can sit down mid-delete.
-- Returns: Success, Message
CREATE OR ALTER PROCEDURE dbo.usp_Table_Delete
    @TableNo INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    DECLARE @TableId INT, @Occupied INT;
    SELECT @TableId = t.Id
    FROM dbo.LibraryTable AS t WITH (UPDLOCK, HOLDLOCK)
    WHERE t.TableNo = @TableNo AND t.IsActive = 1;

    IF @TableId IS NULL
    BEGIN
        ROLLBACK;
        SELECT CAST(0 AS BIT) AS Success, N'That table does not exist.' AS Message; RETURN;
    END

    SELECT @Occupied = COUNT(*) FROM dbo.LibrarySession WHERE TableId = @TableId AND EndedAt IS NULL;
    IF @Occupied > 0
    BEGIN
        ROLLBACK;
        SELECT CAST(0 AS BIT) AS Success,
               CONCAT(N'Table ', @TableNo, N' has ', @Occupied, N' ', CASE WHEN @Occupied = 1 THEN N'student' ELSE N'students' END,
                      N' seated. End their sessions first, then delete the table.') AS Message;
        RETURN;
    END

    DELETE FROM dbo.Alert
    WHERE TableId = @TableId OR DeviceId IN (SELECT Id FROM dbo.Device WHERE TableId = @TableId);

    DELETE FROM dbo.DeviceHourlyReading
    WHERE TableId = @TableId OR DeviceId IN (SELECT Id FROM dbo.Device WHERE TableId = @TableId);

    DELETE sm
    FROM dbo.SessionMember AS sm
    JOIN dbo.LibrarySession AS s ON s.Id = sm.SessionId
    WHERE s.TableId = @TableId;

    DELETE FROM dbo.LibrarySession WHERE TableId = @TableId;
    DELETE FROM dbo.MaintenanceWindow WHERE TableId = @TableId;   -- windows for ALL tables (TableId NULL) stay
    DELETE FROM dbo.Device WHERE TableId = @TableId;
    DELETE FROM dbo.LibraryTable WHERE Id = @TableId;

    COMMIT;

    SELECT CAST(1 AS BIT) AS Success, CONCAT(N'Table ', @TableNo, N' deleted.') AS Message;
END
GO

-- 29) SAMPLE DATA: remove everything flagged IsSample --------------------------
-- Real students, sessions and tables are never touched.
CREATE OR ALTER PROCEDURE dbo.usp_SampleData_Clear
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    DELETE sm
    FROM dbo.SessionMember AS sm
    JOIN dbo.LibrarySession AS s ON s.Id = sm.SessionId
    WHERE s.IsSample = 1;

    DELETE FROM dbo.DeviceHourlyReading WHERE IsSample = 1;
    DELETE FROM dbo.Alert WHERE IsSample = 1;
    DELETE FROM dbo.LibrarySession WHERE IsSample = 1;
    DELETE FROM dbo.Student
    WHERE IsSample = 1 AND NOT EXISTS (SELECT 1 FROM dbo.SessionMember AS sm WHERE sm.StudentId = Student.Id);
    DELETE FROM dbo.Device
    WHERE IsSample = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.Alert AS a WHERE a.DeviceId = Device.Id)
      AND NOT EXISTS (SELECT 1 FROM dbo.DeviceHourlyReading AS hr WHERE hr.DeviceId = Device.Id);
    DELETE FROM dbo.LibraryTable
    WHERE IsSample = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.Device AS d WHERE d.TableId = LibraryTable.Id)
      AND NOT EXISTS (SELECT 1 FROM dbo.LibrarySession AS s WHERE s.TableId = LibraryTable.Id)
      AND NOT EXISTS (SELECT 1 FROM dbo.Alert AS a WHERE a.TableId = LibraryTable.Id)
      AND NOT EXISTS (SELECT 1 FROM dbo.MaintenanceWindow AS m WHERE m.TableId = LibraryTable.Id)
      AND NOT EXISTS (SELECT 1 FROM dbo.DeviceHourlyReading AS hr WHERE hr.TableId = LibraryTable.Id);

    COMMIT;

    SELECT CAST(1 AS BIT) AS Success, N'Sample data removed. Real records were kept.' AS Message;
END
GO

-- 30) LAYOUT: save moved / resized tables in one step ---------------------------
-- @Json is an array of { tableNo, col, row, width, height, seats } (changed tables only; seats optional).
-- All or nothing: if anything is wrong, nothing is saved. The overlap check looks at the FINAL layout
-- (every active table with the changes applied), so two tables can swap places in one save.
-- Needs SQL Server 2016+ and database compatibility level 130+ (OPENJSON).
-- Returns: Success, Message
CREATE OR ALTER PROCEDURE dbo.usp_Layout_Save
    @Json NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Json IS NULL OR ISJSON(@Json) <> 1 OR LEFT(LTRIM(@Json), 1) <> N'['
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'The layout data is not valid.' AS Message; RETURN;
    END

    CREATE TABLE #Change
    (
        TableNo INT NULL,
        Col     INT NULL,
        [Row]   INT NULL,
        Width   INT NULL,
        Height  INT NULL,
        Seats   INT NULL
    );

    INSERT INTO #Change (TableNo, Col, [Row], Width, Height, Seats)
    SELECT TableNo, Col, [Row], Width, Height, Seats
    FROM OPENJSON(@Json)
    WITH (
        TableNo INT '$.tableNo',
        Col     INT '$.col',
        [Row]   INT '$.row',
        Width   INT '$.width',
        Height  INT '$.height',
        Seats   INT '$.seats'
    );

    IF NOT EXISTS (SELECT 1 FROM #Change)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'There are no changes to save.' AS Message; RETURN;
    END

    IF EXISTS (SELECT 1 FROM #Change WHERE TableNo IS NULL)
       OR EXISTS (SELECT 1 FROM #Change GROUP BY TableNo HAVING COUNT(*) > 1)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Each table can appear only once in a layout.' AS Message; RETURN;
    END

    -- 1) every table exists and is active
    DECLARE @MissingNo INT;
    SELECT TOP (1) @MissingNo = c.TableNo
    FROM #Change AS c
    WHERE NOT EXISTS (SELECT 1 FROM dbo.LibraryTable AS t WHERE t.TableNo = c.TableNo AND t.IsActive = 1)
    ORDER BY c.TableNo;
    IF @MissingNo IS NOT NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, CONCAT(N'Table ', @MissingNo, N' does not exist.') AS Message; RETURN;
    END

    -- 2) inside the 12-column grid
    DECLARE @BadNo INT;
    SELECT TOP (1) @BadNo = TableNo
    FROM #Change
    WHERE Col IS NULL OR [Row] IS NULL OR Width IS NULL OR Height IS NULL
       OR Col < 0 OR [Row] < 0
       OR Width < 1 OR Width > 12 OR Height < 1 OR Height > 12
       OR Col + Width > 12 OR [Row] + Height > 100
    ORDER BY TableNo;
    IF @BadNo IS NOT NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, CONCAT(N'Table ', @BadNo, N' would be outside the floor plan grid.') AS Message; RETURN;
    END

    -- 2b) every table is exactly 2 rows tall (only the width can change)
    SET @BadNo = NULL;
    SELECT TOP (1) @BadNo = TableNo FROM #Change WHERE Height <> 2 ORDER BY TableNo;
    IF @BadNo IS NOT NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, CONCAT(N'Table ', @BadNo, N' must be 2 rows tall. Only the width can change.') AS Message; RETURN;
    END

    -- 3) seats: 1-20, and not below the students seated right now
    SET @BadNo = NULL;
    SELECT TOP (1) @BadNo = TableNo FROM #Change WHERE Seats IS NOT NULL AND (Seats < 1 OR Seats > 20) ORDER BY TableNo;
    IF @BadNo IS NOT NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Seats must be between 1 and 20.' AS Message; RETURN;
    END

    DECLARE @SeatedNo INT, @Seated INT;
    SELECT TOP (1) @SeatedNo = c.TableNo, @Seated = o.Occupied
    FROM #Change AS c
    JOIN dbo.LibraryTable AS t ON t.TableNo = c.TableNo AND t.IsActive = 1
    CROSS APPLY
    (
        SELECT COUNT(*) AS Occupied FROM dbo.LibrarySession AS s WHERE s.TableId = t.Id AND s.EndedAt IS NULL
    ) AS o
    WHERE c.Seats IS NOT NULL AND c.Seats < o.Occupied
    ORDER BY c.TableNo;
    IF @SeatedNo IS NOT NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success,
               CONCAT(N'Table ', @SeatedNo, N' has ', @Seated, N' students seated, so it cannot have fewer than ', @Seated, N' seats.') AS Message;
        RETURN;
    END

    -- 4) no overlaps in the final layout
    SELECT t.TableNo,
           COALESCE(c.Col, t.GridCol)    AS Col,
           COALESCE(c.[Row], t.GridRow)  AS [Row],
           COALESCE(c.Width, t.GridWidth)   AS Width,
           COALESCE(c.Height, t.GridHeight) AS Height
    INTO #Final
    FROM dbo.LibraryTable AS t
    LEFT JOIN #Change AS c ON c.TableNo = t.TableNo
    WHERE t.IsActive = 1;

    DECLARE @NoA INT, @NoB INT;
    SELECT TOP (1) @NoA = a.TableNo, @NoB = b.TableNo
    FROM #Final AS a
    JOIN #Final AS b
      ON a.TableNo < b.TableNo
     AND a.Col < b.Col + b.Width AND a.Col + a.Width > b.Col
     AND a.[Row] < b.[Row] + b.Height AND a.[Row] + a.Height > b.[Row]
    ORDER BY a.TableNo, b.TableNo;
    IF @NoA IS NOT NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success,
               CONCAT(N'Table ', @NoA, N' and Table ', @NoB, N' would overlap: that spot on the floor plan is already taken.') AS Message;
        RETURN;
    END

    DECLARE @Updated INT;
    BEGIN TRANSACTION;

    UPDATE t
       SET GridCol = c.Col, GridRow = c.[Row], GridWidth = c.Width, GridHeight = c.Height,
           SeatCount = COALESCE(c.Seats, t.SeatCount)
    FROM dbo.LibraryTable AS t
    JOIN #Change AS c ON c.TableNo = t.TableNo
    WHERE t.IsActive = 1;

    SET @Updated = @@ROWCOUNT;
    COMMIT;

    SELECT CAST(1 AS BIT) AS Success, CONCAT(N'Layout saved. ', @Updated, N' table(s) updated.') AS Message;
END
GO

-- 31) FACULTY CONSOLE: students, active sessions and recent visits -----------
CREATE OR ALTER PROCEDURE dbo.usp_Faculty_Students_Overview
AS
BEGIN
    SET NOCOUNT ON;

    SELECT s.Id AS SessionId,
           st.Id AS StudentId,
           st.StudentNo,
           st.FullName,
           st.FirstName,
           st.LastName,
           st.MiddleInitial,
           st.Section,
           t.TableNo,
           s.StartedAt,
           s.EndedAt,
           s.AvgLevel,
           s.HadAlert,
           CAST(CASE WHEN s.IsSample = 1 OR st.IsSample = 1 THEN 1 ELSE 0 END AS BIT) AS IsSample
    FROM dbo.SessionMember AS sm
    JOIN dbo.LibrarySession AS s  ON s.Id = sm.SessionId
    JOIN dbo.Student        AS st ON st.Id = sm.StudentId
    JOIN dbo.LibraryTable   AS t  ON t.Id = s.TableId
    ORDER BY CASE WHEN s.EndedAt IS NULL THEN 0 ELSE 1 END, s.StartedAt DESC, s.Id DESC;

    SELECT st.Id AS StudentId,
           st.StudentNo,
           st.FullName,
           st.FirstName,
           st.LastName,
           st.MiddleInitial,
           st.Section,
           st.RegisteredAt,
           st.IsSample
    FROM dbo.Student AS st
    ORDER BY st.FullName, st.Id;
END
GO

-- 99) SCHEMA VERSION ------------------------------------------------------------
-- The server compares this number with the one it was written for and says clearly
-- when a teammate's database is out of date. Raise it (here AND in server/src/server.js
-- and server/scripts/doctor.js) whenever you change tables or procedures.
CREATE OR ALTER PROCEDURE dbo.usp_Schema_Version
AS
BEGIN
    SET NOCOUNT ON;
    SELECT CAST(2 AS INT) AS SchemaVersion;
END
GO
