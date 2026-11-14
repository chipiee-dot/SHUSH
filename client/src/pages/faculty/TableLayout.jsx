import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Alert from '../../components/Alert.jsx';
import Card from '../../components/Card.jsx';
import { DonutChart } from '../../components/charts.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import GlowButton from '../../components/GlowButton.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import TableDrawer from '../../components/TableDrawer.jsx';
import TableTile from '../../components/TableTile.jsx';
import usePolling from '../../hooks/usePolling.js';
import { STATUS_META, formatTime } from '../../lib/format.js';
import '../../components/table-layout.css';

const REFRESH_MS = 5000;
const ROW_HEIGHT = '6.5rem';
const STATUS_ORDER = ['QUIET', 'LOUD', 'ALERT', 'MAINTENANCE', 'OFFLINE', 'NO_DEVICE'];
const EMPTY_FORM = { tableNo: '', seats: '4' };

const PRIMARY_BTN =
  'rounded-xl bg-shush-orange600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-shush-orange700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-shush-orange focus:ring-offset-2';
const INPUT =
  'mt-1 block w-full rounded-xl border-shush-lineStrong bg-shush-white text-sm text-shush-ink focus:border-shush-orange focus:ring-shush-orange';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Seats taken (with a small ring) and status chips that double as filters. */
