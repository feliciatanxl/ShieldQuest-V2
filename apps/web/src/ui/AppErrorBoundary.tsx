// Last line of defence for the whole app: if a page crashes while rendering, or its code can't be downloaded
// (offline, or a new version was deployed mid-visit), show a calm screen instead of a blank page.
// Lives in the main bundle and imports nothing heavy, so it works even when other chunks can't load.
import { Component, type ReactNode } from 'react';
import { errorHref } from './errorLink';

interface Props {
  /** Changing this (e.g. the current path) clears the error, so navigating away recovers. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|Loading chunk/i;

export function isLoadError(error: Error): boolean {
  return error.name === 'ChunkLoadError' || CHUNK_ERROR.test(error.message);
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  componentDidCatch(error: Error) {
    console.error('Page crashed:', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const load = isLoadError(error);
    const code = load ? 503 : 500;
    return (
      <main id="main" className="app-crash" role="alert">
        <div className="app-crash__card">
          <p className="app-crash__kicker">{load ? 'Couldn’t load' : 'Something broke'}</p>
          <h1>{load ? 'This part of the game didn’t load' : 'Something broke on this page'}</h1>
          <p>
            {load
              ? 'Check the Wi-Fi, then try again. If the game was just updated, reloading fixes it.'
              : 'It’s not you, it’s us. Reloading usually fixes it. Your progress on this device is safe.'}
          </p>
          <div className="app-crash__actions">
            <button type="button" className="ui-btn ui-btn--primary ui-btn--md" onClick={() => location.reload()}>
              Try again
            </button>
            <a className="ui-btn ui-btn--secondary ui-btn--md" href="/">
              Home page
            </a>
          </div>
          <a className="app-crash__more" href={errorHref(code, location.pathname + location.search)}>
            What does error {code} mean?
          </a>
        </div>
      </main>
    );
  }
}
