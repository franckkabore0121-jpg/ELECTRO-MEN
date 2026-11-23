import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const CONTROL_CHARS_WITH_NEWLINES_RE = /[\u0000-\u001F\u007F]/g;
const SCRIPT_BLOCK_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const STYLE_BLOCK_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/g;
const INLINE_EVENT_RE = /\bon[a-z]+\s*=/gi;
const DANGEROUS_URI_RE = /^(javascript|vbscript|data\s*:\s*text\/html)\s*:/i;

const RESERVED_PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && typeof forwarded[0] === 'string' && forwarded[0].trim()) {
    return forwarded[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

export function hasUnsafeObjectKeys(value: unknown, depth = 0): boolean {
  if (depth > 20 || value === null || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasUnsafeObjectKeys(item, depth + 1));
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (RESERVED_PROTOTYPE_KEYS.has(key) || key.startsWith('$') || key.includes('\u0000')) {
      return true;
    }
    const child = (value as Record<string, unknown>)[key];
    if (hasUnsafeObjectKeys(child, depth + 1)) {
      return true;
    }
  }
  return false;
}

export function rejectMaliciousPayloadMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (hasUnsafeObjectKeys(req.body) || hasUnsafeObjectKeys(req.query)) {
    res.status(400).json({
      success: false,
      error: 'Requête rejetée : structure de données ou opérateurs non autorisés.'
    });
    return;
  }
  next();
}

export const bodyParserErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error && (error instanceof SyntaxError || (error as { type?: string }).type === 'entity.parse.failed')) {
    res.status(400).json({
      success: false,
      error: 'Format JSON invalide ou malformé.'
    });
    return;
  }
  if (error && (error as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: 'La taille des données envoyées dépasse la limite autorisée.'
    });
    return;
  }
  next(error);
};

export function sanitizePlainText(
  value: unknown,
  options: {
    minLength?: number;
    maxLength?: number;
    allowNewlines?: boolean;
    required?: boolean;
  } = {}
): string | null {
  const {
    minLength = 0,
    maxLength = 500,
    allowNewlines = false,
    required = false
  } = options;

  if (value === undefined || value === null) {
    return required ? null : '';
  }
  if (typeof value !== 'string') {
    return null;
  }

  let cleaned = value
    .replace(allowNewlines ? CONTROL_CHARS_RE : CONTROL_CHARS_WITH_NEWLINES_RE, ' ')
    .replace(SCRIPT_BLOCK_RE, ' ')
    .replace(STYLE_BLOCK_RE, ' ')
    .replace(HTML_TAG_RE, '')
    .replace(INLINE_EVENT_RE, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '');

  if (allowNewlines) {
    cleaned = cleaned
      .split(/\r?\n/)
      .map((line) => line.trim())
      .join('\n')
      .trim();
  } else {
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
  }

  if (required && cleaned.length === 0) return null;
  if (cleaned.length < minLength || cleaned.length > maxLength) return null;
  return cleaned;
}

export function validateEmailInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (CONTROL_CHARS_WITH_NEWLINES_RE.test(value)) return null;
  const cleaned = value.trim().toLowerCase();
  if (cleaned.length < 5 || cleaned.length > 254) return null;
  if (/[<>'"`\\;]/.test(cleaned)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned)) return null;
  return cleaned;
}

export function validatePhoneInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (CONTROL_CHARS_WITH_NEWLINES_RE.test(value)) return null;
  const cleaned = value.trim();
  if (cleaned.length < 8 || cleaned.length > 32) return null;
  if (!/^[+\d\s().-]+$/.test(cleaned)) return null;
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return cleaned;
}

