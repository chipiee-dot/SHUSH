import { useEffect, useState } from 'react';
import { api } from '../api.js';
import CertificateView from './CertificateView.jsx';
import EmptyState from './EmptyState.jsx';
import Modal from './Modal.jsx';
import { CATEGORY_LABEL, libraryDate, periodLabel } from '../lib/certificate.js';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';

function Segmented({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-shush-lineStrong bg-shush-white p-0.5">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${RING} ${
            value === key ? 'bg-shush-orange600 text-white' : 'text-shush-inkSoft hover:bg-shush-creamDeep'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function StatList({ title, entries, unit }) {
  return (
    <section className="rounded-2xl border border-shush-line bg-shush-cream/60 p-4">
      <h3 className="text-sm font-semibold text-shush-ink">{title}</h3>
      {entries.length === 0 ? (
        <p className="mt-2 text-xs text-shush-muted">Nobody yet.</p>
      ) : (
        <ol className="mt-2 space-y-1.5">
          {entries.slice(0, 5).map((e, i) => (
            <li key={e.studentId} className="flex items-baseline gap-2 text-sm">
              <span className="w-4 flex-none text-xs font-bold text-shush-orange700">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-shush-ink" title={e.name}>
                {e.name}
              </span>
              <span className="flex-none font-semibold text-shush-ink">
                {e.value} <span className="text-xs font-medium text-shush-muted">{unit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CurrentStats({ data }) {
  const rp = data?.rewardPeriod;
  if (!data) return <EmptyState title="No stats yet" text="Rewards are still loading." />;
  return (
    <div>
      <p className="text-sm text-shush-inkSoft">
        {rp ? (
          <>
            Current period started <strong className="text-shush-ink">{libraryDate(rp.startedAt)}</strong> and closes by itself on{' '}
            <strong className="text-shush-ink">{libraryDate(rp.closesAt)}</strong>, unless you end it sooner. These are the standings that
            would earn certificates if it ended now.
          </>
        ) : (
          'Standings for the current period.'
        )}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatList title="Most Frequent Visitor" entries={data.mostFrequent ?? []} unit="visits" />
        <StatList title="Quietest Visitor" entries={data.quietest ?? []} unit="avg level" />
        <StatList title="Quiet Streak" entries={data.quietStreak ?? []} unit="in a row" />
      </div>
    </div>
  );
}

function Certificates({ onNone }) {
  const [state, setState] = useState({ loading: true, error: '', result: null });
  const [category, setCategory] = useState('frequent');

  useEffect(() => {
    let alive = true;
    api
      .rewardCertificates()
      .then((result) => alive && setState({ loading: false, error: '', result }))
      .catch((err) => alive && setState({ loading: false, error: err.message, result: null }));
    return () => {
      alive = false;
    };
  }, []);

  const { loading, error, result } = state;
  const hasClosed = (result?.periods?.length ?? 0) > 0;
  const cert = result?.certificates?.find((c) => c.category === category) ?? null;

  useEffect(() => {
    if (!loading && !hasClosed) onNone?.();
  }, [loading, hasClosed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="text-sm text-shush-muted">Loading certificates…</p>;
  if (error) return <p role="alert" className="text-sm text-shush-danger">{error}</p>;
  if (!hasClosed) {
    return (
      <EmptyState
        title="No certificates yet"
        text="Certificates are created when a rewards period ends. End the current period, or wait for it to close after one calendar month."
      />
    );
  }

  return (
    <div>
      <p className="text-sm text-shush-inkSoft">
        Certificates from the last closed period ({periodLabel(result.period)}). Students can also print or download theirs from their own page.
      </p>
      <div className="mt-4">
        <Segmented
          label="Certificate"
          value={category}
          onChange={setCategory}
          options={[
            ['frequent', CATEGORY_LABEL.frequent],
            ['quietest', CATEGORY_LABEL.quietest],
          ]}
        />
      </div>
      <div className="mt-4">
        {cert ? (
          <CertificateView key={cert.id} cert={cert} />
        ) : (
          <EmptyState
            title={`No ${CATEGORY_LABEL[category]} certificate`}
            text={
              category === 'quietest'
                ? 'Nobody had a session of 30 minutes or more in that period.'
                : 'Nobody had a session in that period.'
            }
          />
        )}
      </div>
    </div>
  );
}

/** Faculty Export: certificates of the last closed period (print / download) and the stats of the current period. */
export default function RewardsExportModal({ open, onClose, data }) {
  const [tab, setTab] = useState('certificates');
  useEffect(() => {
    if (open) setTab('certificates');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="max-w-3xl"
      title="Export rewards"
      subtitle="Print or download a certificate, or look at the stats of the current period."
    >
      <Segmented
        label="Export"
        value={tab}
        onChange={setTab}
        options={[
          ['certificates', 'Certificates'],
          ['stats', 'Current period stats'],
        ]}
      />
      <div className="mt-5">{tab === 'certificates' ? <Certificates /> : <CurrentStats data={data} />}</div>
    </Modal>
  );
}
