import sql from 'mssql';

const camelize = (row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key[0].toLowerCase() + key.slice(1), value]));

export function createDb(dbConfig) {
    const config = {
        connectionTimeout: 15000,
        requestTimeout: 30000,
        ...dbConfig,
        options: {
            encrypt: true,
            trustServerCertificate: true,
            enableArithAbort: true,
            ...dbConfig.options,
        },
    };

    let poolPromise = null;

    function getPool() {
        if (!poolPromise) {
            const pool = new sql.ConnectionPool(config);
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

    async function assignDevice({ tableNo, deviceCode }) {
        return oneOf(
            await run('usp_Device_Assign', [
                ['TableNo', sql.Int, tableNo],
                ['DeviceCode', sql.NVarChar(20), deviceCode],
            ])
        );
    }

    async function recordDeviceReading({ deviceCode, level, receivedAt }) {
        return oneOf(
            await run('usp_Device_Reading', [
                ['DeviceCode', sql.NVarChar(20), deviceCode],
                ['Level', sql.Int, level],
                ['ReceivedAt', sql.DateTime2(0), receivedAt],
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

    async function getHourlyReadings({ from, to, tableNo = null }) {
        return rowsOf(
            await run('usp_Noise_HourlyReadings', [
                ['From', sql.DateTime2(0), from],
                ['To', sql.DateTime2(0), to],
                ['TableNo', sql.Int, tableNo],
            ])
        );
    }

    async function getWorkingHours() {
        return oneOf(await run('usp_Settings_WorkingHours_Get'));
    }

    async function setWorkingHours({ startHour, endHour, excludeWeekends }) {
        return oneOf(
            await run('usp_Settings_WorkingHours_Set', [
                ['StartHour', sql.Int, startHour],
                ['EndHour', sql.Int, endHour],
                ['ExcludeWeekends', sql.Bit, excludeWeekends ? 1 : 0],
            ])
        );
    }

    async function getStudentsOverview() {
        const sets = await run('usp_Faculty_Students_Overview');
        return {
            sessions: rowsOf(sets, 0),
            students: rowsOf(sets, 1),
        };
    }

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

    async function startSession({ studentId, tableNo, now }) {
        return oneOf(
            await run('usp_Session_Start', [
                ['StudentId', sql.Int, studentId],
                ['TableNo', sql.Int, tableNo],
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

    async function updateTable({ tableNo, newTableNo, seatCount }) {
        return oneOf(
            await run('usp_Table_Update', [
                ['TableNo', sql.Int, tableNo],
                ['NewTableNo', sql.Int, newTableNo],
                ['SeatCount', sql.Int, seatCount],
            ])
        );
    }

    async function saveLayout(changes) {
        return oneOf(await run('usp_Layout_Save', [['Json', sql.NVarChar(sql.MAX), JSON.stringify(changes)]]));
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
        assignDevice,
        recordDeviceReading,
        getRewardSessions,
        getHistory,
        getHourlyReadings,
        getWorkingHours,
        setWorkingHours,
        getStudentsOverview,
        closeStaleSessions,
        registerStudent,
        findStudent,
        getActiveStudentSession,
        startSession,
        endSession,
        addTable,
        setTableSeats,
        updateTable,
        saveLayout,
        clearSampleData,
    };
}