export function validateSafeId(value: unknown, maxLength = 120): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  if (trimmed.includes('..') || !/^[a-zA-Z0-9#._:-]+$/.test(trimmed)) return null;
  return trimmed;
}

export function validateSafePositiveInt(
  value: unknown,
  options: { min?: number; max?: number } = {}
): number | null {
  const { min = 1, max = Number.MAX_SAFE_INTEGER } = options;
  let parsed: number;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    parsed = Number(trimmed);
  } else {
    return null;
  }

  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

export function validateSafeNonNegativeInt(
  value: unknown,
  options: { max?: number } = {}
): number | null {
  return validateSafePositiveInt(value, { min: 0, max: options.max });
}

export function validateSafeUrlOrPath(value: unknown, maxLength = 2048): string | null {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') return null;
  if (CONTROL_CHARS_WITH_NEWLINES_RE.test(value)) return null;

  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length > maxLength) return null;

  const compact = trimmed.replace(/\s+/g, '');
  if (DANGEROUS_URI_RE.test(compact)) return null;

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//') || trimmed.split('/').includes('..')) return null;
    return trimmed;
  }

  if (/^data:(image|video)\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

interface RateBucket {
  timestamps: number[];
  lastAttemptAt: number;
  blockedUntil: number;
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, RateBucket>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly minIntervalMs: number;
  private readonly blockDurationMs: number;
  private cleanupCounter = 0;

  constructor(options: {
    maxRequests: number;
    windowMs: number;
    minIntervalMs?: number;
    blockDurationMs?: number;
  }) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.minIntervalMs = options.minIntervalMs ?? 0;
    this.blockDurationMs = options.blockDurationMs ?? options.windowMs;
  }

  checkAndRecord(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number; reason?: 'cooldown' | 'limit' } {
    this.cleanupCounter += 1;
    if (this.cleanupCounter % 200 === 0) {
      this.prune(now);
    }

    const bucket = this.buckets.get(key) ?? { timestamps: [], lastAttemptAt: 0, blockedUntil: 0 };

    if (bucket.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
        reason: 'limit'
      };
    }

    if (this.minIntervalMs > 0 && bucket.lastAttemptAt > 0 && now - bucket.lastAttemptAt < this.minIntervalMs) {
      const waitMs = this.minIntervalMs - (now - bucket.lastAttemptAt);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
        reason: 'cooldown'
      };
    }

    const cutoff = now - this.windowMs;
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

    if (bucket.timestamps.length >= this.maxRequests) {
      bucket.blockedUntil = now + this.blockDurationMs;
      this.buckets.set(key, bucket);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(this.blockDurationMs / 1000)),
        reason: 'limit'
      };
    }

    bucket.timestamps.push(now);
    bucket.lastAttemptAt = now;
    this.buckets.set(key, bucket);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private prune(now: number): void {
    const cutoff = now - Math.max(this.windowMs, this.blockDurationMs);
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.lastAttemptAt < cutoff && bucket.blockedUntil < now) {
        this.buckets.delete(key);
      }
    }
  }
}

export function createRateLimitMiddleware(options: {
  maxRequests: number;
  windowMs: number;
  minIntervalMs?: number;
  blockDurationMs?: number;
  keyFn?: (req: Request) => string;
  limitMessage?: string;
  cooldownMessage?: string;
  onBlocked?: (info: {
    req: Request;
    key: string;
    reason: 'cooldown' | 'limit';
    retryAfterSeconds: number;
  }) => void;
}) {
  const limiter = new SlidingWindowRateLimiter({
    maxRequests: options.maxRequests,
    windowMs: options.windowMs,
    minIntervalMs: options.minIntervalMs,
    blockDurationMs: options.blockDurationMs
  });
  const lastAlertByKey = new Map<string, number>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = options.keyFn ? options.keyFn(req) : getClientIp(req);
    const result = limiter.checkAndRecord(key);
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      if (options.onBlocked) {
        const now = Date.now();
        const prevAlert = lastAlertByKey.get(key) ?? 0;
        if (now - prevAlert >= 60_000) {
          lastAlertByKey.set(key, now);
          options.onBlocked({
            req,
            key,
            reason: result.reason ?? 'limit',
            retryAfterSeconds: result.retryAfterSeconds
          });
        }
      }
      const baseMsg =
        result.reason === 'cooldown'
          ? options.cooldownMessage || 'Action trop rapide détectée. Veuillez patienter quelques secondes avant de réessayer.'
          : options.limitMessage || 'Trop de requêtes effectuées. Veuillez patienter avant de réessayer.';
      res.status(429).json({
        success: false,
        error: `${baseMsg} (Réessayez dans ${result.retryAfterSeconds}s)`,
        retryAfterSeconds: result.retryAfterSeconds
      });
      return;
    }
    next();
  };
}
