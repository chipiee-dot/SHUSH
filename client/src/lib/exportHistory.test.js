import test from 'node:test';
import assert from 'node:assert/strict';
import {
  csvText,
  dailySummary,
  exportFileName,
  generatedLabel,
  rangeLabel,
  shapeRows,
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
