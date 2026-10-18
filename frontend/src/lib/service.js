import { useCallback, useEffect, useState } from 'react';
import { getHealth } from './api';

// Reachability of the analysis service. state: 'checking' | 'ready' | 'unavailable'
// reason (when unavailable): 'not_configured' | 'offline'. Nothing is simulated when it is down.
export function useService() {
  const [status, setStatus] = useState({ state: 'checking', engine: null, reason: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus({ state: 'checking', engine: null, reason: null });
    getHealth()
      .then((h) => { if (!cancelled) setStatus({ state: 'ready', engine: h.engine, reason: null }); })
      .catch((e) => {
        if (!cancelled) setStatus({ state: 'unavailable', engine: null, reason: e.kind === 'config' ? 'not_configured' : 'offline' });
      });
    return () => { cancelled = true; };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...status, retry };
}
