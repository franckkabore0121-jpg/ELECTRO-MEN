import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

export const INVESTOR_PASSWORD_ALGORITHM = 'pbkdf2-sha512-v2' as const;

const PASSWORD_ITERATIONS = 310000;

export interface InvestorPasswordEscrow {
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface InvestorPasswordRecord {
  passwordHash?: string;
  passwordSalt?: string;
  passwordAlgorithm?: string;
  passwordUpdatedAt?: string;
  passwordEscrow?: InvestorPasswordEscrow;
  assignedPassword?: string;
  assignedPasswordPlainText?: string;
}

const MAX_PASSWORD_LENGTH = 128;

let ephemeralEscrowKey: Buffer | null = null;

function getInvestorEscrowKey(): Buffer {
  const configuredKey = process.env.INVESTOR_CREDENTIAL_KEY?.trim();
  if (configuredKey) {
    return createHash('sha256').update(configuredKey).digest();
  }
  if (!ephemeralEscrowKey) {
    ephemeralEscrowKey = randomBytes(32);
  }
  return ephemeralEscrowKey;
}

export function encryptInvestorEscrowPassword(password: string): InvestorPasswordEscrow {
  if (typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error('Le mot de passe doit être une chaîne valide (128 caractères maximum).');
  }
  const key = getInvestorEscrowKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: ciphertext.toString('hex')
  };
}

export function decryptInvestorEscrowPassword(escrow?: InvestorPasswordEscrow | null): string | null {
  if (
    !escrow ||
    escrow.alg !== 'aes-256-gcm' ||
    typeof escrow.iv !== 'string' ||
    typeof escrow.tag !== 'string' ||
    typeof escrow.ciphertext !== 'string'
  ) {
    return null;
  }
  try {
    const key = getInvestorEscrowKey();
    const iv = Buffer.from(escrow.iv, 'hex');
    const tag = Buffer.from(escrow.tag, 'hex');
    const ciphertext = Buffer.from(escrow.ciphertext, 'hex');
    if (iv.length !== 12 || tag.length !== 16) {
      return null;
    }
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return decrypted.length > 0 ? decrypted : null;
  } catch {
    return null;
  }
}

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
