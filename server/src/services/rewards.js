// Rewards leaderboards, worked out from completed sessions.
//
// Each row is one student's place in one session (usp_Rewards_Sessions).
// Every member of a session gets that session's table score.
//
//   Most Frequent Visitor - most completed sessions in the period
//   Quietest Visitor      - lowest average table noise over the period, using
//                           only sessions of at least `minSessionMinutes`
//   Quiet Streak          - consecutive most-recent sessions with no ALERT
//                           (all time; resets after any ALERT)

const TOP_N = 5;

function groupByStudent(rows) {
  const students = new Map();
  for (const row of rows) {
    if (!row.endedAt) continue; // sessions still in progress don't count yet
    let student = students.get(row.studentId);
    if (!student) {
      student = { studentId: row.studentId, name: row.fullName, section: row.section ?? null, sessions: [] };
      students.set(row.studentId, student);
    }
    student.sessions.push(row);
  }
  for (const student of students.values()) {
    student.sessions.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  }
  return [...students.values()];
}

const byValueThenName = (order) => (a, b) => (order === 'asc' ? a.value - b.value : b.value - a.value) || a.name.localeCompare(b.name);

export function computeRewards(rows, { periodStart, now, minSessionMinutes = 30, top = TOP_N }) {
  const students = groupByStudent(rows);
  const start = new Date(periodStart);
  const inPeriod = (session) => new Date(session.startedAt) >= start && new Date(session.startedAt) <= now;
  const durationMinutes = (session) =>
    (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000;

  const mostFrequent = [];
  const quietest = [];
  const quietStreak = [];

  for (const student of students) {
    const periodSessions = student.sessions.filter(inPeriod);

    if (periodSessions.length > 0) {
      mostFrequent.push({
        studentId: student.studentId,
        name: student.name,
        section: student.section,
        value: periodSessions.length,
        sessionCount: periodSessions.length,
        isSample: periodSessions.some((s) => s.isSample),
      });
    }

    const scored = periodSessions.filter((s) => s.avgLevel != null && durationMinutes(s) >= minSessionMinutes);
    if (scored.length > 0) {
      const average = scored.reduce((sum, s) => sum + s.avgLevel, 0) / scored.length;
      quietest.push({
        studentId: student.studentId,
        name: student.name,
        section: student.section,
        value: Math.round(average),
        sessionCount: scored.length,
        isSample: scored.some((s) => s.isSample),
      });
    }

    // Walk back from the latest session until an alert breaks the run.
    const run = [];
    for (let i = student.sessions.length - 1; i >= 0 && !student.sessions[i].hadAlert; i -= 1) {
      run.push(student.sessions[i]);
    }
    if (run.length > 0) {
      quietStreak.push({
        studentId: student.studentId,
        name: student.name,
        section: student.section,
        value: run.length,
        sessionCount: run.length,
        isSample: run.some((s) => s.isSample),
      });
    }
  }

  return {
    hasSampleData: rows.some((row) => row.isSample),
    mostFrequent: mostFrequent.sort(byValueThenName('desc')).slice(0, top),
    quietest: quietest.sort(byValueThenName('asc')).slice(0, top),
    quietStreak: quietStreak.sort(byValueThenName('desc')).slice(0, top),
  };
}
