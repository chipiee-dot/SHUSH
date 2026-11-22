import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import Card from '../../components/Card.jsx';
import { MeterBar } from '../../components/charts.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import '../../components/table-layout.css';
import CountUp from '../../components/CountUp.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SampleBadge from '../../components/SampleBadge.jsx';
import Stat from '../../components/Stat.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import { useErrorToast, useToast } from '../../components/Toast.jsx';
import { NAV_ICONS } from '../../components/navIcons.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useClickOutside from '../../hooks/useClickOutside.js';
import usePolling from '../../hooks/usePolling.js';
import {
  buildStudentsWorkbook,
  downloadBlob,
  downloadStudentsCsvFile,
  studentsExportFileName,
} from '../../lib/exportHistory.js';
import { dateInputValue, formatDateTime, formatNumber, formatTime, timeAgo } from '../../lib/format.js';

const REFRESH_MS = 5000;

const TABS = [
  { value: 'seated', label: 'Seated now' },
  { value: 'visits', label: 'Recent visits' },
  { value: 'directory', label: 'Directory' },
];

const VISIT_RANGES = [
  { value: 'today', label: 'Today', days: 1 },
  { value: 'week', label: 'Last 7 days', days: 7 },
  { value: 'month', label: 'Last 30 days', days: 30 },
  { value: 'all', label: 'All time', days: null },
];

