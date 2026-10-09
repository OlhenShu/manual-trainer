import { describe, expect, it } from 'vitest';
import { safeNextPath } from './googleAuth.js';

describe('safeNextPath', () => {
  it('keeps an in-app path and rejects an external one', () => {
    expect(safeNextPath('/admin')).toBe('/admin');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
  });
});
