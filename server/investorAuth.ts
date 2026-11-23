import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

export const INVESTOR_PASSWORD_ALGORITHM = 'pbkdf2-sha512-v2' as const;

const PASSWORD_ITERATIONS = 310000;

export interface InvestorPasswordRecord {
  passwordHash?: string;
  passwordSalt?: string;
  passwordAlgorithm?: string;
  passwordUpdatedAt?: string;
  assignedPassword?: string;
  assignedPasswordPlainText?: string;
}

const MAX_PASSWORD_LENGTH = 128;

export function hashInvestorPassword(password: string): { hash: string; salt: string } {
  if (typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error('Le mot de passe doit être une chaîne valide (128 caractères maximum).');
  }
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyInvestorPassword(password: string, investor: InvestorPasswordRecord): boolean {
  if (typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }
  if (
    typeof investor.passwordHash === 'string' &&
    typeof investor.passwordSalt === 'string' &&
    /^[a-f\d]{128}$/i.test(investor.passwordHash) &&
    /^[a-f\d]{32}$/i.test(investor.passwordSalt)
  ) {
    try {
      const iterations = investor.passwordAlgorithm === INVESTOR_PASSWORD_ALGORITHM ? PASSWORD_ITERATIONS : 100000;
      const testHash = pbkdf2Sync(password, investor.passwordSalt, iterations, 64, 'sha512');
      const storedHash = Buffer.from(investor.passwordHash, 'hex');
      if (timingSafeEqual(testHash, storedHash)) return true;
    } catch {
      return false;
    }
  }

  for (const legacyPassword of [investor.assignedPassword, investor.assignedPasswordPlainText]) {
    if (typeof legacyPassword !== 'string') continue;
    const provided = Buffer.from(password);
    const legacy = Buffer.from(legacyPassword);
    if (provided.length === legacy.length && timingSafeEqual(provided, legacy)) return true;
  }

  return false;
}

export function withInvestorPassword<T extends InvestorPasswordRecord>(
  investor: T,
  password: string
): Omit<T, 'assignedPassword' | 'assignedPasswordPlainText' | 'passwordHash' | 'passwordSalt' | 'passwordAlgorithm' | 'passwordUpdatedAt'> & {
  passwordHash: string;
  passwordSalt: string;
  passwordAlgorithm: typeof INVESTOR_PASSWORD_ALGORITHM;
  passwordUpdatedAt: string;
} {
  const {
    assignedPassword: _assignedPassword,
    assignedPasswordPlainText: _assignedPasswordPlainText,
    passwordHash: _passwordHash,
    passwordSalt: _passwordSalt,
    passwordAlgorithm: _passwordAlgorithm,
    passwordUpdatedAt: _passwordUpdatedAt,
    ...profile
  } = investor;
  const { hash, salt } = hashInvestorPassword(password);
  return {
    ...profile,
    passwordHash: hash,
    passwordSalt: salt,
    passwordAlgorithm: INVESTOR_PASSWORD_ALGORITHM,
    passwordUpdatedAt: new Date().toISOString()
  };
}
