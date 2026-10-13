import { useEffect, type ReactNode } from 'react';
import { useParams } from 'wouter';
import { GAME, isRoomCode, normalizeRoomCode } from '@shieldquest/shared';
import { LinkButton } from '../ui/Button';
import { LogoMark } from '../ui/Logo';
import { useAudioProfile, useDocumentTitle, useRootAttributes } from './hooks';
import { RoomCode, errorText } from './parts';
import { BigScreen } from './screen/BigScreen';
import { connectSquad, disconnectSquad, useScreenSnapshot, useSquad } from './socket';
import './screen/screen.css';

// The projector grade (lifted shadows, brighter mids) and the projector type scale (text >= 28 px).
const PROJECTOR = { 'data-grade': 'projector', 'data-sq-screen': '' } as const;

/** /screen/:code — the Big Screen for the projector. No controls are needed to run it. */
export default function ScreenPage() {
  const params = useParams<{ code: string }>();
  const code = normalizeRoomCode(decodeURIComponent(params.code ?? ''));
  useRootAttributes(PROJECTOR);
  useAudioProfile('big-screen');
  useDocumentTitle(isRoomCode(code) ? `Big Screen · ${code}` : 'Big Screen');

  if (!isRoomCode(code)) {
    return (
      <ScreenMessage title="No session code">
        <p>Open the Big Screen from the Conductor console, or add the 6-character code to the address: /screen/CODE.</p>
        <LinkButton href="/host" size="lg" icon="play">
          Open the Conductor
        </LinkButton>
      </ScreenMessage>
    );
  }
  return <ScreenConnect key={code} code={code} />;
}

function ScreenConnect({ code }: { code: string }) {
  const snap = useScreenSnapshot();
  const status = useSquad((s) => s.status);
  const error = useSquad((s) => s.error);

  useEffect(() => {
    const close = connectSquad({ audience: 'screen', code });
    return () => {
      close();
      disconnectSquad();
    };
  }, [code]);

  // A session that just ended keeps its closing card on screen even after the server lets go.
  if (snap) return <BigScreen snap={snap} />;

  if (status === 'failed') {
    const ended = error === 'ended' || error === 'not-found';
    return (
      <ScreenMessage title={ended ? 'This session has ended' : 'The Big Screen could not connect'}>
        <p>{ended ? GAME.closing : errorText(error)}</p>
        <LinkButton href="/host" size="lg" icon="play" variant="secondary">
          Open the Conductor
        </LinkButton>
      </ScreenMessage>
    );
  }
  return (
    <ScreenMessage title="Connecting the Big Screen…">
      <p>
        Session <RoomCode code={code} />
      </p>
      {(status === 'reconnecting' || status === 'offline') && <p>Still trying. Check this laptop’s Wi-Fi.</p>}
    </ScreenMessage>
  );
}

function ScreenMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="sq-scr sq-scr--message">
      <div className="sq-scr__frame">
        <main id="main" className="sq-scr-message" role="status">
          <LogoMark size={72} />
          <h1>{title}</h1>
          {children}
        </main>
        <footer className="sq-scr__foot">
          <p>{GAME.disclaimer}</p>
        </footer>
      </div>
    </div>
  );
}
