// Aggregates logged-in student sessions, completed visits, and the registered
// student directory for the Faculty/Admin console Students page.

function formatFallbackName(row) {
  if (row?.fullName) return row.fullName;
  if (row?.lastName && row?.firstName) {
    const mid = row.middleInitial ? ` ${row.middleInitial}.` : '';
    return `${row.lastName}, ${row.firstName}${mid}`;
  }
  return 'Student';
}

function durationMinutesBetween(start, end) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

export function buildStudentsOverview({
  sessions = [],
  students = [],
  tables = [],
  now = new Date(),
  dayStart = null,
} = {}) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const dayStartMs = dayStart ? new Date(dayStart).getTime() : null;
  const tableMap = new Map(tables.map((t) => [t.tableNo, t]));

  const studentInfoById = new Map();
  for (const row of students) {
    const id = row?.studentId ?? row?.id;
    if (id == null) continue;
    studentInfoById.set(id, {
      studentId: id,
      studentNo: row.studentNo ?? null,
      name: formatFallbackName(row),
      section: row.section ?? null,
      registeredAt: row.registeredAt ?? null,
      isSample: Boolean(row.isSample),
    });
  }

  const seenSessionKeys = new Set();
  const activeSessions = [];
  const completedSessions = [];

  for (const row of sessions) {
    if (!row || row.studentId == null) continue;
    const key = row.sessionId != null ? `${row.sessionId}:${row.studentId}` : null;
    if (key && seenSessionKeys.has(key)) continue;
    if (key) seenSessionKeys.add(key);

    const info = studentInfoById.get(row.studentId);
    const name = row.fullName || info?.name || formatFallbackName(row);
    const studentNo = row.studentNo ?? info?.studentNo ?? null;
    const section = row.section ?? info?.section ?? null;
    const isSample = Boolean(row.isSample || info?.isSample);

    if (!info) {
      studentInfoById.set(row.studentId, {
        studentId: row.studentId,
        studentNo,
        name,
        section,
        registeredAt: null,
        isSample,
      });
    } else {
      if (!info.studentNo && studentNo) info.studentNo = studentNo;
      if (!info.section && section) info.section = section;
      if (isSample) info.isSample = true;
    }

    const table = tableMap.get(row.tableNo);
    const endedAt = row.endedAt ?? null;
    if (!endedAt) {
      activeSessions.push({
        sessionId: row.sessionId,
        studentId: row.studentId,
        studentNo,
        name,
        section,
        tableNo: row.tableNo,
        startedAt: row.startedAt,
        durationMinutes: durationMinutesBetween(row.startedAt, nowDate),
        tableStatus: table?.status ?? 'OFFLINE',
        deviceCode: table?.device?.code ?? null,
        deviceLevel: table?.device?.level ?? null,
        deviceThreshold: table?.device?.threshold ?? null,
        tableOccupied: table?.occupancy?.seated ?? null,
        tableSeats: table?.seats ?? null,
        isSample,
      });
    } else {
      completedSessions.push({
        sessionId: row.sessionId,
        studentId: row.studentId,
        studentNo,
        name,
        section,
        tableNo: row.tableNo,
        startedAt: row.startedAt,
        endedAt,
        durationMinutes: durationMinutesBetween(row.startedAt, endedAt),
        avgLevel: row.avgLevel ?? null,
        hadAlert: Boolean(row.hadAlert),
        isSample,
      });
    }
  }

  activeSessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  completedSessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

  const activeByStudent = new Map(activeSessions.map((s) => [s.studentId, s]));
  const completedByStudent = new Map();
  for (const s of completedSessions) {
    if (!completedByStudent.has(s.studentId)) completedByStudent.set(s.studentId, []);
    completedByStudent.get(s.studentId).push(s);
  }

  const directory = [...studentInfoById.values()].map((st) => {
    const active = activeByStudent.get(st.studentId) ?? null;
    const past = completedByStudent.get(st.studentId) ?? [];
    const scored = past.filter((s) => s.avgLevel != null && Number.isFinite(Number(s.avgLevel)));
    const avgNoiseLevel =
      scored.length > 0
        ? Math.round(scored.reduce((sum, s) => sum + Number(s.avgLevel), 0) / scored.length)
        : null;
    const alertCount = past.filter((s) => s.hadAlert).length;

    let quietStreak = 0;
    for (let i = 0; i < past.length && !past[i].hadAlert; i += 1) {
      quietStreak += 1;
    }

    const totalMinutes =
      past.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0) +
      (active ? Number(active.durationMinutes) || 0 : 0);

    const tableCounts = new Map();
    const studentSessions = active ? [active, ...past] : past;
    for (const s of studentSessions) {
      if (s.tableNo == null) continue;
      const startedMs = new Date(s.startedAt).getTime();
      const prev = tableCounts.get(s.tableNo);
      if (!prev) {
        tableCounts.set(s.tableNo, {
          tableNo: s.tableNo,
          count: 1,
          latestMs: Number.isFinite(startedMs) ? startedMs : 0,
        });
      } else {
        prev.count += 1;
        if (Number.isFinite(startedMs) && startedMs > prev.latestMs) {
          prev.latestMs = startedMs;
        }
      }
    }
    const favoriteTableNo =
      tableCounts.size > 0
        ? [...tableCounts.values()].sort(
            (a, b) => b.count - a.count || b.latestMs - a.latestMs || a.tableNo - b.tableNo
          )[0].tableNo
        : null;

    const candidateTimes = [
      active?.startedAt,
      ...past.map((s) => s.endedAt || s.startedAt),
      st.registeredAt,
    ]
      .filter(Boolean)
      .map((t) => new Date(t).getTime())
      .filter(Number.isFinite);
    const lastSeenAt = candidateTimes.length > 0 ? new Date(Math.max(...candidateTimes)).toISOString() : null;

    return {
      studentId: st.studentId,
      studentNo: st.studentNo,
      name: st.name,
      section: st.section,
      registeredAt: st.registeredAt,
      isSample: st.isSample,
      activeSession: active
        ? {
            sessionId: active.sessionId,
            tableNo: active.tableNo,
            startedAt: active.startedAt,
            durationMinutes: active.durationMinutes,
            tableStatus: active.tableStatus,
          }
        : null,
      totalSessions: past.length + (active ? 1 : 0),
      totalMinutes,
      quietStreak,
      favoriteTableNo,
      avgNoiseLevel,
      alertCount,
      lastSeenAt,
    };
  });

  directory.sort((a, b) => {
    const aActive = a.activeSession ? 0 : 1;
    const bActive = b.activeSession ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return a.name.localeCompare(b.name);
  });

  const allSessions = [...activeSessions, ...completedSessions];
  const todaySessions =
    dayStartMs === null
      ? allSessions
      : allSessions.filter((s) => new Date(s.startedAt).getTime() >= dayStartMs);

  const sections = [...new Set(directory.map((d) => d.section).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  return {
    sample:
      activeSessions.some((s) => s.isSample) ||
      completedSessions.some((s) => s.isSample) ||
      directory.some((d) => d.isSample),
    summary: {
      seatedNow: activeSessions.length,
      tablesOccupied: new Set(activeSessions.map((s) => s.tableNo)).size,
      tablesTotal: tables.length,
      visitsToday: todaySessions.length,
      uniqueStudentsToday: new Set(todaySessions.map((s) => s.studentId)).size,
      totalRegistered: directory.length,
      sections,
    },
    activeSessions,
    completedSessions,
    directory,
  };
}

// Fallback for databases where usp_Faculty_Students_Overview has not been deployed yet.
export async function loadStudentsFromFallback(db) {
  const rewardRows = db.getRewardSessions ? await db.getRewardSessions().catch(() => []) : [];
  const studentsById = new Map();

  for (const row of rewardRows) {
    if (row?.studentId == null) continue;
    if (!studentsById.has(row.studentId)) {
      studentsById.set(row.studentId, {
        studentId: row.studentId,
        studentNo: row.studentNo ?? null,
        fullName: row.fullName,
        section: row.section ?? null,
        registeredAt: null,
        isSample: Boolean(row.isSample),
      });
    }
  }

  if (db.findStudent) {
    const sampleCodes = Array.from({ length: 12 }, (_, i) => `SAMPLE-${String(i + 1).padStart(2, '0')}`);
    const found = await Promise.all(sampleCodes.map((code) => db.findStudent(code).catch(() => null)));
    for (const st of found) {
      const id = st?.id ?? st?.studentId;
      if (id == null) continue;
      const prev = studentsById.get(id);
      studentsById.set(id, {
        studentId: id,
        studentNo: st.studentNo ?? prev?.studentNo ?? null,
        fullName: st.fullName ?? prev?.fullName ?? formatFallbackName(st),
        section: st.section ?? prev?.section ?? null,
        registeredAt: prev?.registeredAt ?? null,
        isSample: true,
      });
    }
  }

  const sessions = [...rewardRows];
  if (db.getActiveStudentSession && studentsById.size > 0) {
    const entries = [...studentsById.values()];
    const activeList = await Promise.all(
      entries.map(async (st) => {
        const active = await db.getActiveStudentSession(st.studentId).catch(() => null);
        return active ? { st, active } : null;
      })
    );
    for (const item of activeList) {
      if (!item) continue;
      const { st, active } = item;
      sessions.push({
        sessionId: active.sessionId,
        studentId: st.studentId,
        studentNo: st.studentNo,
        fullName: st.fullName,
        section: st.section,
        tableNo: active.tableNo,
        startedAt: active.startedAt,
        endedAt: null,
        avgLevel: null,
        hadAlert: false,
        isSample: st.isSample,
      });
    }
  }

  return {
    sessions,
    students: [...studentsById.values()],
  };
}
