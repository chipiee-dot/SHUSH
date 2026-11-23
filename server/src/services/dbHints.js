// Turns a raw SQL Server / mssql error into one plain sentence that says what to check.
// Used by the server start-up check and by `npm run doctor`.
export function explainDbError(err, dbConfig = {}) {
    const text = `${err?.code ?? ''} ${err?.message ?? ''}`;
    const named = dbConfig.options?.instanceName;

    if (/ELOGIN|Login failed/i.test(text)) {
        return 'SQL login failed. Check that DB_USER and DB_PASSWORD in server/.env match database/create_app_login.sql, that you ran that script, and that SQL Server allows "SQL Server and Windows Authentication" (SSMS > server Properties > Security, then restart the SQL Server service).';
    }
    if (/Cannot open database|database .* (does not exist|not exist)/i.test(text)) {
        return 'The SHUSH database was not found. Run database/SHUSH.sql in SSMS first.';
    }
    if (/Could not find stored procedure|Invalid object name|Invalid column name/i.test(text)) {
        return 'Your database is older than the code. Run database/SHUSH.sql and then database/create_app_login.sql again in SSMS.';
    }
    if (/EXECUTE permission was denied/i.test(text)) {
        return 'The shush_app login is missing a permission. Run database/create_app_login.sql again in SSMS.';
    }
    if (/EINSTLOOKUP|Instance .* not found|getaddrinfo|ENOTFOUND/i.test(text)) {
        return named
            ? `The instance "${named}" was not found. Check the name (SQL Server Configuration Manager), make sure the "SQL Server Browser" service is running, or leave DB_INSTANCE empty and set DB_PORT (usually 1433).`
            : 'The SQL Server address was not found. Check DB_SERVER in server/.env.';
    }
    if (/ESOCKET|ETIMEOUT|ECONNREFUSED|timeout|Failed to connect/i.test(text)) {
        return named
            ? `SQL Server did not answer. Check that the service "SQL Server (${named})" is running, that "SQL Server Browser" is running, and that TCP/IP is enabled (SQL Server Configuration Manager). Alternatively set DB_PORT to the instance's TCP port and leave DB_INSTANCE empty.`
            : 'SQL Server did not answer. Check that the SQL Server service is running, that TCP/IP is enabled (SQL Server Configuration Manager) and that DB_PORT (usually 1433) is right.';
    }
    if (/certificate|self.signed|SSL|TLS/i.test(text)) {
        return 'The certificate was rejected. For local SQL Server keep DB_ENCRYPT=true and DB_TRUST_SERVER_CERT=true in server/.env.';
    }
    return 'Check the DB_* settings in server/.env and that SQL Server is running.';
}
