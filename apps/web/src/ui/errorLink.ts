// Links to the /error/:code fallback page. `from` lets its "Try again" button return to the page that failed.

/** Only same-site paths are accepted, so the error page can never send anyone to another site. */
export function safeReturnPath(from: string | null | undefined): string | null {
  if (!from || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\')) return null;
  return from;
}

export function errorHref(code: number, from?: string): string {
  const back = safeReturnPath(from);
  return `/error/${code}${back ? `?from=${encodeURIComponent(back)}` : ''}`;
}

/** Sends the browser to the error page for `code`, remembering where it came from. */
export function showErrorPage(code: number): void {
  location.assign(errorHref(code, location.pathname + location.search));
}
