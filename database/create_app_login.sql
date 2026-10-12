/* ============================================================================
   SHUSH — SQL login for the Node server (run AFTER SHUSH.sql)

   The Node server connects with this login using SQL Server Authentication.
   It can only run the two stored procedures - it cannot read or change the
   Faculty table directly.

   1) Change the password below (and use the same one in server/.env).
   2) Run the script in SSMS.
   ============================================================================ */

USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'shush_app')
    CREATE LOGIN shush_app
        WITH PASSWORD = N'ChangeThis!Str0ngPassw0rd',
             CHECK_POLICY = ON,
             DEFAULT_DATABASE = SHUSH;
GO

USE SHUSH;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'shush_app')
    CREATE USER shush_app FOR LOGIN shush_app;
GO

GRANT EXECUTE ON dbo.usp_SignUp TO shush_app;
GRANT EXECUTE ON dbo.usp_Login  TO shush_app;
GO
