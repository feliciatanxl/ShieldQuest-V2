// /play/restore: where a Save Card QR code lands (/play/restore#code=TIGER-MANGO-ROCKET-CLOUD).
// The code rides in the #fragment, which browsers never send to a server, and is wiped from the address bar
// (and history) as soon as it is read. Nothing changes on this device until the player confirms.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { LoadForm } from './parts';
import './save.css';

// Kept for the page's lifetime because React may call the state initialiser twice (StrictMode) and the
// fragment is gone after the first read.
let fromFragment: string | null = null;

function codeFromFragment(): string {
  if (typeof window === 'undefined') return '';
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return fromFragment ?? '';
  fromFragment = (new URLSearchParams(hash).get('code') ?? '').slice(0, 80);
  try {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  } catch {
    /* some embedded browsers refuse; the code just stays in the address bar */
  }
  return fromFragment;
}

export default function RestorePage() {
  // Read once, on first render: the fragment is cleared straight after.
  const [code] = useState(codeFromFragment);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const before = document.title;
    document.title = 'Load a Save Card · ShieldQuest';
    titleRef.current?.focus();
    return () => {
      document.title = before;
      fromFragment = null;
    };
  }, []);

  return (
    <main id="main" className="sv-page">
      <section className="sv-page__card" aria-labelledby="sv-page-title">
        <h1 id="sv-page-title" ref={titleRef} tabIndex={-1}>
          Load a Save Card
        </h1>
        <p className="sv-page__lead">
          {code ? 'Checking your card. Nothing changes until you say so.' : 'Type the 4 words from your Save Card.'}
        </p>
        <div className="sv">
          <LoadForm initial={code} autoStart={Boolean(code)} />
        </div>
        <p className="sv-page__back">
          <Link href="/play">Back to the city</Link>
        </p>
      </section>
    </main>
  );
}
