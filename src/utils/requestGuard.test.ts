import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HttpStatusError,
  RequestTimeoutError,
  canTriggerWithCooldown,
  fetchJsonDeduplicated,
  getRemainingCooldownMs,
  resetRequestGuardForTests
} from './requestGuard.ts';

describe('requestGuard', () => {
  afterEach(() => {
    resetRequestGuardForTests();
    vi.restoreAllMocks();
  });

  it('deduplicates concurrent inflight requests with the same key into a single fetch', async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const p1 = fetchJsonDeduplicated<{ ok: boolean }>('catalog-bootstrap', '/api/catalog-bootstrap');
    const p2 = fetchJsonDeduplicated<{ ok: boolean }>('catalog-bootstrap', '/api/catalog-bootstrap');
    const p3 = fetchJsonDeduplicated<{ ok: boolean }>('catalog-bootstrap', '/api/catalog-bootstrap');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });
    expect(r3).toEqual({ ok: true });
  });

  it('rejects with HttpStatusError on server 503 responses so callers degrade gracefully', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Base temporairement indisponible' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJsonDeduplicated('catalog-bootstrap', '/api/catalog-bootstrap')).rejects.toBeInstanceOf(
      HttpStatusError
    );
  });

  it('aborts hung requests after timeoutMs and throws RequestTimeoutError', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const req = fetchJsonDeduplicated('slow-endpoint', '/api/products', { timeoutMs: 2000 });
    const assertion = expect(req).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(2100);
    await assertion;
    vi.useRealTimers();
  });

  it('enforces anti-burst cooldown on rapid repeated trigger attempts', () => {
    expect(canTriggerWithCooldown('manual-refresh', 3000, 10_000)).toBe(true);
    expect(canTriggerWithCooldown('manual-refresh', 3000, 10_500)).toBe(false);
    expect(getRemainingCooldownMs('manual-refresh', 3000, 10_500)).toBe(2500);
    expect(canTriggerWithCooldown('manual-refresh', 3000, 13_100)).toBe(true);
    expect(getRemainingCooldownMs('manual-refresh', 3000, 13_100)).toBe(3000);
    expect(getRemainingCooldownMs('manual-refresh', 3000, 16_100)).toBe(0);
  });
});
