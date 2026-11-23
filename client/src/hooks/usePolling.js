import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Loads data with `fetcher` and reloads every `intervalMs` (0 = load once).
 * Re-runs when any value in `deps` changes or when reload() is called.
 * If the server says the session has ended, the user is sent to sign in.
 */
export default function usePolling(fetcher, intervalMs = 0, deps = []) {
  const { expireSession } = useAuth();
  const [state, setState] = useState({ data: null, error: '', loading: true, updatedAt: null });
  const [tick, setTick] = useState(0);

  // Keep the latest fetcher and handler without restarting the timer.
  const fetcherRef = useRef(fetcher);
  const expireRef = useRef(expireSession);
  fetcherRef.current = fetcher;
  expireRef.current = expireSession;

  useEffect(() => {
    let alive = true;
    // A reload or a changed filter is a new request; background timer refreshes stay silent.
    setState((prev) => (prev.loading ? prev : { ...prev, loading: true }));

    async function run() {
      try {
        const data = await fetcherRef.current();
        if (alive) setState({ data, error: '', loading: false, updatedAt: new Date() });
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) {
          expireRef.current();
          return;
        }
        setState((prev) => ({ ...prev, error: err.message, loading: false }));
      }
    }

    run();
    // Nobody is looking at a hidden tab, so do not hit the server for it. Refresh once when it becomes visible again.
    const tickIfVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    const timer = intervalMs > 0 ? setInterval(tickIfVisible, intervalMs) : null;
    if (intervalMs > 0) document.addEventListener('visibilitychange', tickIfVisible);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      if (intervalMs > 0) document.removeEventListener('visibilitychange', tickIfVisible);
    };
  }, [tick, intervalMs, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, reload: () => setTick((t) => t + 1) };
}
