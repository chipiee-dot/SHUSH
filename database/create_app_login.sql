/* ============================================================================
   SHUSH - SQL login for the Node server (run AFTER SHUSH.sql)

   The Node server connects with this login using SQL Server Authentication.
   It can only run stored procedures - it cannot read or change the tables
   directly.

   1) Change the password below (and use the same one in server/.env).
   2) Run the script in SSMS. Re-running it is safe; it only adds grants.
   ============================================================================ */

USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'shush_app')
    CREATE LOGIN shush_app
      WITH PASSWORD = N'QuezonCityU06',
             CHECK_POLICY = ON,
             DEFAULT_DATABASE = SHUSH;
GO

USE SHUSH;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'shush_app')
    CREATE USER shush_app FOR LOGIN shush_app;
GO

-- Sign-up / log-in
GRANT EXECUTE ON dbo.usp_SignUp TO shush_app;
GRANT EXECUTE ON dbo.usp_Login  TO shush_app;
GO

-- Faculty console
GRANT EXECUTE ON dbo.usp_Layout_Get            TO shush_app;
GRANT EXECUTE ON dbo.usp_Dashboard_Summary     TO shush_app;
GRANT EXECUTE ON dbo.usp_Alert_Recent          TO shush_app;
GRANT EXECUTE ON dbo.usp_Maintenance_Active    TO shush_app;
GRANT EXECUTE ON dbo.usp_Maintenance_Start     TO shush_app;
GRANT EXECUTE ON dbo.usp_Maintenance_End       TO shush_app;
GRANT EXECUTE ON dbo.usp_Device_SetThreshold   TO shush_app;
GRANT EXECUTE ON dbo.usp_Rewards_Sessions      TO shush_app;
GRANT EXECUTE ON dbo.usp_History_Get           TO shush_app;
GO

-- Students, sessions and table management
GRANT EXECUTE ON dbo.usp_Student_Register      TO shush_app;
GRANT EXECUTE ON dbo.usp_Student_Find          TO shush_app;
GRANT EXECUTE ON dbo.usp_Student_ActiveSession TO shush_app;
GRANT EXECUTE ON dbo.usp_Session_Start         TO shush_app;
GRANT EXECUTE ON dbo.usp_Session_End           TO shush_app;
GRANT EXECUTE ON dbo.usp_Session_CloseStale    TO shush_app;
GRANT EXECUTE ON dbo.usp_Table_Add             TO shush_app;
GRANT EXECUTE ON dbo.usp_Table_SetSeats        TO shush_app;
GRANT EXECUTE ON dbo.usp_SampleData_Clear      TO shush_app;
GO


ALTER LOGIN shush_app WITH PASSWORD = N'QuezonCityU06';