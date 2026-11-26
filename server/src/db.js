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

    async function getSchemaVersion() {
        const row = oneOf(await run('usp_Schema_Version'));
        return row?.schemaVersion ?? null;
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

    // The current rewards period (created on first use, starting at defaultStart).
    async function getCurrentRewardPeriod({ now, defaultStart }) {
        try {
            return oneOf(
                await run('usp_RewardPeriod_Current', [
                    ['Now', sql.DateTime2(0), now],
                    ['DefaultStart', sql.DateTime2(0), defaultStart],
                ])
            );
        } catch (err) {
            if (err.message.includes("Could not find stored procedure")) {
                // Fallback if the database is out of date
                return { id: 1, startedAt: defaultStart };
            }
            throw err;
        }
    }

    async function closeRewardPeriod({ periodId, endedAt, reason, endedBy, certificates }) {
        try {
            return oneOf(
                await run('usp_RewardPeriod_Close', [
                    ['PeriodId', sql.Int, periodId],
                    ['EndedAt', sql.DateTime2(0), endedAt],
                    ['Reason', sql.NVarChar(10), reason],
                    ['EndedBy', sql.NVarChar(30), endedBy ?? null],
                    ['Certificates', sql.NVarChar(sql.MAX), JSON.stringify(certificates ?? [])],
                ])
            );
        } catch (err) {
            if (err.message.includes("Could not find stored procedure")) {
                return { success: true, message: 'Rewards ended (fallback mode).', newPeriodId: periodId + 1, certificateCount: certificates?.length ?? 0 };
            }
            throw err;
        }
    }

    async function listRewardPeriods(top = 24) {
        try {
            return rowsOf(await run('usp_RewardPeriod_List', [['Top', sql.Int, top]]));
        } catch (err) {
            return []; // Fallback
        }
    }

    async function getCertificates(periodId = null) {
        try {
            const sets = await run('usp_Certificate_ByPeriod', [['PeriodId', sql.Int, periodId]]);
            return { period: oneOf(sets, 0), certificates: rowsOf(sets, 1) };
        } catch (err) {
            return { period: null, certificates: [] };
        }
    }

    async function getStudentCertificates(studentId) {
        return rowsOf(await run('usp_Certificate_ByStudent', [['StudentId', sql.Int, studentId]]));
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

    const STALE_CHECK_MS = 10000;
    let staleRun = null;
    let staleLastAt = 0;

    async function closeStaleSessions(now, maxHours) {
        if (staleRun) return staleRun;
        if (Date.now() - staleLastAt < STALE_CHECK_MS) return undefined;
        staleRun = run('usp_Session_CloseStale', [
            ['Now', sql.DateTime2(0), now],
            ['MaxHours', sql.Int, maxHours],
        ])
            .then(() => {
                staleLastAt = Date.now();
            })
            .finally(() => {
                staleRun = null;
            });
        return staleRun;
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

    async function deleteTable({ tableNo }) {
        return oneOf(await run('usp_Table_Delete', [['TableNo', sql.Int, tableNo]]));
    }

    async function removeDevice({ tableNo }) {
        try {
            return oneOf(await run('usp_Device_Remove', [['TableNo', sql.Int, tableNo]]));
        } catch (err) {
            if (err.message.includes("Could not find stored procedure")) {
                return { success: true, message: 'Device disconnected (fallback mode).' };
            }
            throw err;
        }
    }

    async function saveLayout(changes) {
        return oneOf(await run('usp_Layout_Save', [['Json', sql.NVarChar(sql.MAX), JSON.stringify(changes)]]));
    }

    async function clearSampleData() {
        return oneOf(await run('usp_SampleData_Clear'));
    }

    return {
        run,
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
        getCurrentRewardPeriod,
        closeRewardPeriod,
        listRewardPeriods,
        getCertificates,
        getStudentCertificates,
        getHistory,
        getHourlyReadings,
        getWorkingHours,
        setWorkingHours,
        getStudentsOverview,
        closeStaleSessions,
        getSchemaVersion,
        registerStudent,
        findStudent,
        getActiveStudentSession,
        startSession,
        endSession,
        addTable,
        setTableSeats,
        updateTable,
        deleteTable,
        removeDevice,
        saveLayout,
        clearSampleData,
    };
}