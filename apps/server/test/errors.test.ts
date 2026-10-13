// Error handling: JSON for the API, the HTML fallback page for page requests, nothing internal leaks.
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HTTP_STATUS_CODES, httpStatus } from '@shieldquest/shared';
import { apiErrorBody, errorPageHtml, registerErrorHandling } from '../src/errors';

describe('error handling', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    registerErrorHandling(app);
    app.get('/api/boom', async () => {
      throw new Error('database password is hunter2');
    });
    app.get('/api/teapot', async () => {
      throw Object.assign(new Error('short and stout'), { statusCode: 418 });
    });
    app.post('/api/echo', { schema: { body: { type: 'object', required: ['x'], properties: { x: { type: 'string' } } } } }, async (req) => req.body);
    app.get('/boom', async () => {
      throw new Error('secret stack');
    });
    await app.ready();
  });
  afterAll(() => app.close());

  it('answers unknown API routes with a JSON 404', async () => {
    const res = await app.inject({ url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'not-found', statusCode: 404 });
  });

  it('hides internal messages on 5xx', async () => {
    const res = await app.inject({ url: '/api/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'internal-server-error', statusCode: 500 });
    expect(res.body).not.toContain('hunter2');
  });

  it('keeps 4xx status codes and messages', async () => {
    const tea = await app.inject({ url: '/api/teapot' });
    expect(tea.statusCode).toBe(418);
    expect(tea.json()).toMatchObject({ error: 'im-a-teapot', message: 'short and stout' });

    const bad = await app.inject({ method: 'POST', url: '/api/echo', payload: {} });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ error: 'bad-request', statusCode: 400 });

    const json = await app.inject({ method: 'POST', url: '/api/echo', headers: { 'content-type': 'application/json' }, payload: '{nope' });
    expect(json.statusCode).toBe(400);
  });

  it('serves the HTML fallback page for page requests', async () => {
    const res = await app.inject({ url: '/boom', headers: { accept: 'text/html' } });
    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Error 500');
    expect(res.body).not.toContain('secret stack');
    expect(res.body).not.toContain('<script');

    const missing = await app.inject({ url: '/no-such-page', headers: { accept: 'text/html' } });
    expect(missing.statusCode).toBe(404);
    expect(missing.body).toContain('Error 404');
  });

  it('has wording for every listed status code, and a fallback for others', () => {
    for (const code of HTTP_STATUS_CODES) {
      const info = httpStatus(code);
      expect(info.code).toBe(code);
      expect(info.title.length).toBeGreaterThan(0);
      expect(info.message.length).toBeGreaterThan(0);
      expect(errorPageHtml(code)).toContain(`Error ${code}`);
    }
    expect(httpStatus(599).name).toBe('Server Error');
    expect(httpStatus(-1).code).toBe(500);
    expect(apiErrorBody(503).error).toBe('service-unavailable');
  });
});
