import { useEffect, useRef, useState } from 'react';
import client from '../api/client';

// Shared by the Sidebar's live status footer and the /widget page, so both
// show the same numbers at the same moment instead of two independent,
// slightly-out-of-sync pollers. Self-scheduling via setTimeout-after-response
// (not setInterval) so a slow request can't stack a second one on top of it.
// Deliberately does not touch Dashboard.jsx's own polling — that page's
// logic is unchanged, per the hard rule.
export default function useSummary(intervalMs = 2000) {
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'offline'
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    let timer;

    const poll = () => {
      client.get('/api/dashboard/summary')
        .then((res) => {
          if (!aliveRef.current) return;
          setSummary(res.data);
          setStatus('ok');
        })
        .catch(() => {
          if (!aliveRef.current) return;
          setStatus('offline');
        })
        .finally(() => {
          if (aliveRef.current) timer = setTimeout(poll, intervalMs);
        });
    };

    poll();
    return () => { aliveRef.current = false; clearTimeout(timer); };
  }, [intervalMs]);

  return { summary, status };
}
