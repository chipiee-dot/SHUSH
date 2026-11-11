import sql from 'mssql';

// Turns SQL Server's PascalCase column names into camelCase for the API.
const camelize = (row) =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key[0].toLowerCase() + key.slice(1), value]));

/**
 * Thin data layer: each function calls one stored procedure from database/SHUSH.sql.
 * Procedures that return several result sets are read with recordsets[n].
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

  // Runs one procedure. inputs: [name, sqlType, value] triples.
  async function run(procedure, inputs = []) {
    const pool = await getPool();
    const request = pool.request();
    for (const [name, type, value] of inputs) {
      request.input(name, type, value ?? null);
    }
    const result = await request.execute(`dbo.${procedure}`);
    return result.recordsets;
  }

  const rowsOf = (sets, index = 0) => (sets[index] ?? []).map(camelize);
  const oneOf = (sets, index = 0) => rowsOf(sets, index)[0] ?? null;

  async function ping() {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
  }

  // ---- Sign up / log in (raw PascalCase rows, read by routes/auth.js) -------

  async function signUp(data) {
    const sets = await run('usp_SignUp', [
      ['FacultyId', sql.NVarChar(30), data.facultyId],
      ['FirstName', sql.NVarChar(50), data.firstName],
      ['LastName', sql.NVarChar(50), data.lastName],
      ['MiddleInitial', sql.NVarChar(2), data.middleInitial || null],
      ['Email', sql.NVarChar(254), data.email],
      ['Password', sql.NVarChar(128), data.password],
      ['ConfirmPassword', sql.NVarChar(128), data.confirmPassword],
    ]);
    return sets[0]?.[0];
  }

  async function login(data) {
    const sets = await run('usp_Login', [
      ['FacultyId', sql.NVarChar(30), data.facultyId],
      ['Password', sql.NVarChar(128), data.password],
    ]);
    return sets[0]?.[0];
  }

  // ---- Faculty console -------------------------------------------------------

  async function getLayout() {
    return rowsOf(await run('usp_Layout_Get'));
  }

  async function getDashboardSummary(dayStart) {
    return oneOf(await run('usp_Dashboard_Summary', [['DayStart', sql.DateTime2(0), dayStart]]));
  }

  async function getRecentAlerts(since, top) {
    return rowsOf(
      await run('usp_Alert_Recent', [
        ['Since', sql.DateTime2(0), since],
        ['Top', sql.Int, top],
      ])
    );
  }

  async function getActiveMaintenance(now) {
    return rowsOf(await run('usp_Maintenance_Active', [['Now', sql.DateTime2(0), now]]));
  }

  async function startMaintenance({ tableNo, reason, startsAt, endsAt, createdBy }) {
    return oneOf(
      await run('usp_Maintenance_Start', [
        ['TableNo', sql.Int, tableNo],
        ['Reason', sql.NVarChar(200), reason],
        ['StartsAt', sql.DateTime2(0), startsAt],
        ['EndsAt', sql.DateTime2(0), endsAt],
        ['CreatedBy', sql.NVarChar(30), createdBy],
      ])
    );
  }

  async function endMaintenance({ id, now }) {
    return oneOf(
      await run('usp_Maintenance_End', [
        ['Id', sql.Int, id],
        ['Now', sql.DateTime2(0), now],
      ])
    );
  }

  async function setDeviceThreshold({ deviceCode, threshold }) {
    return oneOf(
      await run('usp_Device_SetThreshold', [
        ['DeviceCode', sql.NVarChar(20), deviceCode],
        ['Threshold', sql.Int, threshold],
      ])
    );
  }

  async function getRewardSessions() {
    return rowsOf(await run('usp_Rewards_Sessions'));
  }

  async function getHistory({ from, to, kind, tableNo, top }) {
    return rowsOf(
      await run('usp_History_Get', [
        ['From', sql.DateTime2(0), from],
        ['To', sql.DateTime2(0), to],
        ['Kind', sql.NVarChar(12), kind],
        ['TableNo', sql.Int, tableNo],
        ['Top', sql.Int, top],
      ])
    );
  }

  // ---- Students and sessions ------------------------------------------------

  async function closeStaleSessions(now, maxHours) {
    await run('usp_Session_CloseStale', [
      ['Now', sql.DateTime2(0), now],
      ['MaxHours', sql.Int, maxHours],
    ]);
  }

  async function registerStudent(data) {
    return oneOf(
      await run('usp_Student_Register', [
        ['StudentNo', sql.NVarChar(30), data.studentNo],
        ['LastName', sql.NVarChar(50), data.lastName],
        ['FirstName', sql.NVarChar(50), data.firstName],
        ['MiddleInitial', sql.NVarChar(2), data.middleInitial],
        ['Section', sql.NVarChar(20), data.section],
      ])
    );
  }

  async function findStudent(studentNo) {
    return oneOf(await run('usp_Student_Find', [['StudentNo', sql.NVarChar(30), studentNo]]));
  }

  async function getActiveStudentSession(studentId) {
    return oneOf(await run('usp_Student_ActiveSession', [['StudentId', sql.Int, studentId]]));
  }

  async function startSession({ studentId, tableNo, groupSize, now }) {
    return oneOf(
      await run('usp_Session_Start', [
        ['StudentId', sql.Int, studentId],
        ['TableNo', sql.Int, tableNo],
        ['GroupSize', sql.Int, groupSize],
        ['Now', sql.DateTime2(0), now],
      ])
    );
  }

  async function endSession({ studentId, now }) {
    return oneOf(
      await run('usp_Session_End', [
        ['StudentId', sql.Int, studentId],
        ['Now', sql.DateTime2(0), now],
      ])
    );
  }

  // ---- Table management (administrators) -----------------------------------

  async function addTable(t) {
    return oneOf(
      await run('usp_Table_Add', [
        ['TableNo', sql.Int, t.tableNo],
        ['SeatCount', sql.Int, t.seatCount],
        ['GridCol', sql.Int, t.gridCol],
        ['GridRow', sql.Int, t.gridRow],
        ['GridWidth', sql.Int, t.gridWidth],
        ['GridHeight', sql.Int, t.gridHeight],
      ])
    );
  }

  async function setTableSeats({ tableNo, seatCount }) {
    return oneOf(
      await run('usp_Table_SetSeats', [
        ['TableNo', sql.Int, tableNo],
        ['SeatCount', sql.Int, seatCount],
      ])
    );
  }

  async function clearSampleData() {
    return oneOf(await run('usp_SampleData_Clear'));
  }

  return {
    ping,
    signUp,
    login,
    getLayout,
    getDashboardSummary,
    getRecentAlerts,
    getActiveMaintenance,
    startMaintenance,
    endMaintenance,
    setDeviceThreshold,
    getRewardSessions,
    getHistory,
    closeStaleSessions,
    registerStudent,
    findStudent,
    getActiveStudentSession,
    startSession,
    endSession,
    addTable,
    setTableSeats,
    clearSampleData,
  };
}
