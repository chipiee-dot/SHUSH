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

-- Sessions over the last 30 days (tables 1-6), with members and alerts
DECLARE @day INT = 30;
DECLARE @tableNo INT;
DECLARE @tableId INT;
DECLARE @start DATETIME2(0);
DECLARE @duration INT;
DECLARE @avg INT;
DECLARE @hadAlert BIT;
DECLARE @group INT;
DECLARE @sessionId BIGINT;
DECLARE @deviceId INT;
DECLARE @midnight DATETIME2(0);

WHILE @day >= 1
BEGIN
    SET @tableNo = 1;
    WHILE @tableNo <= 6
    BEGIN
        IF (ABS(CHECKSUM(NEWID())) % 3) > 0      -- about two in three table-days have a visit
        BEGIN
            SELECT @tableId = Id, @deviceId = (SELECT Id FROM dbo.Device WHERE TableId = t.Id)
            FROM dbo.LibraryTable AS t WHERE t.TableNo = @tableNo;

            SET @midnight = CAST(CAST(DATEADD(DAY, -@day, SYSUTCDATETIME()) AS DATE) AS DATETIME2(0));
            SET @start    = DATEADD(MINUTE, ABS(CHECKSUM(NEWID())) % 600, @midnight);   -- 08:00-18:00 local
            SET @duration = 15 + ABS(CHECKSUM(NEWID())) % 120;
            SET @avg      = 900 + ABS(CHECKSUM(NEWID())) % 700;
            SET @hadAlert = CASE WHEN ABS(CHECKSUM(NEWID())) % 4 = 0 THEN 1 ELSE 0 END;
            SET @group    = 1 + ABS(CHECKSUM(NEWID())) % 4;

            INSERT INTO dbo.LibrarySession (TableId, GroupSize, StartedAt, EndedAt, AvgLevel, HadAlert, IsSample)
            VALUES (@tableId, @group, @start, DATEADD(MINUTE, @duration, @start), @avg, @hadAlert, 1);
            SET @sessionId = CAST(SCOPE_IDENTITY() AS BIGINT);

            INSERT INTO dbo.SessionMember (SessionId, StudentId)
            SELECT TOP (@group) @sessionId, Id FROM dbo.Student ORDER BY NEWID();

            IF @hadAlert = 1
                INSERT INTO dbo.Alert (DeviceId, TableId, SessionId, Level, Threshold, TriggeredAt, IsSample)
                VALUES (@deviceId, @tableId, @sessionId, 1650 + ABS(CHECKSUM(NEWID())) % 200, 1600,
                        DATEADD(MINUTE, 10, @start), 1);
        END
        SET @tableNo = @tableNo + 1;
    END
    SET @day = @day - 1;
END

-- Two sessions in progress right now (so the layout shows occupancy)
INSERT INTO dbo.LibrarySession (TableId, GroupSize, StartedAt, EndedAt, AvgLevel, HadAlert, IsSample)
SELECT t.Id, 3, DATEADD(MINUTE, -25, SYSUTCDATETIME()), NULL, NULL, 0, 1
FROM dbo.LibraryTable AS t WHERE t.TableNo = 1;

INSERT INTO dbo.LibrarySession (TableId, GroupSize, StartedAt, EndedAt, AvgLevel, HadAlert, IsSample)
SELECT t.Id, 2, DATEADD(MINUTE, -10, SYSUTCDATETIME()), NULL, NULL, 0, 1
FROM dbo.LibraryTable AS t WHERE t.TableNo = 2;

PRINT 'Sample data loaded.';
GO
