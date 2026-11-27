import { useEffect, useState } from 'react';

export class RequestTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number, message = 'Délai d’attente dépassé lors de la connexion au serveur.') {
    super(message);
    this.name = 'RequestTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class HttpStatusError extends Error {
  readonly status: number;
  readonly payload: unknown;
  constructor(status: number, message: string, payload: unknown = null) {
    super(message);
    this.name = 'HttpStatusError';
    this.status = status;
    this.payload = payload;
  }
}

export interface DeduplicatedFetchOptions extends RequestInit {
  timeoutMs?: number;
  bypassDedupe?: boolean;
}

const DEFAULT_TIMEOUT_MS = 7500;
const inflightRequests = new Map<string, Promise<unknown>>();
const actionCooldowns = new Map<string, number>();

function raceWithCallerSignal<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

export async function fetchJsonDeduplicated<T>(
  key: string,
  url: string,
  options: DeduplicatedFetchOptions = {}
): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    bypassDedupe = false,
    signal: callerSignal,
    ...fetchInit
  } = options;

  if (!bypassDedupe) {
    const existing = inflightRequests.get(key) as Promise<T> | undefined;
    if (existing) {
      return raceWithCallerSignal(existing, callerSignal);
    }
  }

  const effectiveTimeout = Math.max(1000, Math.min(30_000, timeoutMs));
  const sharedTask = (async (): Promise<T> => {
    const timeoutController = new AbortController();
    let timedOut = false;
    const timer = globalThis.setTimeout(() => {
      timedOut = true;
      timeoutController.abort();
    }, effectiveTimeout);

    try {
      const response = await fetch(url, {
        ...fetchInit,
        signal: timeoutController.signal
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const msg =
          (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : null) || `Erreur serveur temporaire (HTTP ${response.status}).`;
        throw new HttpStatusError(response.status, msg, payload);
      }
      return payload as T;
    } catch (err) {
      if (timedOut) {
        throw new RequestTimeoutError(effectiveTimeout);
      }
      throw err;
    } finally {
      globalThis.clearTimeout(timer);
    }
  })();

  if (!bypassDedupe) {
    inflightRequests.set(key, sharedTask);
    sharedTask.finally(() => {
      if (inflightRequests.get(key) === sharedTask) {
        inflightRequests.delete(key);
      }
    }).catch(() => {});
  }

  return raceWithCallerSignal(sharedTask, callerSignal);
}

export function canTriggerWithCooldown(
  actionKey: string,
  cooldownMs = 3000,
  now = Date.now()
): boolean {
  const last = actionCooldowns.get(actionKey);
  if (typeof last === 'number' && now - last < cooldownMs) {
    return false;
  }
  actionCooldowns.set(actionKey, now);
  return true;
}

export function getRemainingCooldownMs(
  actionKey: string,
  cooldownMs = 3000,
  now = Date.now()
): number {
  const last = actionCooldowns.get(actionKey);
  if (typeof last !== 'number') return 0;
  return Math.max(0, cooldownMs - (now - last));
}

export function useDebouncedValue<T>(value: T, delayMs = 180): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function resetRequestGuardForTests(): void {
  inflightRequests.clear();
  actionCooldowns.clear();
}
