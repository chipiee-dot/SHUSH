/* ============================================================================
   SHUSH - sample data for the faculty console (run AFTER SHUSH.sql)

   Adds 8 tables, 6 sample devices, 12 sample students and about 30 days of
   sample sessions and alerts. Every row is flagged IsSample = 1 so the console
   can label it "Sample data". Remove it from Settings > Sample data once real
   tables and students are in use.

   Does nothing if the library tables already have data.
   ============================================================================ */

USE SHUSH;
GO

IF EXISTS (SELECT 1 FROM dbo.LibraryTable)
BEGIN
    PRINT 'Sample data skipped: LibraryTable already has rows.';
    RETURN;
END

SET NOCOUNT ON;

-- Tables (grid: 12 columns x rows, 0-based). Tables 7 and 8 have no device yet.
INSERT INTO dbo.LibraryTable (TableNo, SeatCount, GridCol, GridRow, GridWidth, GridHeight, IsSample) VALUES
    (1, 4, 0, 0, 2, 2, 1),
    (2, 4, 2, 0, 2, 2, 1),
    (3, 6, 4, 0, 2, 2, 1),
    (4, 2, 6, 0, 2, 2, 1),
    (5, 6, 0, 3, 3, 2, 1),
    (6, 4, 4, 3, 2, 2, 1),
    (7, 4, 7, 3, 2, 2, 1),
    (8, 2, 10, 3, 2, 2, 1);

-- Devices for tables 1-6
INSERT INTO dbo.Device (DeviceCode, TableId, Threshold, LastStatus, LastLevel, LastSeenAt, IsSample)
SELECT v.Code, t.Id, 1600, v.Status, v.Level, SYSUTCDATETIME(), 1
FROM (VALUES
    (N'SHUSH-T01', 1, N'QUIET', 1100),
    (N'SHUSH-T02', 2, N'LOUD',  1450),
    (N'SHUSH-T03', 3, N'ALERT', 1725),
    (N'SHUSH-T04', 4, N'QUIET',  980),
    (N'SHUSH-T05', 5, N'QUIET', 1210),
    (N'SHUSH-T06', 6, N'QUIET', 1005)
) AS v (Code, TableNo, Status, Level)
JOIN dbo.LibraryTable AS t ON t.TableNo = v.TableNo;

-- Students
INSERT INTO dbo.Student (StudentNo, FullName, LastName, FirstName, Section, IsSample)
SELECT CONCAT(N'SAMPLE-', RIGHT(CONCAT(N'0', n), 2)),
       CONCAT(N'Sample, Student ', RIGHT(CONCAT(N'0', n), 2)),
       N'Sample', CONCAT(N'Student ', RIGHT(CONCAT(N'0', n), 2)),
       CASE n % 4 WHEN 0 THEN N'BSIT-3D' WHEN 1 THEN N'BSCS-1D' WHEN 2 THEN N'BSEE-2D' ELSE N'BSIT-1A' END,
       1
FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12)) AS x (n);

-- Sessions over the last 30 days (tables 1-6). One session = one student, so a table-day
-- with several visitors gets several separate sessions (never more than the table has seats).
DECLARE @day INT = 30;
DECLARE @tableNo INT;
DECLARE @tableId INT;
DECLARE @seats INT;
DECLARE @visits INT;
DECLARE @i INT;
DECLARE @start DATETIME2(0);
DECLARE @firstStart DATETIME2(0);
DECLARE @duration INT;
DECLARE @avg INT;
DECLARE @hadAlert BIT;
DECLARE @sessionId BIGINT;
DECLARE @firstSessionId BIGINT;
DECLARE @deviceId INT;
DECLARE @midnight DATETIME2(0);

