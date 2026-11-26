import { useEffect, useRef, useState } from 'react';
import { CERT_H, CERT_W, CATEGORY_LABEL, downloadCertificate, drawCertificate, printCertificate } from '../lib/certificate.js';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';

/** Live preview of one certificate. */
export function CertificatePreview({ cert }) {
  const ref = useRef(null);
  useEffect(() => {
    let alive = true;
    if (ref.current) {
      drawCertificate(ref.current, cert).catch(() => {
        if (alive) console.warn('[certificate] could not draw');
      });
    }
    return () => {
      alive = false;
    };
  }, [cert]);
  return (
    <canvas
      ref={ref}
      width={CERT_W}
      height={CERT_H}
      role="img"
      aria-label={`${CATEGORY_LABEL[cert.category] ?? 'Certificate'} certificate for ${cert.name}`}
      className="h-auto w-full rounded-lg border border-shush-line shadow-md"
    />
  );
}

/** Preview with Print and Download buttons. Used on the faculty and the student side. */
export default function CertificateView({ cert }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function run(kind) {
    setBusy(kind);
    setError('');
    try {
      await (kind === 'print' ? printCertificate(cert) : downloadCertificate(cert));
    } catch {
      setError('Could not prepare the certificate. Please try again.');
    } finally {
      setBusy('');
    }
  }

  return (
    <div>
      <CertificatePreview cert={cert} />
      {error && (
        <p role="alert" className="mt-3 text-sm text-shush-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => run('print')}
          disabled={Boolean(busy)}
          className={`rounded-xl border border-shush-lineStrong px-5 py-2.5 text-sm font-semibold text-shush-ink transition hover:bg-shush-creamDeep disabled:opacity-60 ${RING}`}
        >
          {busy === 'print' ? 'Preparing…' : 'Print'}
        </button>
        <button
          type="button"
          onClick={() => run('download')}
          disabled={Boolean(busy)}
          className={`rounded-xl bg-shush-orange px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-shush-orange600 disabled:opacity-60 ${RING}`}
        >
          {busy === 'download' ? 'Preparing…' : 'Download PNG'}
        </button>
      </div>
    </div>
  );
}
