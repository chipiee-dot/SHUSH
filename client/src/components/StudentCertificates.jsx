import { useEffect, useState } from 'react';
import { api } from '../api.js';
import CertificateView from './CertificateView.jsx';
import Modal from './Modal.jsx';
import { CATEGORY_LABEL, libraryDate, periodLabel } from '../lib/certificate.js';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';

/**
 * "Your certificates" card for the student page. Renders nothing until the student has at least one;
 * a failed load is silent too, since certificates are a bonus and must never get in the way of picking a table.
 */
export default function StudentCertificates() {
  const [certs, setCerts] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .studentCertificates()
      .then((r) => alive && setCerts(Array.isArray(r) ? r : r?.certificates ?? []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (certs.length === 0) return null;
  const current = certs.find((c) => c.id === open) ?? null;

  return (
    <section className="rounded-3xl border border-shush-line bg-shush-white/90 p-6 shadow-[0_10px_30px_-18px_rgba(242,95,19,0.35)] sm:p-8" aria-labelledby="my-certs">
      <h2 id="my-certs" className="text-xl font-semibold tracking-tight text-shush-ink">
        Your certificates
      </h2>
      <p className="mt-1 text-sm text-shush-inkSoft">You earned these for your visits. Open one to print or download it.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {certs.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setOpen(c.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border border-shush-line bg-shush-cream/60 px-4 py-3 text-left transition hover:bg-shush-creamDeep ${RING}`}
            >
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-shush-gold text-shush-orange700" aria-hidden="true">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <circle cx="12" cy="9" r="6" />
                  <path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-shush-ink">{CATEGORY_LABEL[c.category] ?? 'Certificate'}</span>
                <span className="block truncate text-xs text-shush-muted">
                  {periodLabel(c.period) || libraryDate(c.issuedAt)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Modal
        open={Boolean(current)}
        onClose={() => setOpen(null)}
        size="max-w-3xl"
        title={current ? CATEGORY_LABEL[current.category] ?? 'Certificate' : 'Certificate'}
        subtitle={current ? `Issued ${libraryDate(current.issuedAt)}` : undefined}
      >
        {current && <CertificateView cert={current} />}
      </Modal>
    </section>
  );
}
