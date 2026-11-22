// History export: the pure parts (row shaping, counts, daily grouping, CSV text, labels) and the Excel
// workbook builder. Only buildHistoryWorkbook needs `exceljs`, and it loads it on demand, so the normal
// page load does not get heavier and the other functions can be tested without a browser.
import { HISTORY_KIND_META, csvCell } from './format.js';

export const KINDS = ['alert', 'maintenance', 'session'];

// Excel colors (the app tokens). Each is fill / text.
const C = {
  orange: 'CF470C', // shush-orange700 family, white text passes contrast on it
  cream: 'FFF7E8',
  ink: '2A1A12',
  muted: '8A6A57',
  line: 'F3DFC6',
  white: 'FFFFFF',
  sampleFill: 'FDF3C9',
};
const KIND_COLORS = {
  alert: { fill: 'FFE1D6', text: 'B42318' },
  maintenance: { fill: 'FDEBCB', text: 'A63A06' },
  session: { fill: 'FCEBB5', text: C.ink },
};
const TOTAL_COLORS = { fill: 'FDEBCB', text: C.ink };

const pad = (n) => String(n).padStart(2, '0');

/** YYYY-MM-DD in the browser's local time. */
export function localDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function kindLabel(kind) {
  return HISTORY_KIND_META[kind]?.label ?? kind;
}

/** Turns history rows into flat records with local date parts, ready for Excel or CSV. */
export function shapeRows(rows) {
  return rows.map((r) => {
    const at = new Date(r.occurredAt);
    return {
      kind: r.kind,
      type: kindLabel(r.kind),
      dateKey: localDateKey(at),
      year: at.getFullYear(),
      month: at.getMonth() + 1,
      day: at.getDate(),
      secondsOfDay: at.getHours() * 3600 + at.getMinutes() * 60 + at.getSeconds(),
      timeText: `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`,
      table: r.tableNo ?? 'All tables',
      summary: r.summary ?? '',
      detail: r.detail ?? '',
      isSample: Boolean(r.isSample),
      iso: at.toISOString(),
    };
  });
}

/** Counts per type plus the total. */
export function summaryCounts(shaped) {
  const counts = { alert: 0, maintenance: 0, session: 0, total: shaped.length };
  shaped.forEach((r) => {
    if (counts[r.kind] !== undefined) counts[r.kind] += 1;
  });
  return counts;
}

/** One record per local day, newest first. */
export function dailySummary(shaped) {
  const byDay = new Map();
  shaped.forEach((r) => {
    if (!byDay.has(r.dateKey)) {
      byDay.set(r.dateKey, { dateKey: r.dateKey, year: r.year, month: r.month, day: r.day, alert: 0, maintenance: 0, session: 0, total: 0 });
    }
    const d = byDay.get(r.dateKey);
    if (d[r.kind] !== undefined) d[r.kind] += 1;
    d.total += 1;
  });
  return [...byDay.values()].sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}

/** The CSV file text: UTF-8 BOM, CRLF line ends, every cell quoted and guarded by csvCell. */
export function csvText(rows) {
  const header = ['Date', 'Time', 'Type', 'Table', 'Summary', 'Details', 'Sample data', 'Timestamp (UTC)'];
  const lines = shapeRows(rows).map((r) =>
    [r.dateKey, r.timeText, r.type, r.table, r.summary, r.detail, r.isSample ? 'yes' : 'no', r.iso].map(csvCell).join(',')
  );
  return `\uFEFF${[header.map(csvCell).join(','), ...lines].join('\r\n')}`;
}

export function exportFileName(kind, ext, date = new Date()) {
  return `shush-history-${kind}-${localDateKey(date)}.${ext}`;
}

const monthDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

/** "Nov 10 – Nov 16, 2026" (the year shows on both ends when the range crosses years). */
export function rangeLabel(from, to) {
  if (!from || !to) return 'All dates';
  const [fy] = from.split('-');
  const [ty] = to.split('-');
  if (from === to) return `${monthDay(from)}, ${ty}`;
  return fy === ty ? `${monthDay(from)} – ${monthDay(to)}, ${ty}` : `${monthDay(from)}, ${fy} – ${monthDay(to)}, ${ty}`;
}

