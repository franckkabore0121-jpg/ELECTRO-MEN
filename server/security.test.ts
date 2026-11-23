import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
  SlidingWindowRateLimiter,
  createRateLimitMiddleware,
  hasUnsafeObjectKeys,
  sanitizePlainText,
  validateEmailInput,
  validatePhoneInput,
  validateSafeId,
  validateSafePositiveInt,
  validateSafeUrlOrPath
} from './security.ts';
import { hashInvestorPassword, verifyInvestorPassword } from './investorAuth.ts';
import {
  InsufficientBalanceError,
  adjustInvestorWalletBalance,
  createInvestor,
  findAdminByRole,
  initializeUserStore
} from './investorStore.ts';
import {
  FundRequestRuleError,
  createFundRequestAtomic,
  initializeApplicationStore
} from './applicationStore.ts';

describe('server security helpers', () => {
  it('blocks prototype pollution and NoSQL operator keys recursively', () => {
    expect(hasUnsafeObjectKeys({ email: { $gt: '' } })).toBe(true);
    expect(hasUnsafeObjectKeys({ nested: [{ $ne: null }] })).toBe(true);
    expect(hasUnsafeObjectKeys(JSON.parse('{"__proto__":{"isAdmin":true}}'))).toBe(true);
    expect(hasUnsafeObjectKeys({ constructor: { prototype: {} } })).toBe(true);
    expect(hasUnsafeObjectKeys({ email: 'investor@electromen.bf', amount: 15000 })).toBe(false);
  });

  it('sanitizes XSS/HTML/control characters and enforces length limits', () => {
    expect(sanitizePlainText('<script>alert(1)</script>Bonjour <b>Ouaga</b>', { required: true })).toBe('Bonjour Ouaga');
    expect(sanitizePlainText('javascript:alert(1)', { required: true })).toBe('alert(1)');
    expect(sanitizePlainText(12345 as unknown as string, { required: true })).toBeNull();
    expect(sanitizePlainText('trop court', { minLength: 20, required: true })).toBeNull();
  });

  it('validates emails, phones, IDs, URLs, and safe positive integers strictly', () => {
    expect(validateEmailInput('  Investor@Electromen.BF ')).toBe('investor@electromen.bf');
    expect(validateEmailInput('bad<script>@test.com')).toBeNull();
    expect(validatePhoneInput('+226 65 48 47 38')).toBe('+226 65 48 47 38');
    expect(validatePhoneInput('123')).toBeNull();

    expect(validateSafeId('req-fund-12345')).toBe('req-fund-12345');
    expect(validateSafeId('../../etc/passwd')).toBeNull();

    expect(validateSafePositiveInt(25000, { min: 500, max: 5_000_000 })).toBe(25000);
    expect(validateSafePositiveInt(-500, { min: 500, max: 5_000_000 })).toBeNull();
    expect(validateSafePositiveInt(0, { min: 500, max: 5_000_000 })).toBeNull();
    expect(validateSafePositiveInt(5_000_001, { min: 500, max: 5_000_000 })).toBeNull();
    expect(validateSafePositiveInt('250.5', { min: 1 })).toBeNull();

    expect(validateSafeUrlOrPath('/uploads/photo.jpg')).toBe('/uploads/photo.jpg');
    expect(validateSafeUrlOrPath('javascript:alert(1)')).toBeNull();
    expect(validateSafeUrlOrPath('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('enforces sliding-window rate limits, rapid duplicate cooldown, and onBlocked alerts', () => {
    const limiter = new SlidingWindowRateLimiter({
      maxRequests: 3,
      windowMs: 60_000,
      minIntervalMs: 5_000,
      blockDurationMs: 60_000
    });

    expect(limiter.checkAndRecord('inv-1', 1_000).allowed).toBe(true);
    // Cooldown triggers on immediate duplicate submission
    const tooFast = limiter.checkAndRecord('inv-1', 2_000);
    expect(tooFast.allowed).toBe(false);
    expect(tooFast.reason).toBe('cooldown');

    expect(limiter.checkAndRecord('inv-1', 7_000).allowed).toBe(true);
    expect(limiter.checkAndRecord('inv-1', 13_000).allowed).toBe(true);
    // 4th request inside window triggers limit
    const overLimit = limiter.checkAndRecord('inv-1', 19_000);
    expect(overLimit.allowed).toBe(false);
    expect(overLimit.reason).toBe('limit');

    const blockedEvents: string[] = [];
    const middleware = createRateLimitMiddleware({
      maxRequests: 1,
      windowMs: 60_000,
      blockDurationMs: 60_000,
      keyFn: () => 'test-key',
      onBlocked: (info) => blockedEvents.push(info.reason)
    });

    let statusCode = 200;
    const req = { headers: {}, socket: { remoteAddress: '127.0.0.1' } } as unknown as Request;
    const res = {
      setHeader: () => res,
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: () => res
    } as unknown as Response;
    let nextCount = 0;
    const next: NextFunction = () => {
      nextCount += 1;
    };

    middleware(req, res, next);
    middleware(req, res, next);
    middleware(req, res, next);
    expect(nextCount).toBe(1);
    expect(statusCode).toBe(429);
    expect(blockedEvents).toEqual(['limit']);
  });

  it('rejects oversized or non-string passwords in investorAuth', () => {
    expect(() => hashInvestorPassword('x'.repeat(200))).toThrow();
    expect(verifyInvestorPassword('x'.repeat(200), {})).toBe(false);
    expect(verifyInvestorPassword(null as unknown as string, {})).toBe(false);
  });

  it('enforces atomic server-side balance checks, pending withdrawal reservations, parallel locking, and idempotency', async () => {
    const prevDbUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      const defaultPhone = process.env.ADMIN_INITIAL_PHONE?.trim() || '+22656283526';
      await initializeUserStore({
        legacyInvestorFile: 'data/__nonexistent_investors__.json',
        legacyClientFile: 'data/__nonexistent_clients__.json',
        legacyAdmins: () => [],
        bootstrapAdmin: {
          id: 'admin-test-bootstrap',
          email: 'admin-bootstrap@electromen.test',
          phone: defaultPhone,
          role: 'admin_principal'
        }
      });
      await initializeApplicationStore('__nonexistent_test_data__', {});

      const principal = await findAdminByRole('admin_principal');
      expect(principal?.phone).toBe('+22656283526');

      await createInvestor({
        id: 'inv-wallet-test-1',
        email: 'wallet-test@electromen.test',
        phone: '+22670000001',
        walletBalance: 10000
      });

      await expect(adjustInvestorWalletBalance('inv-wallet-test-1', -15000)).rejects.toBeInstanceOf(
        InsufficientBalanceError
      );

      const debited = await adjustInvestorWalletBalance('inv-wallet-test-1', -4000);
      expect(debited?.previousBalance).toBe(10000);
      expect(debited?.newBalance).toBe(6000);

      const credited = await adjustInvestorWalletBalance('inv-wallet-test-1', 2500);
      expect(credited?.newBalance).toBe(8500);

      // Direct overdraft withdrawal fails atomically
      await expect(
        createFundRequestAtomic({
          investorId: 'inv-wallet-test-1',
          investorEmail: 'wallet-test@electromen.test',
          todayDateKey: '2026-11-22',
          maxDailyWithdrawal: 500_000,
          maxPendingWithdrawals: 3,
          buildRequest: () => ({
            id: 'req-overdraft',
            reference: 'RET-10001',
            type: 'retrait',
            amount: 9000,
            investorId: 'inv-wallet-test-1',
            investorName: 'Test Investor',
            investorEmail: 'wallet-test@electromen.test',
            investorPhone: '+22670000001',
            adminWhatsApp: '+22665484738',
            status: 'En attente',
            requestedAt: '22/11/2026 06:00',
            requestedDateKey: '2026-11-22'
          })
        })
      ).rejects.toBeInstanceOf(FundRequestRuleError);

      // Concurrent 5000 + 5000 withdrawals against 8500 real balance: only first succeeds
      const parallelResults = await Promise.allSettled([
        createFundRequestAtomic({
          investorId: 'inv-wallet-test-1',
          investorEmail: 'wallet-test@electromen.test',
          idempotencyKey: 'idem-ret-first',
          todayDateKey: '2026-11-22',
          maxDailyWithdrawal: 500_000,
          maxPendingWithdrawals: 3,
          buildRequest: () => ({
            id: 'req-first',
            reference: 'RET-10002',
            idempotencyKey: 'idem-ret-first',
            type: 'retrait',
            amount: 5000,
            investorId: 'inv-wallet-test-1',
            investorName: 'Test Investor',
            investorEmail: 'wallet-test@electromen.test',
            investorPhone: '+22670000001',
            adminWhatsApp: '+22665484738',
            status: 'En attente',
            requestedAt: '22/11/2026 06:01',
            requestedDateKey: '2026-11-22'
          })
        }),
        createFundRequestAtomic({
          investorId: 'inv-wallet-test-1',
          investorEmail: 'wallet-test@electromen.test',
          idempotencyKey: 'idem-ret-second',
          todayDateKey: '2026-11-22',
          maxDailyWithdrawal: 500_000,
          maxPendingWithdrawals: 3,
          buildRequest: () => ({
            id: 'req-second',
            reference: 'RET-10003',
            idempotencyKey: 'idem-ret-second',
            type: 'retrait',
            amount: 5000,
            investorId: 'inv-wallet-test-1',
            investorName: 'Test Investor',
            investorEmail: 'wallet-test@electromen.test',
            investorPhone: '+22670000001',
            adminWhatsApp: '+22665484738',
            status: 'En attente',
            requestedAt: '22/11/2026 06:01',
            requestedDateKey: '2026-11-22'
          })
        })
      ]);

      expect(parallelResults[0].status).toBe('fulfilled');
      expect(parallelResults[1].status).toBe('rejected');

      // Exact idempotency replay returns the existing request cleanly without creating a second debit
      const replay = await createFundRequestAtomic({
        investorId: 'inv-wallet-test-1',
        investorEmail: 'wallet-test@electromen.test',
        idempotencyKey: 'idem-ret-first',
        todayDateKey: '2026-11-22',
        maxDailyWithdrawal: 500_000,
        maxPendingWithdrawals: 3,
        buildRequest: () => ({
          id: 'req-duplicate-should-not-insert',
          reference: 'RET-99999',
          idempotencyKey: 'idem-ret-first',
          type: 'retrait',
          amount: 5000,
          investorId: 'inv-wallet-test-1',
          investorName: 'Test Investor',
          investorEmail: 'wallet-test@electromen.test',
          investorPhone: '+22670000001',
          adminWhatsApp: '+22665484738',
          status: 'En attente',
          requestedAt: '22/11/2026 06:02',
          requestedDateKey: '2026-11-22'
        })
      });
      expect(replay.duplicate).toBe(true);
      expect(replay.request.id).toBe('req-first');
    } finally {
      if (prevDbUrl !== undefined) process.env.DATABASE_URL = prevDbUrl;
    }
  });
});

