import { useEffect } from 'react';
import { useParams } from 'wouter';
import { isRoomCode, normalizeRoomCode } from '@shieldquest/shared';
import { disconnectSquad } from './socket';
import { Console } from './host/Console';
import { CreateSession } from './host/CreateSession';
import './host/host.css';

/** /host (create a session) and /host/:code (the Conductor console for that session). */
export default function HostPage() {
  const params = useParams<{ code?: string }>();
  const code = normalizeRoomCode(decodeURIComponent(params.code ?? ''));

  // Leaving the console closes the connection; the session itself keeps running on the server.
  useEffect(() => () => disconnectSquad(), []);

  if (params.code && isRoomCode(code)) return <Console key={code} code={code} />;
  return <CreateSession invalidCode={params.code ? params.code : undefined} />;
}
