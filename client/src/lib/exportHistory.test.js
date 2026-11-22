import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyticsCsvText,
  analyticsExportFileName,
  csvText,
  dailySummary,
  exportFileName,
  generatedLabel,
  rangeLabel,
  shapeRows,
  studentsCsvText,
  studentsExportFileName,
  subtitleLine,
  summaryCounts,
} from './exportHistory.js';

// Local-time dates, so the tests pass in any time zone.
const at = (d, h, m) => new Date(2026, 10, d, h, m, 0).toISOString();
const ROWS = [
  { kind: 'alert', occurredAt: at(16, 9, 5), tableNo: 3, summary: 'Noise alert', detail: 'Level 82', isSample: false },
  { kind: 'session', occurredAt: at(16, 14, 30), tableNo: 1, summary: '=SUM(A1)', detail: 'He said "hi", then left', isSample: true },
  { kind: 'maintenance', occurredAt: at(15, 8, 0), tableNo: null, summary: 'Cleaning', detail: '', isSample: false },
  { kind: 'session', occurredAt: at(15, 10, 0), tableNo: 2, summary: 'Visit', detail: '', isSample: false },
];

test('shapeRows gives local date parts, a table label and Excel-friendly time', () => {
  const [a, , c] = shapeRows(ROWS);
  assert.equal(a.dateKey, '2026-11-16');
  assert.equal([a.year, a.month, a.day].join('-'), '2026-11-16');
  assert.equal(a.secondsOfDay, 9 * 3600 + 5 * 60);
  assert.equal(a.type, 'Alert');
  assert.equal(a.table, 3);
  assert.equal(c.table, 'All tables');
});

test('summaryCounts counts each type and the total', () => {
  assert.deepEqual(summaryCounts(shapeRows(ROWS)), { alert: 1, maintenance: 1, session: 2, total: 4 });
  assert.deepEqual(summaryCounts([]), { alert: 0, maintenance: 0, session: 0, total: 0 });
});

test('dailySummary groups by day, newest first', () => {
  const days = dailySummary(shapeRows(ROWS));
  assert.deepEqual(days.map((d) => d.dateKey), ['2026-11-16', '2026-11-15']);
  assert.deepEqual([days[0].alert, days[0].maintenance, days[0].session, days[0].total], [1, 0, 1, 2]);
  assert.deepEqual([days[1].alert, days[1].maintenance, days[1].session, days[1].total], [0, 1, 1, 2]);
});

test('csvText has a BOM, CRLF line ends and the new columns', () => {
  const text = csvText(ROWS);
  assert.equal(text.charCodeAt(0), 0xfeff);
  const lines = text.slice(1).split('\r\n');
  assert.equal(lines.length, 5);
  assert.equal(lines[0], '"Date","Time","Type","Table","Summary","Details","Sample data","Timestamp (UTC)"');
  assert.ok(lines[1].startsWith('"2026-11-16","09:05:00","Alert","3","Noise alert","Level 82","no","'));
  assert.ok(lines[1].endsWith('Z"'));
});

test('csvText still guards formulas and escapes quotes', () => {
  const lines = csvText(ROWS).slice(1).split('\r\n');
  assert.ok(lines[2].includes('"\'=SUM(A1)"'), 'a leading = is prefixed with a quote');
  assert.ok(lines[2].includes('"He said ""hi"", then left"'));
  assert.ok(lines[2].includes('"yes"'));
  assert.ok(lines[3].includes('"All tables"'));
});

test('file names follow the pattern', () => {
  const d = new Date(2026, 10, 16, 9, 41);
  assert.equal(exportFileName('all', 'xlsx', d), 'shush-history-all-2026-11-16.xlsx');
  assert.equal(exportFileName('alert', 'csv', d), 'shush-history-alert-2026-11-16.csv');
});

test('labels read the way the report shows them', () => {
  assert.equal(rangeLabel('2026-11-10', '2026-11-16'), 'Nov 10 – Nov 16, 2026');
  assert.equal(rangeLabel('2025-12-30', '2026-01-02'), 'Dec 30, 2025 – Jan 2, 2026');
  assert.equal(rangeLabel('2026-11-16', '2026-11-16'), 'Nov 16, 2026');
  assert.equal(generatedLabel(new Date(2026, 10, 16, 9, 41)), 'Nov 16, 2026 9:41 AM');
  assert.equal(
    subtitleLine({ typeLabel: 'All', tableLabel: 'All tables', range: 'Nov 10 – Nov 16, 2026', generatedAt: new Date(2026, 10, 16, 9, 41), by: 'Jane Doe' }),
    'Type: All · Table: All tables · Range: Nov 10 – Nov 16, 2026 · Generated Nov 16, 2026 9:41 AM by Jane Doe'
  );
});

