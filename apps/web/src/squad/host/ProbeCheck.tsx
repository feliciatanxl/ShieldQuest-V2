import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_PATH, type ClientToServerEvents, type ServerToClientEvents } from '@shieldquest/shared';
import type { Socket } from 'socket.io-client';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';

type ProbeState = 'idle' | 'checking' | 'live' | 'polling' | 'blocked';

/**
 * Pre-flight network check (GDD §7.3): connects like a phone would and reports
 * Live (websocket) / Fell back to polling / Blocked.
 */
export function ProbeCheck({ auto = false }: { auto?: boolean }) {
  const [state, setState] = useState<ProbeState>('idle');
  const [run, setRun] = useState(auto ? 1 : 0);

  useEffect(() => {
    if (run === 0) return;
    setState('checking');
    const s: Socket<ServerToClientEvents, ClientToServerEvents> = io({
      path: SOCKET_PATH,
      auth: { role: 'probe' },
      transports: ['polling', 'websocket'],
      reconnection: false,
      timeout: 8000,
      forceNew: true,
    });
    let settled = false;
    const finish = (st: ProbeState) => {
      if (settled) return;
      settled = true;
      setState(st);
      window.clearTimeout(timer);
      s.disconnect();
    };
    s.on('probe', (p) => {
      if (p.transport === 'websocket') finish('live');
    });
    s.on('connect_error', () => finish('blocked'));
    // Polling worked but the upgrade never came: school proxies often block websockets.
    const timer = window.setTimeout(() => finish(s.connected ? 'polling' : 'blocked'), 6000);
    return () => {
      settled = true;
      window.clearTimeout(timer);
      s.disconnect();
    };
  }, [run]);

  return (
    <div className="sq-probe" role="status" aria-live="polite">
      {state === 'idle' && <span>Check the room’s Wi-Fi before players join.</span>}
      {state === 'checking' && <StatusBadge status="unknown" label="Checking the network…" />}
      {state === 'live' && <StatusBadge status="safe" label="Live: real-time works on this network" />}
      {state === 'polling' && <StatusBadge status="attention" label="Fell back to polling: it works, a little slower" />}
      {state === 'blocked' && (
        <>
          <StatusBadge status="risk" label="Blocked" />
          <span className="sq-probe__hint">Ask players to use mobile data: under 3 MB for the whole session.</span>
        </>
      )}
      {state !== 'checking' && (
        <Button size="sm" variant="ghost" icon="rewind" onClick={() => setRun((r) => r + 1)}>
          {state === 'idle' ? 'Check network' : 'Check again'}
        </Button>
      )}
    </div>
  );
}
