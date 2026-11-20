import { describe, expect, it } from 'vitest';
import { getServerPort } from './runtimeConfig.ts';

describe('getServerPort', () => {
  it('uses the Render-provided port in production', () => {
    expect(getServerPort([], { NODE_ENV: 'production', PORT: '10000' })).toBe(10000);
  });

  it('keeps the development default when NODE_ENV is not production', () => {
    expect(getServerPort([], { PORT: '10000' })).toBe(3000);
  });

  it('honors an explicit port argument', () => {
    expect(getServerPort(['node', 'server.ts', '--port', '4321'], { NODE_ENV: 'production', PORT: '10000' })).toBe(4321);
  });
});