test('analyticsExportFileName and analyticsCsvText format working-hours exports safely', () => {
  const d = new Date(2026, 10, 16, 9, 41);
  assert.equal(analyticsExportFileName('week', 'all', 'xlsx', d), 'shush-working-hours-week-all-2026-11-16.xlsx');
  assert.equal(analyticsExportFileName('month', 3, 'csv', d), 'shush-working-hours-month-table-3-2026-11-16.csv');

  const csv = analyticsCsvText(
    {
      period: 'week',
      tableNo: 3,
      overallAvgLevel: 1100,
      peakHour: { hour: 14 },
      quietestHour: { hour: 8 },
      hours: [
        { hour: 8, slotLabel: '8:00 AM – 9:00 AM', label: '8a', avgLevel: 850, sessionCount: 1, readingCount: 12, alertCount: 0 },
        { hour: 14, slotLabel: '2:00 PM – 3:00 PM', label: '2p', avgLevel: 1450, sessionCount: 2, readingCount: 20, alertCount: 1 },
      ],
    },
    { periodLabel: '7 Days', tableLabel: 'Table 3' }
  );
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], '"Hour Slot","Label","Status","Avg Noise Level","Sessions","Sensor Readings","Alerts","Table","Period"');
  assert.equal(lines[1], '"8:00 AM – 9:00 AM","8a","Quietest","850","1","12","0","Table 3","7 Days"');
  assert.equal(lines[2], '"2:00 PM – 3:00 PM","2p","Peak (noisiest)","1450","2","20","1","Table 3","7 Days"');
});

test('studentsExportFileName and studentsCsvText format seated, visits and directory tabs', () => {
  const d = new Date(2026, 10, 22, 18, 0);
  assert.equal(studentsExportFileName('seated', 'xlsx', d), 'shush-students-seated-2026-11-22.xlsx');
  assert.equal(studentsExportFileName('visits', 'csv', d), 'shush-students-visits-2026-11-22.csv');

  const seatedCsv = studentsCsvText(
    [
      {
        studentNo: '21-0001',
        name: 'Reyes, Ana',
        section: 'BSIT-3D',
        tableNo: 2,
        tableStatus: 'QUIET',
        deviceLevel: 980,
        startedAt: '2026-11-22T09:30:00Z',
        durationMinutes: 25,
        isSample: false,
      },
    ],
    'seated'
  );
  assert.equal(seatedCsv.charCodeAt(0), 0xfeff);
  const seatedLines = seatedCsv.slice(1).split('\r\n');
  assert.equal(seatedLines[0], '"Student No.","Name","Section","Table","Table Status","Noise Level","Started At","Duration (min)","Sample data"');
  assert.ok(seatedLines[1].includes('"21-0001","Reyes, Ana","BSIT-3D","Table 2","QUIET","980"'));

  const visitsCsv = studentsCsvText(
    [
      {
        studentNo: '21-0002',
        name: 'Cruz, Ben',
        section: 'BSCS-1D',
        tableNo: 1,
        startedAt: '2026-11-22T01:00:00Z',
        endedAt: '2026-11-22T01:45:00Z',
        durationMinutes: 45,
        avgLevel: 1200,
        hadAlert: true,
        isSample: true,
      },
    ],
    'visits'
  );
  const visitLines = visitsCsv.slice(1).split('\r\n');
  assert.ok(visitLines[1].includes('"45","1200","Alert","Sample"'));

  const dirCsv = studentsCsvText(
    [
      {
        studentNo: '21-0001',
        name: 'Reyes, Ana',
        section: 'BSIT-3D',
        activeSession: { tableNo: 2 },
        totalSessions: 4,
        avgNoiseLevel: 950,
        alertCount: 0,
        lastSeenAt: '2026-11-22T09:30:00Z',
        isSample: false,
      },
    ],
    'directory'
  );
  const dirLines = dirCsv.slice(1).split('\r\n');
  assert.ok(dirLines[1].includes('"Seated","Table 2","4","950","0"'));
});
