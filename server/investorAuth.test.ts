import { describe, expect, it } from 'vitest';
import {
  decryptInvestorEscrowPassword,
  encryptInvestorEscrowPassword,
  hashInvestorPassword,
  verifyInvestorPassword,
  withInvestorPassword
} from './investorAuth.ts';

describe('investor password credentials', () => {
  it('hashes credentials and verifies only the matching password', () => {
    const { hash, salt } = hashInvestorPassword('VerySecurePassword123!');
    const investor = {
      passwordHash: hash,
      passwordSalt: salt,
      passwordAlgorithm: 'pbkdf2-sha512-v2'
    };

    expect(verifyInvestorPassword('VerySecurePassword123!', investor)).toBe(true);
    expect(verifyInvestorPassword('wrong-password', investor)).toBe(false);
  });

  it('replaces legacy credentials without changing investor identity or portfolio data', () => {
    const original = {
      id: 'legacy-investor-42',
      email: 'investor@example.com',
      sharesCount: 17,
      totalInvested: 850000,
      assignedPassword: 'old-password',
      assignedPasswordPlainText: 'old-password'
    };

    const updated = withInvestorPassword(original, 'NewSecurePassword123!');

    expect(updated).toMatchObject({
      id: original.id,
      email: original.email,
      sharesCount: original.sharesCount,
      totalInvested: original.totalInvested,
      passwordAlgorithm: 'pbkdf2-sha512-v2'
    });
    expect(updated).not.toHaveProperty('assignedPassword');
    expect(updated).not.toHaveProperty('assignedPasswordPlainText');
    expect(verifyInvestorPassword('NewSecurePassword123!', updated)).toBe(true);
  }, 20000);

  it('encrypts and decrypts escrow passwords and rejects tampered payloads', () => {
    const escrow = encryptInvestorEscrowPassword('InvestPass2026!');
    expect(escrow.alg).toBe('aes-256-gcm');
    expect(escrow.ciphertext).not.toContain('InvestPass2026!');
    expect(decryptInvestorEscrowPassword(escrow)).toBe('InvestPass2026!');
    expect(decryptInvestorEscrowPassword({ ...escrow, tag: '00'.repeat(16) })).toBeNull();
  });
});