const ICON = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  viewBox: '0 0 24 24',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const UsersIcon = () => (
  <svg {...ICON}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const TableIcon = () => (
  <svg {...ICON}>
    <rect x="3" y="5" width="18" height="6" rx="1.5" />
    <path d="M6 11v8M18 11v8" />
  </svg>
);

const ClockIcon = () => (
  <svg {...ICON}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const DirectoryIcon = () => (
  <svg {...ICON}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const fieldClass =
  'block rounded-xl border-shush-lineStrong bg-shush-white py-2 text-sm text-shush-ink focus:border-shush-orange focus:ring-shush-orange';

function initials(name) {
  const parts = String(name ?? '')
    .replace(/,/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function formatDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function shiftDateStart(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d.getTime();
}

function ratio(part, whole) {
  return whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0;
}

function matchesSearch(item, queryText) {
  if (!queryText) return true;
  const hay = `${item.name ?? ''} ${item.studentNo ?? ''} ${item.section ?? ''} table ${item.tableNo ?? item.activeSession?.tableNo ?? ''}`.toLowerCase();
  return hay.includes(queryText);
}

function StudentDrawer({ student, activeSession, visits, onClose, onEndSession }) {
  const headingRef = useRef(null);
  const [timelineFilter, setTimelineFilter] = useState('all');

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    setTimelineFilter('all');
  }, [student.studentId]);

  const alertVisits = visits.filter((v) => v.hadAlert);
  const shownVisits = timelineFilter === 'alerts' ? alertVisits : visits;

  const level = activeSession?.deviceLevel ?? 0;
  const threshold = activeSession?.deviceThreshold ?? 0;
  const overThreshold = Boolean(
    activeSession && activeSession.deviceThreshold != null && level > threshold
  );
  const meterColor = overThreshold
    ? '--shush-danger'
    : activeSession?.tableStatus === 'LOUD'
      ? '--shush-amber'
      : '--shush-success';

  return (
    <aside
      aria-labelledby="st-drawer-title"
      className="tl-drawer fixed inset-x-0 bottom-0 z-30 max-h-[75vh] overflow-y-auto rounded-t-2xl border border-shush-line bg-shush-white p-5 shadow-[0_-16px_40px_-18px_rgba(242,95,19,0.45)] lg:sticky lg:top-0 lg:z-auto lg:max-h-[calc(100vh-8rem)] lg:w-[25rem] lg:flex-none lg:self-start lg:rounded-2xl lg:shadow-[0_10px_30px_-18px_rgba(242,95,19,0.35)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`grid h-11 w-11 flex-none place-items-center rounded-full text-sm font-bold ${
              activeSession
                ? 'bg-shush-orange text-white'
                : 'bg-shush-goldSoft text-shush-orange700'
            }`}
            aria-hidden="true"
          >
            {initials(student.name)}
          </span>
          <div className="min-w-0">
            <h2
              id="st-drawer-title"
              ref={headingRef}
              tabIndex={-1}
              className="truncate text-lg font-semibold tracking-tight text-shush-ink focus:outline-none"
              title={student.name}
            >
              {student.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-mono text-shush-muted">
                {student.studentNo || `ID #${student.studentId}`}
              </span>
              {student.section && (
                <span className="rounded-full bg-shush-creamDeep px-2 py-0.5 text-[11px] font-semibold text-shush-orange700">
                  {student.section}
                </span>
              )}
              {student.isSample && <SampleBadge />}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close student details"
          className="grid h-9 w-9 flex-none place-items-center rounded-xl border border-shush-lineStrong text-shush-inkSoft transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {activeSession && (
        <div className="mt-4 rounded-xl border border-shush-orange/30 bg-shush-cream p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-shush-ink">
              Seated at Table {activeSession.tableNo}
            </span>
            <StatusPill status={activeSession.tableStatus} />
          </div>
          <div className="mt-1 text-xs text-shush-inkSoft tabular-nums">
            Started {formatTime(activeSession.startedAt)} · {formatDuration(activeSession.durationMinutes)} seated
          </div>

          {activeSession.deviceLevel != null && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px] text-shush-inkSoft">
                <span>Live table noise</span>
                <span className="tabular-nums">
                  {formatNumber(level)}
                  {activeSession.deviceThreshold != null ? ` / ${formatNumber(threshold)}` : ''}
                </span>
              </div>
              <MeterBar
                value={level}
                max={Math.max(threshold * 1.5, level * 1.1, 1)}
                markerAt={activeSession.deviceThreshold == null ? undefined : threshold}
                colorVar={meterColor}
                label={`Table ${activeSession.tableNo} live noise level`}
              />
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={`/console/layout?table=${activeSession.tableNo}`}
              className="rounded-xl border border-shush-lineStrong bg-shush-white px-3 py-1.5 text-xs font-semibold text-shush-ink transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
            >
              View table
            </Link>
            <button
              type="button"
              onClick={() => onEndSession(activeSession)}
              className="rounded-xl border border-shush-danger/30 bg-shush-dangerSoft/70 px-3 py-1.5 text-xs font-semibold text-shush-danger transition hover:bg-shush-danger hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-danger"
            >
              End session
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-shush-line bg-shush-cream/60 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-shush-muted">
            Quiet streak
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-shush-ink tabular-nums">
            {formatNumber(student.quietStreak ?? 0)}{' '}
            <span className="text-xs font-medium text-shush-inkSoft">in a row</span>
          </div>
          <div className="text-[11px] text-shush-muted">Sessions without an alert</div>
        </div>

        <div className="rounded-xl border border-shush-line bg-shush-cream/60 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-shush-muted">
            Total visits
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-shush-ink tabular-nums">
            {formatNumber(student.totalSessions)}
          </div>
          <div className="text-[11px] text-shush-muted tabular-nums">
            {formatDuration(student.totalMinutes ?? 0)} total
          </div>
        </div>

        <div className="rounded-xl border border-shush-line bg-shush-cream/60 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-shush-muted">
            Avg noise level
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-shush-ink tabular-nums">
            {student.avgNoiseLevel != null ? formatNumber(student.avgNoiseLevel) : '—'}
          </div>
          <div className="text-[11px] text-shush-muted">Across completed visits</div>
        </div>

        <div className="rounded-xl border border-shush-line bg-shush-cream/60 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-shush-muted">
            Alerts & top table
          </div>
          <div
            className={`mt-1 text-lg font-semibold tracking-tight tabular-nums ${
              (student.alertCount ?? 0) > 0 ? 'text-shush-danger' : 'text-shush-ink'
            }`}
          >
            {formatNumber(student.alertCount ?? 0)}{' '}
            <span className="text-xs font-medium text-shush-inkSoft">
              alert{(student.alertCount ?? 0) === 1 ? '' : 's'}
            </span>
          </div>
          <div className="text-[11px] text-shush-muted">
            {student.favoriteTableNo != null ? `Top: Table ${student.favoriteTableNo}` : 'No table yet'}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-shush-muted">
            Visit & alert timeline
          </h3>
          {alertVisits.length > 0 && (
            <div
              role="group"
              aria-label="Filter student timeline"
              className="inline-flex rounded-lg border border-shush-lineStrong bg-shush-cream p-0.5 text-[11px] font-semibold"
            >
              <button
                type="button"
                aria-pressed={timelineFilter === 'all'}
                onClick={() => setTimelineFilter('all')}
                className={`rounded-md px-2 py-0.5 transition ${
                  timelineFilter === 'all'
                    ? 'bg-shush-orange text-white'
                    : 'text-shush-inkSoft hover:text-shush-ink'
                }`}
              >
                All ({formatNumber(visits.length)})
              </button>
              <button
                type="button"
                aria-pressed={timelineFilter === 'alerts'}
                onClick={() => setTimelineFilter('alerts')}
                className={`rounded-md px-2 py-0.5 transition ${
                  timelineFilter === 'alerts'
                    ? 'bg-shush-danger text-white'
                    : 'text-shush-inkSoft hover:text-shush-ink'
                }`}
              >
                Alerts ({formatNumber(alertVisits.length)})
              </button>
            </div>
          )}
        </div>

        {shownVisits.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-shush-lineStrong bg-shush-cream px-3 py-4 text-center text-xs text-shush-muted">
            No library visits recorded yet.
          </p>
        ) : (
          <ol className="mt-3 max-h-72 space-y-0 overflow-y-auto pr-1">
            {shownVisits.map((v, i) => {
              const last = i === shownVisits.length - 1;
              const dotColor = v.inProgress
                ? 'bg-shush-orange ring-shush-orange/30'
                : v.hadAlert
                  ? 'bg-shush-danger ring-shush-danger/30'
                  : 'bg-shush-success ring-shush-success/30';
              return (
                <li key={`${v.sessionId}-${i}`} className={`relative pl-5 ${last ? '' : 'pb-4'}`}>
                  {!last && (
                    <span
                      className="absolute bottom-0 left-[4px] top-3 w-px bg-shush-lineStrong"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`absolute left-0 top-1.5 h-[9px] w-[9px] rounded-full border border-shush-white ring-2 ${dotColor}`}
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <Link
                      to={`/console/layout?table=${v.tableNo}`}
                      className="font-semibold text-shush-ink underline-offset-2 hover:text-shush-orange700 hover:underline"
                    >
                      Table {v.tableNo}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        v.inProgress
                          ? 'bg-shush-goldSoft text-shush-orange700'
                          : v.hadAlert
                            ? 'bg-shush-dangerSoft text-shush-danger'
                            : 'bg-shush-successSoft text-shush-success'
                      }`}
                    >
                      {v.inProgress ? 'In progress' : v.hadAlert ? 'Alert triggered' : 'Quiet session'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-shush-muted">
                    {formatDateTime(v.startedAt)} – {v.inProgress ? 'Now' : formatTime(v.endedAt)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-shush-inkSoft tabular-nums">
                    {formatDuration(v.durationMinutes)}
                    {v.avgLevel != null ? ` · Avg level ${formatNumber(v.avgLevel)}` : ''}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>
  );
}

export default function Students() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const urlTable = searchParams.get('table');

  const [tab, setTab] = useState('seated');
  const [query, setQuery] = useState('');
  const [tableNo, setTableNo] = useState(() =>
    urlTable && Number(urlTable) > 0 ? String(Number(urlTable)) : 'all'
  );
  const [section, setSection] = useState('all');
  const [visitRange, setVisitRange] = useState('week');
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [endingBusy, setEndingBusy] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState('');
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    if (urlTable && Number(urlTable) > 0) {
      setTableNo(String(Number(urlTable)));
    }
  }, [urlTable]);

  useEffect(() => {
    if (selectedStudentId === null || confirmTarget) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setSelectedStudentId(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedStudentId, confirmTarget]);

  const toggleStudent = (studentId) => {
    setSelectedStudentId((cur) => (cur === studentId ? null : studentId));
  };

  const { data, error, loading, updatedAt, reload } = usePolling(api.students, REFRESH_MS);
  useErrorToast(error);
  const layout = usePolling(api.layout, 60000);

  const tableOptions = useMemo(() => {
    const nums = new Set((layout.data?.tables ?? []).map((t) => t.tableNo));
    for (const s of data?.activeSessions ?? []) nums.add(s.tableNo);
    for (const v of data?.completedSessions ?? []) nums.add(v.tableNo);
    return [...nums].filter((n) => n != null).sort((a, b) => a - b);
  }, [layout.data, data]);

  const summary = data?.summary ?? {
    seatedNow: 0,
    tablesOccupied: 0,
    tablesTotal: tableOptions.length,
    visitsToday: 0,
    uniqueStudentsToday: 0,
    totalRegistered: 0,
    sections: [],
  };

  const searchClean = query.trim().toLowerCase();
  const targetTable = tableNo === 'all' ? null : Number(tableNo);

  const filteredSeated = useMemo(() => {
    return (data?.activeSessions ?? []).filter((s) => {
      if (targetTable !== null && s.tableNo !== targetTable) return false;
      if (section !== 'all' && s.section !== section) return false;
      return matchesSearch(s, searchClean);
    });
  }, [data, targetTable, section, searchClean]);

  const filteredVisits = useMemo(() => {
    const rangeMeta = VISIT_RANGES.find((r) => r.value === visitRange);
    const minMs = rangeMeta?.days ? shiftDateStart(rangeMeta.days) : null;
    return (data?.completedSessions ?? []).filter((v) => {
      if (minMs !== null && new Date(v.startedAt).getTime() < minMs) return false;
      if (targetTable !== null && v.tableNo !== targetTable) return false;
      if (section !== 'all' && v.section !== section) return false;
      return matchesSearch(v, searchClean);
    });
  }, [data, visitRange, targetTable, section, searchClean]);

  const filteredDirectory = useMemo(() => {
    return (data?.directory ?? []).filter((st) => {
      if (targetTable !== null && st.activeSession?.tableNo !== targetTable) return false;
      if (section !== 'all' && st.section !== section) return false;
      return matchesSearch(st, searchClean);
    });
  }, [data, targetTable, section, searchClean]);

  const tabCounts = {
    seated: filteredSeated.length,
    visits: filteredVisits.length,
    directory: filteredDirectory.length,
  };

  const activeRows =
    tab === 'seated' ? filteredSeated : tab === 'visits' ? filteredVisits : filteredDirectory;

  const selectedStudent = useMemo(
    () => (data?.directory ?? []).find((d) => d.studentId === selectedStudentId) ?? null,
    [data, selectedStudentId]
  );
  const selectedActive = useMemo(
    () => (data?.activeSessions ?? []).find((s) => s.studentId === selectedStudentId) ?? null,
    [data, selectedStudentId]
  );
  const selectedVisits = useMemo(() => {
    if (!selectedStudent) return [];
    const completed = (data?.completedSessions ?? []).filter((v) => v.studentId === selectedStudent.studentId);
    return selectedActive ? [{ ...selectedActive, inProgress: true }, ...completed] : completed;
  }, [data, selectedStudent, selectedActive]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(menuRef, menuOpen, closeMenu);

  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector('[role="menuitem"]')?.focus();
  }, [menuOpen]);

  function onMenuKey(e) {
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus();
    else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length]?.focus();
    else if (e.key === 'Home') items[0]?.focus();
    else if (e.key === 'End') items[items.length - 1]?.focus();
    else if (e.key === 'Escape') {
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    } else return;
    e.preventDefault();
  }

  async function exportStudents(type) {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
    if (activeRows.length === 0) {
      toast.error('Nothing to export for these filters.');
      return;
    }
    setExporting(type);
    try {
      const filename = studentsExportFileName(tab, type);
      if (type === 'xlsx') {
        const blob = await buildStudentsWorkbook(activeRows, {
          tab,
          tableLabel: tableNo === 'all' ? 'All tables' : `Table ${tableNo}`,
          sectionLabel: section === 'all' ? 'All sections' : section,
          by: user ? `${user.firstName} ${user.lastName}`.trim() : '',
          generatedAt: new Date(),
        });
        downloadBlob(blob, filename);
      } else {
        downloadStudentsCsvFile(activeRows, tab, filename);
      }
      toast.success('Student list exported.');
    } catch {
      toast.error('Could not prepare the export.');
    } finally {
      setExporting('');
    }
  }

  async function handleEndSession() {
    if (!confirmTarget) return;
    setEndingBusy(true);
    try {
      const res = await api.endStudentSession(confirmTarget.studentId);
      toast.success(res.message || `Ended ${confirmTarget.name}'s session.`);
      setConfirmTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEndingBusy(false);
    }
  }

  const hasFilters = query.trim() !== '' || tableNo !== 'all' || section !== 'all';
  const clearFilters = () => {
    setQuery('');
    setTableNo('all');
    setSection('all');
  };

  if (!data && !loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Students"
          icon={NAV_ICONS.students}
          subtitle="Live · students logged in to the library and the tables they chose"
        />
        <EmptyState
          title="Student list unavailable"
          text="Check your connection, then try again."
          action={
            <button
              type="button"
              onClick={reload}
              className="rounded-xl border border-shush-lineStrong bg-shush-white px-4 py-2 text-sm font-medium text-shush-ink transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
            >
              Try again
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        icon={NAV_ICONS.students}
        sample={data?.sample}
        subtitle={
          updatedAt
            ? `Live · updated ${formatTime(updatedAt)} · students logged in to the library and the tables they chose`
            : 'Live · students logged in to the library and the tables they chose'
        }
      >
        <div ref={menuRef} className="relative">
          <button
            ref={menuButtonRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            disabled={Boolean(exporting) || !data}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-shush-orange600 px-4 py-2.5 text-base font-semibold text-white shadow-md transition hover:bg-shush-orange700 active:bg-shush-orange700 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
          >
            {exporting ? 'Preparing…' : 'Export'}
            {!exporting && (
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          {menuOpen && (
            <div
              role="menu"
              aria-label="Export format"
              onKeyDown={onMenuKey}
              className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-shush-line bg-shush-white p-1.5 shadow-[0_16px_36px_-18px_rgba(242,95,19,0.5)]"
            >
              {[
                ['xlsx', 'Excel report (.xlsx)', 'Formatted table for the active tab'],
                ['csv', 'CSV (.csv)', 'Plain data for other tools'],
              ].map(([type, title, hint]) => (
                <button
                  key={type}
                  type="button"
                  role="menuitem"
                  onClick={() => exportStudents(type)}
                  className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-shush-creamDeep focus:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
                >
                  <span className="block text-sm font-semibold text-shush-ink">{title}</span>
                  <span className="block text-xs text-shush-inkSoft">{hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          icon={<UsersIcon />}
          label="Seated right now"
          value={summary.seatedNow}
          hint={`${formatNumber(summary.tablesOccupied)} table${summary.tablesOccupied === 1 ? '' : 's'} in use`}
        />
        <Stat
          icon={<TableIcon />}
          label="Tables with students"
          value={
            <>
              <CountUp value={summary.tablesOccupied} />
              <span className="text-shush-muted"> / {formatNumber(summary.tablesTotal)}</span>
            </>
          }
          progress={ratio(summary.tablesOccupied, summary.tablesTotal)}
          hint="Tables currently occupied"
        />
        <Stat
          icon={<ClockIcon />}
          label="Visits today"
          value={summary.visitsToday}
          hint={`${formatNumber(summary.uniqueStudentsToday)} unique student${summary.uniqueStudentsToday === 1 ? '' : 's'} today`}
        />
        <Stat
          icon={<DirectoryIcon />}
          label="Registered students"
          value={summary.totalRegistered}
          hint={`${formatNumber(summary.sections.length)} section${summary.sections.length === 1 ? '' : 's'}`}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Student views"
            className="inline-flex flex-wrap gap-1 rounded-xl border border-shush-lineStrong bg-shush-cream p-1"
          >
            {TABS.map((t) => {
              const active = tab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.value)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange ${
                    active
                      ? 'bg-shush-orange text-white shadow-sm'
                      : 'text-shush-inkSoft hover:bg-shush-creamDeep hover:text-shush-ink'
                  }`}
                >
                  {t.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums leading-none ${
                      active ? 'bg-white/20 text-white' : 'bg-shush-white text-shush-muted'
                    }`}
                  >
                    {formatNumber(tabCounts[t.value])}
                  </span>
                </button>
              );
            })}
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-shush-orange700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3">
          <label className="relative block min-w-[14rem] flex-1 sm:max-w-sm">
            <span className="block text-sm font-medium text-shush-inkSoft">Search student</span>
            <div className="relative mt-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-shush-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, student no. or section"
                className={`${fieldClass} w-full pl-9 pr-3`}
              />
            </div>
          </label>

          <label className="block text-sm font-medium text-shush-inkSoft">
            Table
            <select
              className={`${fieldClass} mt-1 w-full min-w-[10rem] sm:w-44`}
              value={tableNo}
              onChange={(e) => setTableNo(e.target.value)}
            >
              <option value="all">All tables</option>
              {tableOptions.map((no) => (
                <option key={no} value={String(no)}>
                  Table {no}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-shush-inkSoft">
            Section
            <select
              className={`${fieldClass} mt-1 w-full min-w-[10rem] sm:w-44`}
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="all">All sections</option>
              {summary.sections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </label>
        </div>

        {tab === 'visits' && (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Visit date range">
            {VISIT_RANGES.map((r) => {
              const active = visitRange === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setVisitRange(r.value)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange ${
                    active
                      ? 'border-shush-orange600 bg-shush-orange600 text-white'
                      : 'border-shush-lineStrong bg-shush-white text-shush-inkSoft hover:bg-shush-creamDeep'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="min-w-0 flex-1">
          {!data ? (
            <Card>
              <p className="py-6 text-sm text-shush-muted">Loading students…</p>
            </Card>
          ) : tab === 'seated' ? (
            <Card
              title="Seated now"
              subtitle="Students currently logged in to a library table. Click a student for details. Updates every 5 seconds."
            >
              {filteredSeated.length === 0 ? (
                <EmptyState
                  title={hasFilters ? 'No seated students match' : 'No students seated right now'}
                  text={
                    hasFilters
                      ? 'Try clearing your search or table/section filters.'
                      : 'When a student signs in on the kiosk and chooses a table, they will appear here.'
                  }
                />
              ) : (
                <ul className="divide-y divide-shush-line overflow-hidden rounded-xl border border-shush-line bg-shush-white">
                  {filteredSeated.map((s) => {
                    const isSelected = selectedStudentId === s.studentId;
                    return (
                      <li
                        key={`${s.sessionId}-${s.studentId}`}
                        onClick={() => toggleStudent(s.studentId)}
                        className={`flex cursor-pointer flex-wrap items-center justify-between gap-4 px-4 py-3.5 transition-colors ${
                          isSelected ? 'bg-shush-goldSoft/50' : 'hover:bg-shush-cream/50'
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3.5 basis-64">
                          <span
                            className="grid h-11 w-11 flex-none place-items-center rounded-full bg-shush-goldSoft text-sm font-bold text-shush-orange700"
                            aria-hidden="true"
                          >
                            {initials(s.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-semibold text-shush-ink">{s.name}</span>
                              {s.section && (
                                <span className="rounded-full bg-shush-creamDeep px-2 py-0.5 text-[11px] font-semibold text-shush-orange700">
                                  {s.section}
                                </span>
                              )}
                              {s.isSample && <SampleBadge />}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-shush-muted">
                              <span className="font-mono">{s.studentNo || `ID #${s.studentId}`}</span>
                              <span>·</span>
                              <span>Started {formatTime(s.startedAt)}</span>
                              <span>·</span>
                              <span className="font-medium text-shush-inkSoft tabular-nums">
                                {formatDuration(s.durationMinutes)} seated
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex flex-col items-start sm:items-end">
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/console/layout?table=${s.tableNo}`}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-lg bg-shush-goldSoft px-2.5 py-1 text-xs font-semibold text-shush-orange700 transition hover:bg-shush-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
                              >
                                Table {s.tableNo}
                              </Link>
                              <StatusPill status={s.tableStatus} />
                            </div>
                            {s.deviceLevel != null && (
                              <span className="mt-1 text-[11px] text-shush-muted tabular-nums">
                                Noise {formatNumber(s.deviceLevel)}
                                {s.deviceThreshold != null ? ` / ${formatNumber(s.deviceThreshold)}` : ''}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-expanded={isSelected}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStudent(s.studentId);
                              }}
                              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange ${
                                isSelected
                                  ? 'border-shush-orange bg-shush-orange text-white'
                                  : 'border-shush-lineStrong bg-shush-white text-shush-ink hover:bg-shush-creamDeep'
                              }`}
                            >
                              {isSelected ? 'Hide' : 'Details'}
                            </button>
                            <Link
                              to={`/console/layout?table=${s.tableNo}`}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-xl border border-shush-lineStrong bg-shush-white px-3 py-1.5 text-xs font-semibold text-shush-ink transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
                            >
                              View table
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmTarget(s);
                              }}
                              className="rounded-xl border border-shush-danger/30 bg-shush-dangerSoft/60 px-3 py-1.5 text-xs font-semibold text-shush-danger transition hover:bg-shush-danger hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-danger"
                            >
                              End session
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ) : tab === 'visits' ? (
            <Card
              title="Recent visits"
              subtitle="Completed library sessions with chosen table, duration, average noise level and alert record. Click a row for full history."
            >
              {filteredVisits.length === 0 ? (
                <EmptyState
                  title="No completed visits"
                  text={
                    hasFilters
                      ? 'No visits match these filters.'
                      : 'Try expanding the date range to see earlier library visits.'
                  }
                />
              ) : (
                <ul className="divide-y divide-shush-line overflow-hidden rounded-xl border border-shush-line bg-shush-white">
                  {filteredVisits.map((v) => {
                    const isSelected = selectedStudentId === v.studentId;
                    return (
                      <li
                        key={`${v.sessionId}-${v.studentId}`}
                        onClick={() => toggleStudent(v.studentId)}
                        className={`flex cursor-pointer flex-wrap items-center justify-between gap-4 px-4 py-3 transition-colors ${
                          isSelected ? 'bg-shush-goldSoft/50' : 'hover:bg-shush-cream/50'
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3.5 basis-64">
                          <span
                            className="grid h-10 w-10 flex-none place-items-center rounded-full bg-shush-creamDeep text-xs font-bold text-shush-inkSoft"
                            aria-hidden="true"
                          >
                            {initials(v.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-semibold text-shush-ink">{v.name}</span>
                              {v.section && (
                                <span className="rounded-full bg-shush-creamDeep px-2 py-0.5 text-[11px] font-semibold text-shush-orange700">
                                  {v.section}
                                </span>
                              )}
                              {v.isSample && <SampleBadge />}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-shush-muted">
                              {v.studentNo && (
                                <>
                                  <span className="font-mono">{v.studentNo}</span>
                                  <span>·</span>
                                </>
                              )}
                              <span>
                                {dateInputValue(new Date(v.startedAt)) === dateInputValue()
                                  ? `Today, ${formatTime(v.startedAt)} – ${formatTime(v.endedAt)}`
                                  : `${formatDateTime(v.startedAt)} – ${formatTime(v.endedAt)}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 text-xs">
                          <Link
                            to={`/console/layout?table=${v.tableNo}`}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-lg bg-shush-goldSoft px-2.5 py-1 font-semibold text-shush-orange700 transition hover:bg-shush-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
                          >
                            Table {v.tableNo}
                          </Link>
                          <span className="rounded-full border border-shush-line bg-shush-cream px-2.5 py-0.5 font-medium text-shush-ink tabular-nums">
                            {formatDuration(v.durationMinutes)}
                          </span>
                          <span className="rounded-full border border-shush-line bg-shush-white px-2.5 py-0.5 font-medium text-shush-inkSoft tabular-nums">
                            Avg level {v.avgLevel != null ? formatNumber(v.avgLevel) : '—'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold ${
                              v.hadAlert
                                ? 'border-shush-danger/30 bg-shush-dangerSoft text-shush-danger'
                                : 'border-shush-success/30 bg-shush-successSoft text-shush-success'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${v.hadAlert ? 'bg-shush-danger' : 'bg-shush-success'}`}
                              aria-hidden="true"
                            />
                            {v.hadAlert ? 'Alert triggered' : 'Quiet session'}
                          </span>
                          <button
                            type="button"
                            aria-expanded={isSelected}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStudent(v.studentId);
                            }}
                            className={`rounded-xl border px-3 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange ${
                              isSelected
                                ? 'border-shush-orange bg-shush-orange text-white'
                                : 'border-shush-lineStrong bg-shush-white text-shush-ink hover:bg-shush-creamDeep'
                            }`}
                          >
                            {isSelected ? 'Hide' : 'Details'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ) : (
            <Card
              title="Registered students"
              subtitle="All student accounts registered for library table check-ins. Click a student for their visit & alert timeline."
            >
              {filteredDirectory.length === 0 ? (
                <EmptyState
                  title="No registered students match"
                  text={
                    hasFilters
                      ? 'Try clearing your search or table/section filters.'
                      : 'Students who sign up on the student kiosk will appear here.'
                  }
                />
              ) : (
                <ul className="divide-y divide-shush-line overflow-hidden rounded-xl border border-shush-line bg-shush-white">
                  {filteredDirectory.map((st) => {
                    const isSelected = selectedStudentId === st.studentId;
                    return (
                      <li
                        key={st.studentId}
                        onClick={() => toggleStudent(st.studentId)}
                        className={`flex cursor-pointer flex-wrap items-center justify-between gap-4 px-4 py-3 transition-colors ${
                          isSelected ? 'bg-shush-goldSoft/50' : 'hover:bg-shush-cream/50'
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3.5 basis-64">
                          <span
                            className={`grid h-10 w-10 flex-none place-items-center rounded-full text-xs font-bold ${
                              st.activeSession
                                ? 'bg-shush-orange text-white'
                                : 'bg-shush-creamDeep text-shush-inkSoft'
                            }`}
                            aria-hidden="true"
                          >
                            {initials(st.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-semibold text-shush-ink">{st.name}</span>
                              {st.section && (
                                <span className="rounded-full bg-shush-creamDeep px-2 py-0.5 text-[11px] font-semibold text-shush-orange700">
                                  {st.section}
                                </span>
                              )}
                              {st.isSample && <SampleBadge />}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-shush-muted">
                              <span className="font-mono">{st.studentNo || `ID #${st.studentId}`}</span>
                              {st.lastSeenAt && (
                                <>
                                  <span>·</span>
                                  <span>Last seen {timeAgo(st.lastSeenAt)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 text-xs">
                          {st.activeSession ? (
                            <Link
                              to={`/console/layout?table=${st.activeSession.tableNo}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 rounded-full border border-shush-orange/40 bg-shush-goldSoft px-2.5 py-0.5 font-semibold text-shush-orange700 transition hover:bg-shush-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-shush-orange" aria-hidden="true" />
                              Seated at Table {st.activeSession.tableNo}
                            </Link>
                          ) : (
                            <span className="rounded-full border border-shush-line bg-shush-cream px-2.5 py-0.5 font-medium text-shush-muted">
                              Not seated
                            </span>
                          )}
                          <span className="rounded-full border border-shush-line bg-shush-white px-2.5 py-0.5 font-medium text-shush-ink tabular-nums">
                            {formatNumber(st.totalSessions)} visit{st.totalSessions === 1 ? '' : 's'}
                          </span>
                          <span className="rounded-full border border-shush-line bg-shush-white px-2.5 py-0.5 font-medium text-shush-inkSoft tabular-nums">
                            Avg level {st.avgNoiseLevel != null ? formatNumber(st.avgNoiseLevel) : '—'}
                          </span>
                          <button
                            type="button"
                            aria-expanded={isSelected}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStudent(st.studentId);
                            }}
                            className={`rounded-xl border px-3 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange ${
                              isSelected
                                ? 'border-shush-orange bg-shush-orange text-white'
                                : 'border-shush-lineStrong bg-shush-white text-shush-ink hover:bg-shush-creamDeep'
                            }`}
                          >
                            {isSelected ? 'Hide' : 'Details'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}
        </div>

        {selectedStudent && (
          <StudentDrawer
            student={selectedStudent}
            activeSession={selectedActive}
            visits={selectedVisits}
            onClose={() => setSelectedStudentId(null)}
            onEndSession={(session) => setConfirmTarget(session)}
          />
        )}
      </div>

      {selectedStudent && <div className="h-[55vh] lg:hidden" aria-hidden="true" />}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={`End ${confirmTarget?.name ?? 'student'}'s session?`}
        tone="danger"
        confirmLabel="End session"
        cancelLabel="Keep seated"
        busy={endingBusy}
        onConfirm={handleEndSession}
        onCancel={() => setConfirmTarget(null)}
      >
        {confirmTarget
          ? `This will check ${confirmTarget.name} out of Table ${confirmTarget.tableNo} right away and free up their seat.`
          : null}
      </ConfirmDialog>
    </div>
  );
}
