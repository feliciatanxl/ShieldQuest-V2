// One place for every error the server answers with:
// - API requests (/api, /socket.io, or anything asking for JSON) always get { error, statusCode, message }.
// - Page requests get the SPA (which shows its own 404 page) or, when the server itself failed, a small
//   self-contained HTML fallback page, so players never see a raw stack trace or a blank screen.
// Wording comes from the shared status catalogue, the same one the web app's /error/:code page uses.

import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { GAME, httpStatus, isErrorStatus, statusSlug } from '@shieldquest/shared';

export interface ApiErrorBody {
  error: string;
  statusCode: number;
  message: string;
}

const isApiRequest = (req: FastifyRequest): boolean =>
  req.url.startsWith('/api') ||
  req.url.startsWith('/socket.io') ||
  (req.headers.accept ?? '').includes('application/json');

export function apiErrorBody(statusCode: number, message?: string): ApiErrorBody {
  const info = httpStatus(statusCode);
  return { error: statusSlug(info.code), statusCode: info.code, message: message ?? `${info.title.replace(/[.!?]$/, '')}. ${info.message}` };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Stand-alone fallback page: no scripts, no external files, so it renders even when the app bundle can't. */
export function errorPageHtml(statusCode: number): string {
  const info = httpStatus(statusCode);
  const retry = info.action === 'retry' || info.action === 'wait';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${info.code} ${escapeHtml(info.name)} · ${escapeHtml(GAME.name)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px;
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #141d3a; color: #eef0fb; }
  main { width: 100%; max-width: 32rem; background: #f6f1e7; color: #1b2340; border-radius: 20px; padding: 28px 24px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35); }
  .kicker { margin: 0; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #4c5574; }
  h1 { margin: 6px 0 10px; font-size: 1.6rem; line-height: 1.2; }
  p { margin: 0 0 18px; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; }
  a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 18px; border-radius: 999px; font-weight: 700;
    text-decoration: none; color: #1b2340; border: 2px solid #1b2340; }
  a.primary { background: #f2c14e; border-color: #f2c14e; }
  a:focus-visible { outline: 3px solid #2bb3a3; outline-offset: 2px; }
  details { margin-top: 20px; font-size: 0.88rem; color: #4c5574; }
  footer { margin-top: 18px; font-size: 0.78rem; color: #4c5574; }
</style>
</head>
<body>
<main>
  <p class="kicker">Error ${info.code}</p>
  <h1>${escapeHtml(info.title)}</h1>
  <p>${escapeHtml(info.message)}</p>
  <div class="actions">
    ${retry ? `<a class="primary" href="">Try again</a><a href="/">Home page</a>` : `<a class="primary" href="/">Back to the home page</a>`}
  </div>
  <details><summary>Technical details</summary><p>${info.code} ${escapeHtml(info.name)}: ${escapeHtml(info.technical)}</p></details>
  <footer>${escapeHtml(GAME.name)} · ${escapeHtml(GAME.team)}</footer>
</main>
</body>
</html>`;
}

function sendError(req: FastifyRequest, reply: FastifyReply, statusCode: number, message?: string) {
  const code = isErrorStatus(statusCode) ? statusCode : 500;
  reply.code(code).header('cache-control', 'no-store');
  if (isApiRequest(req)) return reply.send(apiErrorBody(code, message));
  return reply.type('text/html; charset=utf-8').send(errorPageHtml(code));
}

/**
 * Registers the error and not-found handlers. With `spa`, unknown page URLs get index.html (client-side routes
 * such as /play live there, and the app shows its own 404 page); without it they get the HTML fallback.
 */
export function registerErrorHandling(app: FastifyInstance, opts: { spa?: boolean } = {}): void {
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const status = err.validation ? 400 : (err.statusCode ?? 500);
    if (status >= 500) req.log.error({ err }, 'request failed');
    else req.log.warn({ code: err.code, statusCode: status }, err.message);
    // 4xx messages come from our own validation and Fastify's parser and are safe to show; 5xx never leak internals.
    return sendError(req, reply, status, status < 500 ? err.message : undefined);
  });

  app.setNotFoundHandler((req, reply) => {
    if (isApiRequest(req) || !opts.spa) return sendError(req, reply, 404);
    return reply.sendFile('index.html');
  });
}