function SummaryStrip({ seatedTotal, seatTotal, counts, filter, onFilter }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-center gap-3">
          <DonutChart
            size={56}
            thickness={8}
            segments={[
              { key: 'taken', label: 'Seats taken', value: seatedTotal, color: 'var(--shush-orange)' },
              { key: 'free', label: 'Seats free', value: Math.max(0, seatTotal - seatedTotal), color: 'var(--shush-gold)' },
            ]}
          />
          <div>
            <div className="text-2xl font-semibold leading-none tracking-tight text-shush-ink">
              {seatedTotal} <span className="text-base font-medium text-shush-inkSoft">of {seatTotal}</span>
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-shush-muted">Seats taken</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" role="group" aria-label="Filter tables by status">
          {STATUS_ORDER.map((key) => {
            const meta = STATUS_META[key];
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                disabled={counts[key] === 0}
                onClick={() => onFilter(active ? null : key)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-1 disabled:opacity-50 ${meta.pill} ${
                  active ? 'ring-2 ring-shush-orange ring-offset-1' : ''
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                {meta.label}
                <span className="tabular-nums">{counts[key]}</span>
              </button>
            );
          })}
          {filter && (
            <button
              type="button"
              onClick={() => onFilter(null)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-shush-orange700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
            >
              Show all
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function AddTableModal({ busy, error, form, onChange, onSubmit, onClose }) {
  const dialogRef = useRef(null);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = dialogRef.current.querySelectorAll('input, button:not([disabled])');
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-shush-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tl-add-title"
        onKeyDown={onKeyDown}
        className="tl-modal w-full max-w-md rounded-2xl border border-shush-line bg-shush-white p-6 shadow-2xl"
      >
        <h2 id="tl-add-title" className="text-lg font-semibold tracking-tight text-shush-ink">
          Add a new table
        </h2>
        <p className="mt-0.5 text-xs text-shush-inkSoft">The table is placed automatically on the floor plan.</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <Alert>{error}</Alert>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-shush-inkSoft">
              Table number <span className="text-shush-danger">*</span>
              <input
                ref={firstRef}
                type="number"
                min={1}
                max={999}
                required
                value={form.tableNo}
                onChange={(e) => onChange({ tableNo: e.target.value })}
                className={INPUT}
                placeholder="e.g. 12"
              />
            </label>
            <label className="text-sm font-medium text-shush-inkSoft">
              Seats <span className="text-shush-danger">*</span>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={form.seats}
                onChange={(e) => onChange({ seats: e.target.value })}
                className={INPUT}
                placeholder="e.g. 6"
              />
            </label>
          </div>
          <div className="flex gap-3">
            <GlowButton type="submit" disabled={busy} className={PRIMARY_BTN}>
              {busy ? 'Adding…' : 'Add table'}
            </GlowButton>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-shush-lineStrong px-4 py-2.5 text-sm font-medium text-shush-orange700 transition hover:bg-shush-creamDeep disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-shush-orange focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TableLayout() {
  const { user } = useAuth();
  const { data, error, loading, updatedAt } = usePolling(api.layout, REFRESH_MS);
  const isSmall = useMediaQuery('(max-width: 767px)');
  const [view, setView] = useState(() => (window.matchMedia('(max-width: 767px)').matches ? 'list' : 'plan'));
  const [selectedNo, setSelectedNo] = useState(null);
  const [filter, setFilter] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [addError, setAddError] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  const tileRefs = useRef(new Map());
  const canvasRef = useRef(null);
  const openerRef = useRef(null);

  const isAdmin = user?.role === 'Admin';

  const closeDrawer = useCallback(() => {
    const no = selectedNo;
    setSelectedNo(null);
    requestAnimationFrame(() => tileRefs.current.get(no)?.focus());
  }, [selectedNo]);

  // Esc closes the drawer. The add-table modal handles its own Esc first.
  useEffect(() => {
    if (selectedNo === null || showAdd) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') closeDrawer();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedNo, showAdd, closeDrawer]);

  function openAdd() {
    openerRef.current = document.activeElement;
    setAddError('');
    setShowAdd(true);
  }

  function closeAdd() {
    setShowAdd(false);
    setAddError('');
    setForm(EMPTY_FORM);
    const opener = openerRef.current;
    requestAnimationFrame(() => {
      if (opener && document.contains(opener)) opener.focus();
    });
  }

  async function handleAddTable(e) {
    e.preventDefault();
    setAddError('');
    setAddBusy(true);
    try {
      await api.addTable({ tableNo: form.tableNo, seats: form.seats });
      closeAdd();
      // The new table appears on the next poll.
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddBusy(false);
    }
  }

  // Dot-grid spotlight: write the pointer position straight to CSS variables (no re-render).
  function onCanvasMove(e) {
    if (e.pointerType !== 'mouse') return;
    const el = canvasRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }

  if (!data) {
    return loading ? (
      <p className="text-sm text-shush-inkSoft">Loading floor plan…</p>
    ) : (
      <Alert>{error || 'Could not load the table layout.'}</Alert>
    );
  }

  const { tables, sample } = data;
  const selected = tables.find((t) => t.tableNo === selectedNo) ?? null;
  const seatedTotal = tables.reduce((sum, t) => sum + t.occupancy.groupSize, 0);
  const seatTotal = tables.reduce((sum, t) => sum + t.seats, 0);
  const counts = Object.fromEntries(STATUS_ORDER.map((k) => [k, tables.filter((t) => t.status === k).length]));
  // A filter whose status no longer exists (after a refresh) is ignored rather than dimming everything.
  const activeFilter = filter && counts[filter] > 0 ? filter : null;
  const showList = isSmall && view === 'list';

  const onSelect = (no) => setSelectedNo((cur) => (cur === no ? null : no));
  const setTileRef = (no) => (el) => {
    if (el) tileRefs.current.set(no, el);
    else tileRefs.current.delete(no);
  };
  const renderTile = (t, variant) => (
    <TableTile
      key={t.tableNo}
      ref={setTileRef(t.tableNo)}
      table={t}
      variant={variant}
      selected={t.tableNo === selectedNo}
      dimmed={activeFilter !== null && t.status !== activeFilter}
      onSelect={onSelect}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Table layout" sample={sample} subtitle={`Live · updated ${formatTime(updatedAt)}`}>
        {isAdmin && (
          <GlowButton onClick={openAdd} className={PRIMARY_BTN}>
            Add table
          </GlowButton>
        )}
      </PageHeader>

      {error && <Alert>{error}</Alert>}

      <SummaryStrip
        seatedTotal={seatedTotal}
        seatTotal={seatTotal}
        counts={counts}
        filter={activeFilter}
        onFilter={setFilter}
      />
      <p className="sr-only" role="status">
        {activeFilter ? `Showing ${STATUS_META[activeFilter].label} tables: ${counts[activeFilter]} of ${tables.length}` : ''}
      </p>

      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="min-w-0 flex-1">
          <Card>
            {tables.length === 0 ? (
              <EmptyState
                title="No tables yet"
                text={isAdmin ? 'Add the first table to start the floor plan.' : 'An admin needs to set up the tables first.'}
                action={isAdmin && <GlowButton onClick={openAdd} className={PRIMARY_BTN}>Add table</GlowButton>}
              />
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
                  <span className="text-xs font-semibold uppercase tracking-wider text-shush-muted">View</span>
                  <div className="inline-flex rounded-xl border border-shush-lineStrong p-0.5" role="group" aria-label="Table view">
                    {[
                      ['plan', 'Floor plan'],
                      ['list', 'List'],
                    ].map(([key, text]) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={view === key}
                        onClick={() => setView(key)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange ${
                          view === key ? 'bg-shush-orange600 text-white' : 'text-shush-inkSoft hover:bg-shush-creamDeep'
                        }`}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>

                {showList ? (
                  <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Tables">
                    {[...tables].sort((a, b) => a.tableNo - b.tableNo).map((t) => renderTile(t, 'list'))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div
                      ref={canvasRef}
                      onPointerMove={onCanvasMove}
                      className="tl-canvas grid min-w-[700px] grid-cols-12 gap-3 p-3"
                      style={{ gridAutoRows: ROW_HEIGHT }}
                      role="group"
                      aria-label="Floor plan"
                    >
                      {tables.map((t) => renderTile(t, 'plan'))}
                    </div>
                  </div>
                )}
              </>
            )}
            <p className="mt-4 text-xs text-shush-inkSoft">
              Select a table to see its details. Filled chairs are students currently seated.
              {isAdmin && (
                <>
                  {' '}
                  <Link
                    to="/console/settings"
                    className="rounded font-medium text-shush-orange700 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-shush-orange focus:ring-offset-1"
                  >
                    Edit seat counts in Settings
                  </Link>
                  .
                </>
              )}
            </p>
          </Card>
        </div>

        {selected && <TableDrawer table={selected} isAdmin={isAdmin} onClose={closeDrawer} />}
      </div>

      {/* Keeps the last tiles reachable above the bottom sheet on small screens. */}
      {selected && <div className="h-[55vh] lg:hidden" aria-hidden="true" />}

      {showAdd && (
        <AddTableModal
          busy={addBusy}
          error={addError}
          form={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onSubmit={handleAddTable}
          onClose={closeAdd}
        />
      )}
    </div>
  );
}