/** "Nov 16, 2026 9:41 AM" */
export function generatedLabel(date = new Date()) {
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} ${time}`;
}

/** The grey line under the title in the workbook. */
export function subtitleLine({ typeLabel, tableLabel, range, generatedAt, by }) {
  return `Type: ${typeLabel} · Table: ${tableLabel} · Range: ${range} · Generated ${generatedLabel(generatedAt)}${by ? ` by ${by}` : ''}`;
}

// ---- Excel workbook -----------------------------------------------------------------------------------------

const argb = (hex) => `FF${hex}`;
const solid = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } });
const hair = { style: 'hair', color: { argb: argb(C.line) } };
const BORDER = { top: hair, left: hair, bottom: hair, right: hair };
// Excel stores a date as a number with no time zone, so a local calendar day is written as the same day in UTC.
const excelDate = (r) => new Date(Date.UTC(r.year, r.month - 1, r.day));

function titleRows(sheet, lastCol, title, subtitle) {
  sheet.mergeCells(`A1:${lastCol}1`);
  const t = sheet.getCell('A1');
  t.value = title;
  t.font = { name: 'Calibri', size: 18, bold: true, color: { argb: argb(C.white) } };
  t.fill = solid(C.orange);
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 32;

  sheet.mergeCells(`A2:${lastCol}2`);
  const s = sheet.getCell('A2');
  s.value = subtitle;
  s.font = { name: 'Calibri', size: 10, color: { argb: argb(C.ink) } };
  s.fill = solid(C.cream);
  s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
  sheet.getRow(2).height = 30;
}

function headerRow(sheet, rowNo, labels) {
  const row = sheet.getRow(rowNo);
  labels.forEach((label, i) => {
    const cell = row.getCell(i + 1);
    cell.value = label;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: argb(C.white) } };
    cell.fill = solid(C.orange);
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cell.border = BORDER;
  });
  row.height = 24;
}

function summaryBox(sheet, range, label, value, colors) {
  const [from, to] = range;
  const merged = from !== to;
  if (merged) {
    sheet.mergeCells(`${from}4:${to}4`);
    sheet.mergeCells(`${from}5:${to}5`);
  }
  const l = sheet.getCell(`${from}4`);
  l.value = label;
  l.font = { name: 'Calibri', size: 10, bold: true, color: { argb: argb(colors.text) } };
  l.alignment = { vertical: 'bottom', horizontal: 'center' };
  const n = sheet.getCell(`${from}5`);
  n.value = value;
  n.font = { name: 'Calibri', size: 22, bold: true, color: { argb: argb(colors.text) } };
  n.alignment = { vertical: 'middle', horizontal: 'center' };
  n.numFmt = '#,##0';
  // Fill every cell of the box, including the merged ones, so the box looks like one block.
  const cols = merged ? [from, to] : [from];
  const first = from.charCodeAt(0);
  const last = to.charCodeAt(0);
  for (let c = first; c <= last; c += 1) {
    [4, 5].forEach((r) => {
      sheet.getCell(`${String.fromCharCode(c)}${r}`).fill = solid(colors.fill);
    });
  }
  return cols;
}

/**
 * Builds the styled workbook and returns it as a Blob. `exceljs` is loaded here, on demand.
 * meta: { typeLabel, tableLabel, from, to, by, generatedAt }
 */
export async function buildHistoryWorkbook(rows, meta = {}) {
  const mod = await import('exceljs');
  const ExcelJS = mod.default ?? mod;
  const shaped = shapeRows(rows);
  const counts = summaryCounts(shaped);
  const generatedAt = meta.generatedAt ?? new Date();
  const subtitle = subtitleLine({
    typeLabel: meta.typeLabel ?? 'All',
    tableLabel: meta.tableLabel ?? 'All tables',
    range: rangeLabel(meta.from, meta.to),
    generatedAt,
    by: meta.by,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = meta.by || 'SHUSH';
  wb.created = generatedAt;

  // ---- Sheet 1: History log (Excel reserves the sheet name "History")
  const ws = wb.addWorksheet('History log', {
    properties: { tabColor: { argb: argb('F25F13') } },
    views: [{ state: 'frozen', ySplit: 7, showGridLines: false }],
  });
  [14, 11, 14, 12, 40, 60, 13].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  titleRows(ws, 'G', 'SHUSH · History report', subtitle);
  ws.getRow(3).height = 8;
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 34;
  summaryBox(ws, ['A', 'B'], 'ALERTS', counts.alert, KIND_COLORS.alert);
  summaryBox(ws, ['C', 'D'], 'MAINTENANCE', counts.maintenance, KIND_COLORS.maintenance);
  summaryBox(ws, ['E', 'E'], 'SESSIONS', counts.session, KIND_COLORS.session);
  summaryBox(ws, ['F', 'G'], 'TOTAL', counts.total, TOTAL_COLORS);
  ws.getRow(6).height = 8;

  headerRow(ws, 7, ['Date', 'Time', 'Type', 'Table', 'Summary', 'Details', 'Sample data']);

  shaped.forEach((r, i) => {
    const row = ws.getRow(8 + i);
    const zebra = i % 2 === 0 ? C.white : C.cream;
    const baseFont = { name: 'Calibri', size: 10.5, color: { argb: argb(r.isSample ? C.muted : C.ink) }, italic: r.isSample };
    row.getCell(1).value = excelDate(r);
    row.getCell(1).numFmt = 'mmm d, yyyy';
    row.getCell(2).value = r.secondsOfDay / 86400;
    row.getCell(2).numFmt = 'h:mm AM/PM';
    row.getCell(3).value = r.type;
    row.getCell(4).value = r.table;
    row.getCell(5).value = r.summary;
    row.getCell(6).value = r.detail;
    row.getCell(7).value = r.isSample ? 'Sample' : '';
    for (let c = 1; c <= 7; c += 1) {
      const cell = row.getCell(c);
      cell.font = baseFont;
      cell.fill = solid(zebra);
      cell.border = BORDER;
      cell.alignment = { vertical: 'top', horizontal: c === 4 || c === 7 ? 'center' : 'left', indent: c === 4 || c === 7 ? 0 : 1, wrapText: c === 5 || c === 6 };
    }
    const k = KIND_COLORS[r.kind];
    if (k) {
      const t = row.getCell(3);
      t.fill = solid(k.fill);
      t.font = { name: 'Calibri', size: 10.5, bold: true, italic: false, color: { argb: argb(k.text) } };
    }
    if (r.isSample) row.getCell(7).fill = solid(C.sampleFill);
  });

  ws.autoFilter = { from: 'A7', to: `G${7 + Math.max(shaped.length, 1)}` };
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '7:7',
    paperSize: 9,
  };
  ws.headerFooter.oddFooter = '&CSHUSH History · Page &P of &N';

  // ---- Sheet 2: Daily summary
  const daily = dailySummary(shaped);
  const ds = wb.addWorksheet('Daily summary', {
    properties: { tabColor: { argb: argb('F8DE8C') } },
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
  });
  [16, 12, 14, 12, 12].forEach((w, i) => {
    ds.getColumn(i + 1).width = w;
  });
  titleRows(ds, 'E', 'SHUSH · Daily summary', subtitle);
  ds.getRow(3).height = 8;
  headerRow(ds, 4, ['Date', 'Alerts', 'Maintenance', 'Sessions', 'Total']);
  daily.forEach((d, i) => {
    const row = ds.getRow(5 + i);
    const zebra = i % 2 === 0 ? C.white : C.cream;
    row.getCell(1).value = excelDate(d);
    row.getCell(1).numFmt = 'mmm d, yyyy';
    row.getCell(2).value = d.alert;
    row.getCell(3).value = d.maintenance;
    row.getCell(4).value = d.session;
    row.getCell(5).value = d.total;
    for (let c = 1; c <= 5; c += 1) {
      const cell = row.getCell(c);
      cell.font = { name: 'Calibri', size: 10.5, bold: c === 5, color: { argb: argb(C.ink) } };
      cell.fill = solid(zebra);
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center', indent: c === 1 ? 1 : 0 };
      if (c > 1) cell.numFmt = '#,##0';
    }
  });
  ds.autoFilter = { from: 'A4', to: `E${4 + Math.max(daily.length, 1)}` };
  ds.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '4:4', paperSize: 9 };
  ds.headerFooter.oddFooter = '&CSHUSH History · Page &P of &N';

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Saves a Blob as a file download. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsvFile(rows, filename) {
  downloadBlob(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }), filename);
}

// ---- Working-hours analytics export -------------------------------------------------------------------------

function hourStatusLabel(hourRow, analytics) {
  if (analytics?.peakHour && hourRow.hour === analytics.peakHour.hour) return 'Peak (noisiest)';
  if (analytics?.quietestHour && hourRow.hour === analytics.quietestHour.hour) return 'Quietest';
  const active =
    (hourRow.sessionCount ?? 0) > 0 ||
    (hourRow.readingCount ?? 0) > 0 ||
    (hourRow.alertCount ?? 0) > 0;
  if (!active) return 'No activity';
  if ((analytics?.overallAvgLevel ?? 0) > 0 && (hourRow.avgLevel ?? 0) >= analytics.overallAvgLevel) {
    return 'Above avg';
  }
  return 'Below avg';
}

export function analyticsExportFileName(period, tableNo, ext, date = new Date()) {
  const tablePart =
    tableNo === 'all' || tableNo === null || tableNo === undefined || tableNo === ''
      ? 'all'
      : `table-${tableNo}`;
  return `shush-working-hours-${period || 'week'}-${tablePart}-${localDateKey(date)}.${ext}`;
}

export function analyticsCsvText(analytics = {}, meta = {}) {
  const header = [
    'Hour Slot',
    'Label',
    'Status',
    'Avg Noise Level',
    'Sessions',
    'Sensor Readings',
    'Alerts',
    'Table',
    'Period',
  ];
  const tableLabel =
    meta.tableLabel ?? (analytics.tableNo != null ? `Table ${analytics.tableNo}` : 'All tables');
  const periodLabel = meta.periodLabel ?? analytics.period ?? 'week';
  const lines = (analytics.hours ?? []).map((h) =>
    [
      h.slotLabel ?? '',
      h.label ?? '',
      hourStatusLabel(h, analytics),
      h.avgLevel ?? 0,
      h.sessionCount ?? 0,
      h.readingCount ?? 0,
      h.alertCount ?? 0,
      tableLabel,
      periodLabel,
    ]
      .map(csvCell)
      .join(',')
  );
  return `\uFEFF${[header.map(csvCell).join(','), ...lines].join('\r\n')}`;
}

export async function buildAnalyticsWorkbook(analytics = {}, meta = {}) {
  const mod = await import('exceljs');
  const ExcelJS = mod.default ?? mod;
  const generatedAt = meta.generatedAt ?? new Date();
  const tableLabel =
    meta.tableLabel ?? (analytics.tableNo != null ? `Table ${analytics.tableNo}` : 'All tables');
  const periodLabel = meta.periodLabel ?? analytics.period ?? 'week';
  const windowLabel = meta.workWindowText ?? '8:00 AM – 5:00 PM';
  const subtitle = `Period: ${periodLabel} · Table: ${tableLabel} · Hours: ${windowLabel} · Generated ${generatedLabel(generatedAt)}${meta.by ? ` by ${meta.by}` : ''}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = meta.by || 'SHUSH';
  wb.created = generatedAt;

  const ws = wb.addWorksheet('Working-hours noise', {
    properties: { tabColor: { argb: argb('F25F13') } },
    views: [{ state: 'frozen', ySplit: 7, showGridLines: false }],
  });
  [24, 10, 18, 18, 12, 16, 12].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  titleRows(ws, 'G', 'SHUSH · Working-hours noise analytics', subtitle);
  ws.getRow(3).height = 8;
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 34;

  const peakText = analytics.peakHour
    ? `${analytics.peakHour.label} (${analytics.peakHour.avgLevel})`
    : '—';
  const quietText = analytics.quietestHour
    ? `${analytics.quietestHour.label} (${analytics.quietestHour.avgLevel})`
    : '—';
  const contrastText = analytics.contrast
    ? `${analytics.contrast.quietPct}% (-${analytics.contrast.levelDelta})`
    : '—';

  summaryBox(ws, ['A', 'B'], 'NOISIEST HOUR', peakText, KIND_COLORS.alert);
  summaryBox(ws, ['C', 'D'], 'QUIETEST HOUR', quietText, { fill: 'FDF3C9', text: '7A5A00' });
  summaryBox(ws, ['E', 'E'], 'QUIETER BY', contrastText, KIND_COLORS.session);
  summaryBox(ws, ['F', 'G'], 'WORKING-HOURS AVG', analytics.overallAvgLevel ?? 0, TOTAL_COLORS);
  ws.getRow(6).height = 8;

  headerRow(ws, 7, [
    'Hour Slot',
    'Label',
    'Status',
    'Avg Noise Level',
    'Sessions',
    'Sensor Readings',
    'Alerts',
  ]);

  const hours = analytics.hours ?? [];
  hours.forEach((h, i) => {
    const row = ws.getRow(8 + i);
    const zebra = i % 2 === 0 ? C.white : C.cream;
    const status = hourStatusLabel(h, analytics);

    row.getCell(1).value = h.slotLabel ?? '';
    row.getCell(2).value = h.label ?? '';
    row.getCell(3).value = status;
    row.getCell(4).value = h.avgLevel ?? 0;
    row.getCell(5).value = h.sessionCount ?? 0;
    row.getCell(6).value = h.readingCount ?? 0;
    row.getCell(7).value = h.alertCount ?? 0;

    for (let c = 1; c <= 7; c += 1) {
      const cell = row.getCell(c);
      cell.font = { name: 'Calibri', size: 10.5, color: { argb: argb(C.ink) } };
      cell.fill = solid(zebra);
      cell.border = BORDER;
      cell.alignment = {
        vertical: 'middle',
        horizontal: c >= 4 || c === 2 ? 'center' : 'left',
        indent: c >= 4 || c === 2 ? 0 : 1,
      };
      if (c >= 4) cell.numFmt = '#,##0';
    }

    if (status === 'Peak (noisiest)') {
      const cell = row.getCell(3);
      cell.fill = solid(KIND_COLORS.alert.fill);
      cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: argb(KIND_COLORS.alert.text) } };
    } else if (status === 'Quietest') {
      const cell = row.getCell(3);
      cell.fill = solid('FDF3C9');
      cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: argb('7A5A00') } };
    }
  });

  ws.autoFilter = { from: 'A7', to: `G${7 + Math.max(hours.length, 1)}` };
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '7:7',
    paperSize: 9,
  };
  ws.headerFooter.oddFooter = '&CSHUSH Working-hours analytics · Page &P of &N';

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadAnalyticsCsvFile(analytics, meta, filename) {
  downloadBlob(new Blob([analyticsCsvText(analytics, meta)], { type: 'text/csv;charset=utf-8' }), filename);
}

