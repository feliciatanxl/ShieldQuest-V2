import { describe, expect, it } from 'vitest';
import { isLoadError } from './AppErrorBoundary';
import { errorHref, safeReturnPath } from './errorLink';

describe('error links', () => {
  it('builds /error/:code links with a same-site return path', () => {
    expect(errorHref(503)).toBe('/error/503');
    expect(errorHref(500, '/play/board?x=1')).toBe('/error/500?from=%2Fplay%2Fboard%3Fx%3D1');
  });

  it('never returns to another site', () => {
    for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '', null, undefined]) {
      expect(safeReturnPath(bad)).toBeNull();
    }
    expect(safeReturnPath('/host')).toBe('/host');
  });

  it('spots failed code downloads', () => {
    expect(isLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))).toBe(true);
    expect(isLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});