WHILE @day >= 1
BEGIN
    SET @tableNo = 1;
    WHILE @tableNo <= 6
    BEGIN
        IF (ABS(CHECKSUM(NEWID())) % 3) > 0      -- about two in three table-days have visits
        BEGIN
            SELECT @tableId = t.Id, @seats = t.SeatCount, @deviceId = (SELECT Id FROM dbo.Device WHERE TableId = t.Id)
            FROM dbo.LibraryTable AS t WHERE t.TableNo = @tableNo;

            SET @midnight   = CAST(CAST(DATEADD(DAY, -@day, SYSUTCDATETIME()) AS DATE) AS DATETIME2(0));
            SET @firstStart = DATEADD(MINUTE, ABS(CHECKSUM(NEWID())) % 540, @midnight);   -- 08:00-17:00 local
            SET @visits     = 1 + ABS(CHECKSUM(NEWID())) % (CASE WHEN @seats < 4 THEN @seats ELSE 4 END);
            SET @hadAlert   = CASE WHEN ABS(CHECKSUM(NEWID())) % 4 = 0 THEN 1 ELSE 0 END;
            SET @firstSessionId = NULL;
            SET @i = 1;

            WHILE @i <= @visits
            BEGIN
                SET @start    = DATEADD(MINUTE, (@i - 1) * 5, @firstStart);   -- a few minutes apart
                SET @duration = 15 + ABS(CHECKSUM(NEWID())) % 120;
                SET @avg      = 900 + ABS(CHECKSUM(NEWID())) % 700;

                INSERT INTO dbo.LibrarySession (TableId, StartedAt, EndedAt, AvgLevel, HadAlert, IsSample)
                VALUES (@tableId, @start, DATEADD(MINUTE, @duration, @start), @avg,
                        CASE WHEN @i = 1 THEN @hadAlert ELSE 0 END, 1);
                SET @sessionId = CAST(SCOPE_IDENTITY() AS BIGINT);
                IF @i = 1 SET @firstSessionId = @sessionId;

                -- one distinct student per session at this table on this day
                INSERT INTO dbo.SessionMember (SessionId, StudentId)
                SELECT TOP (1) @sessionId, st.Id
                FROM dbo.Student AS st
                WHERE NOT EXISTS (SELECT 1
                                  FROM dbo.SessionMember AS sm
                                  JOIN dbo.LibrarySession AS ls ON ls.Id = sm.SessionId
                                  WHERE sm.StudentId = st.Id AND ls.TableId = @tableId
                                    AND ls.StartedAt >= @midnight AND ls.StartedAt < DATEADD(DAY, 1, @midnight))
                ORDER BY NEWID();

                SET @i = @i + 1;
            END

            IF @hadAlert = 1
                INSERT INTO dbo.Alert (DeviceId, TableId, SessionId, Level, Threshold, TriggeredAt, IsSample)
                VALUES (@deviceId, @tableId, @firstSessionId, 1650 + ABS(CHECKSUM(NEWID())) % 200, 1600,
                        DATEADD(MINUTE, 10, @firstStart), 1);
        END
        SET @tableNo = @tableNo + 1;
    END

    -- Ambient hourly sensor roll-ups across working hours (08:00-17:00 local = 00:00-09:00 UTC)
    -- including hours where no student session was active.
    DECLARE @hr INT = 0;
    DECLARE @hrUtc DATETIME2(0);
    DECLARE @hrAvg INT;
    DECLARE @hrCount INT;
    SET @tableNo = 1;
    WHILE @tableNo <= 6
    BEGIN
        SELECT @tableId = t.Id, @deviceId = (SELECT Id FROM dbo.Device WHERE TableId = t.Id)
        FROM dbo.LibraryTable AS t WHERE t.TableNo = @tableNo;

        SET @midnight = CAST(CAST(DATEADD(DAY, -@day, SYSUTCDATETIME()) AS DATE) AS DATETIME2(0));
        SET @hr = 0;
        WHILE @hr <= 9
        BEGIN
            SET @hrUtc = DATEADD(HOUR, @hr, @midnight);
            IF NOT EXISTS (SELECT 1 FROM dbo.DeviceHourlyReading WHERE TableId = @tableId AND HourUtc = @hrUtc)
            BEGIN
                SET @hrCount = 12 + ABS(CHECKSUM(NEWID())) % 24;
                -- Quiet morning (08-10 local) vs busier midday/afternoon (13-15 local)
                SET @hrAvg = CASE
                    WHEN @hr IN (0, 1, 9) THEN 880 + ABS(CHECKSUM(NEWID())) % 220
                    WHEN @hr IN (5, 6, 7) THEN 1320 + ABS(CHECKSUM(NEWID())) % 320
                    ELSE 1050 + ABS(CHECKSUM(NEWID())) % 260
                END;
                INSERT INTO dbo.DeviceHourlyReading (TableId, DeviceId, HourUtc, ReadingCount, LevelSum, MinLevel, MaxLevel, IsSample)
                VALUES (@tableId, @deviceId, @hrUtc, @hrCount, CAST(@hrAvg AS BIGINT) * @hrCount, @hrAvg - 80, @hrAvg + 110, 1);
            END
            SET @hr = @hr + 1;
        END
        SET @tableNo = @tableNo + 1;
    END
    SET @day = @day - 1;
END

-- Sessions in progress right now (so the layout shows occupancy): 3 students at table 1,
-- 2 at table 2. Five different students, so nobody has two open sessions.
DECLARE @open TABLE (Seq INT IDENTITY(1,1), StudentId INT);
INSERT INTO @open (StudentId) SELECT TOP (5) Id FROM dbo.Student ORDER BY NEWID();

DECLARE @openSeq INT = 1;
DECLARE @openTable INT;
DECLARE @openTableId INT;
DECLARE @openStudent INT;
DECLARE @openSession BIGINT;

WHILE @openSeq <= 5
BEGIN
    SET @openTable   = CASE WHEN @openSeq <= 3 THEN 1 ELSE 2 END;
    SELECT @openTableId = Id FROM dbo.LibraryTable WHERE TableNo = @openTable;
    SELECT @openStudent = StudentId FROM @open WHERE Seq = @openSeq;

    INSERT INTO dbo.LibrarySession (TableId, StartedAt, EndedAt, AvgLevel, HadAlert, IsSample)
    VALUES (@openTableId, DATEADD(MINUTE, -(30 - @openSeq * 4), SYSUTCDATETIME()), NULL, NULL, 0, 1);
    SET @openSession = CAST(SCOPE_IDENTITY() AS BIGINT);

    INSERT INTO dbo.SessionMember (SessionId, StudentId) VALUES (@openSession, @openStudent);
    SET @openSeq = @openSeq + 1;
END

PRINT 'Sample data loaded.';
GO
