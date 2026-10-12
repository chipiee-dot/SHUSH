/* ============================================================================
   SHUSH — Authentication database (SQL Server / SSMS, T-SQL)
   Covers: Sign Up + Log In

   Run this whole script once in SSMS (New Query -> Execute / F5).
   Requires SQL Server 2016 SP1 or newer (uses CREATE OR ALTER).
   ============================================================================ */

-- 1) DATABASE -----------------------------------------------------------------
IF DB_ID(N'SHUSH') IS NULL
    CREATE DATABASE SHUSH;
GO

USE SHUSH;
GO

-- 2) TABLE --------------------------------------------------------------------
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

-- 5) QUICK TEST (optional — select the lines and run) -------------------------
/*
EXEC dbo.usp_SignUp
     @FacultyId = N'FAC-2024-8901', @FirstName = N'Jane', @LastName = N'Doe',
     @MiddleInitial = N'M', @Email = N'janedoe@gmail.com',
     @Password = N'MySecret123', @ConfirmPassword = N'MySecret123';

EXEC dbo.usp_Login @FacultyId = N'FAC-2024-8901', @Password = N'MySecret123';   -- Success = 1
EXEC dbo.usp_Login @FacultyId = N'FAC-2024-8901', @Password = N'wrong-password'; -- Success = 0

SELECT * FROM dbo.Faculty;   -- PasswordHash is binary; the plain password is not stored
*/