import sql from 'mssql';

/**
 * Thin data layer: each function calls one stored procedure from database/SHUSH.sql
 * and returns the single result row it produces.
 */
export function createDb(dbConfig) {
  let poolPromise = null;

  function getPool() {
    if (!poolPromise) {
      const pool = new sql.ConnectionPool(dbConfig);
      // If the connection drops later, forget the pool so the next request reconnects.
      pool.on('error', (err) => {
        console.error('[db] pool error:', err.message);
        poolPromise = null;
      });
      poolPromise = pool.connect().catch((err) => {
        poolPromise = null;
        throw err;
      });
    }
    return poolPromise;
  }

  async function ping() {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
  }

  async function signUp(data) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('FacultyId', sql.NVarChar(30), data.facultyId)
      .input('FirstName', sql.NVarChar(50), data.firstName)
      .input('LastName', sql.NVarChar(50), data.lastName)
      .input('MiddleInitial', sql.NVarChar(2), data.middleInitial || null)
      .input('Email', sql.NVarChar(254), data.email)
      .input('Password', sql.NVarChar(128), data.password)
      .input('ConfirmPassword', sql.NVarChar(128), data.confirmPassword)
      .execute('dbo.usp_SignUp');
    return result.recordset[0];
  }

  async function login(data) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('FacultyId', sql.NVarChar(30), data.facultyId)
      .input('Password', sql.NVarChar(128), data.password)
      .execute('dbo.usp_Login');
    return result.recordset[0];
  }

  return { ping, signUp, login };
}