// ---- Students export -----------------------------------------------------------------------------------------

const STUDENT_EXPORT_META = {
  seated: {
    title: 'SHUSH · Seated students',
    headers: ['Student No.', 'Name', 'Section', 'Table', 'Table Status', 'Noise Level', 'Started At', 'Duration (min)', 'Sample data'],
  },
  visits: {
    title: 'SHUSH · Student visits',
    headers: ['Student No.', 'Name', 'Section', 'Table', 'Started At', 'Ended At', 'Duration (min)', 'Avg Noise Level', 'Alert', 'Sample data'],
  },
  directory: {
    title: 'SHUSH · Student directory',
    headers: ['Student No.', 'Name', 'Section', 'Status', 'Table', 'Total Visits', 'Avg Noise Level', 'Alerts', 'Last Seen', 'Sample data'],
  },
};

function formatExportTimestamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${localDateKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function shapeStudentExportRows(rows = [], tab = 'seated') {
  if (tab === 'visits') {
    return rows.map((r) => [
      r.studentNo ?? '—',
      r.name ?? '',
      r.section ?? '—',
      r.tableNo != null ? `Table ${r.tableNo}` : '—',
      formatExportTimestamp(r.startedAt),
      formatExportTimestamp(r.endedAt),
      r.durationMinutes ?? 0,
      r.avgLevel ?? '—',
      r.hadAlert ? 'Alert' : 'Quiet',
      r.isSample ? 'Sample' : '',
    ]);
  }
  if (tab === 'directory') {
    return rows.map((r) => [
      r.studentNo ?? '—',
      r.name ?? '',
      r.section ?? '—',
      r.activeSession ? 'Seated' : 'Not seated',
      r.activeSession ? `Table ${r.activeSession.tableNo}` : '—',
      r.totalSessions ?? 0,
      r.avgNoiseLevel ?? '—',
      r.alertCount ?? 0,
      formatExportTimestamp(r.lastSeenAt),
      r.isSample ? 'Sample' : '',
    ]);
  }
  return rows.map((r) => [
    r.studentNo ?? '—',
    r.name ?? '',
    r.section ?? '—',
    r.tableNo != null ? `Table ${r.tableNo}` : '—',
    r.tableStatus ?? '—',
    r.deviceLevel ?? '—',
    formatExportTimestamp(r.startedAt),
    r.durationMinutes ?? 0,
    r.isSample ? 'Sample' : '',
  ]);
}

export function studentsExportFileName(tab, ext, date = new Date()) {
  return `shush-students-${tab || 'seated'}-${localDateKey(date)}.${ext}`;
}

export function studentsCsvText(rows = [], tab = 'seated') {
  const cfg = STUDENT_EXPORT_META[tab] ?? STUDENT_EXPORT_META.seated;
  const lines = shapeStudentExportRows(rows, tab).map((cols) => cols.map(csvCell).join(','));
  return `\uFEFF${[cfg.headers.map(csvCell).join(','), ...lines].join('\r\n')}`;
}

export async function buildStudentsWorkbook(rows = [], meta = {}) {
  const mod = await import('exceljs');
  const ExcelJS = mod.default ?? mod;
  const tab = meta.tab ?? 'seated';
  const cfg = STUDENT_EXPORT_META[tab] ?? STUDENT_EXPORT_META.seated;
  const generatedAt = meta.generatedAt ?? new Date();
  const tableLabel = meta.tableLabel ?? 'All tables';
  const sectionLabel = meta.sectionLabel ?? 'All sections';
  const subtitle = `Table: ${tableLabel} · Section: ${sectionLabel} · Generated ${generatedLabel(generatedAt)}${meta.by ? ` by ${meta.by}` : ''}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = meta.by || 'SHUSH';
  wb.created = generatedAt;

  const ws = wb.addWorksheet('Students', {
    properties: { tabColor: { argb: argb('F25F13') } },
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
  });

  const lastCol = String.fromCharCode(64 + cfg.headers.length);
  cfg.headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = h === 'Name' ? 28 : h.includes('At') || h === 'Last Seen' ? 19 : 15;
  });

  titleRows(ws, lastCol, cfg.title, subtitle);
  ws.getRow(3).height = 8;
  headerRow(ws, 4, cfg.headers);

  const shaped = shapeStudentExportRows(rows, tab);
  shaped.forEach((cols, i) => {
    const row = ws.getRow(5 + i);
    const zebra = i % 2 === 0 ? C.white : C.cream;
    cols.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 10.5, color: { argb: argb(C.ink) } };
      cell.fill = solid(zebra);
      cell.border = BORDER;
      cell.alignment = {
        vertical: 'middle',
        horizontal: typeof val === 'number' ? 'center' : 'left',
        indent: typeof val === 'number' ? 0 : 1,
      };
      if (typeof val === 'number') cell.numFmt = '#,##0';
    });
  });

  ws.autoFilter = { from: 'A4', to: `${lastCol}${4 + Math.max(shaped.length, 1)}` };
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '4:4',
    paperSize: 9,
  };
  ws.headerFooter.oddFooter = '&CSHUSH Students · Page &P of &N';

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadStudentsCsvFile(rows, tab, filename) {
  downloadBlob(new Blob([studentsCsvText(rows, tab)], { type: 'text/csv;charset=utf-8' }), filename);
}
