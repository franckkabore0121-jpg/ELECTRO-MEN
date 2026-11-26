import "dotenv/config";
import express, { Request, Response, type ErrorRequestHandler, type NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getServerPort } from './server/runtimeConfig.ts';
import {
  adjustInvestorWalletBalance,
  InsufficientBalanceError,
  closeInvestorStore,
  checkUserStoreConnection,
  clearUserOtps,
  createArchiveRecord,
  createUser,
  createUserWithOtp,
  createInvestor,
  createInvestorSession,
  createUserSession,
  deleteInvestor,
  deleteInvestorSessions,
  deleteUser,
  deleteOtherInvestorSessions,
  deleteInvestorSession,
  deleteArchiveRecord,
  findAdminByRole,
  findArchiveRecord,
  findInvestorByEmail,
  findInvestorByIdentifier,
  findInvestorBySession,
  findUserByEmail,
  findUserById,
  findUserBySession,
  initializeUserStore,
  isMemoryStoreActive,
  getSafePostgresTarget,
  logPostgresError,
  redactPostgresCredentials,
  initializeAdminSecurity,
  initializeOperationInventory,
  getAdminSecuritySettings,
  listArchiveRecords,
  listOperationInventories,
  deleteUserOtp,
  findUserOtp,
  incrementUserOtpAttempts,
  listUsersByRole,
  listAdmins,
  listInvestors,
  replaceInvestors,
  replaceUsersByRole,
  reserveOperationShares,
  releaseOperationShares,
  saveUserOtp,
  updateUser,
  updateInvestor,
  updateAdminSecuritySettings,
  updateOperationInventory
} from './server/investorStore.ts';
import type { AdminSecuritySettings, ArchivedRecord, OperationInventory, StoredUser, UserRole } from './server/investorStore.ts';
import {
  appendApplicationRecord,
  createFundRequestAtomic,
  deleteApplicationRecord,
  FundRequestRuleError,
  initializeApplicationStore,
  readApplicationData,
  readInvestorSubscriptions,
  saveApplicationBackup,
  updateApplicationRecord,
  writeApplicationData,
  type ApplicationDataKey
} from './server/applicationStore.ts';
import {
  INVESTOR_PASSWORD_ALGORITHM,
  type InvestorPasswordEscrow,
  decryptInvestorEscrowPassword,
  encryptInvestorEscrowPassword,
  hashInvestorPassword,
  verifyInvestorPassword,
  withInvestorPassword
} from './server/investorAuth.ts';
import {
  createMediaObjectKey,
  getSupabaseStorage,
  InvalidMediaUploadError,
  MediaStorageConfigurationError,
  parseBase64MediaUpload,
  parseBase64VoiceUpload,
  resolveAllowedMediaUpload
} from './server/supabaseStorage.ts';
import {
  type AdminPermission,
  ALL_ADMIN_PERMISSIONS,
  hasAdminPermissionFromList,
  resolveAdminPermissions,
  sanitizeAdminPermissions
} from './src/data/adminPermissions.ts';
import {
  bodyParserErrorHandler,
  createRateLimitMiddleware,
  getClientIp,
  rejectMaliciousPayloadMiddleware,
  sanitizePlainText,
  validateEmailInput,
  validatePhoneInput,
  validateSafeId,
  validateSafeNonNegativeInt,
  validateSafePositiveInt,
  validateSafeUrlOrPath
} from './server/security.ts';

const app = express();
app.set('trust proxy', 1);

app.use((_req: Request, _res: Response, next: NextFunction) => {
  void ensureServerInitialized().then(() => next()).catch(next);
});

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void handler(req, res, next).catch(next);
  };
}

const PORT = getServerPort(process.argv, process.env);

type LiveResource =
  | 'config'
  | 'operations'
  | 'products'
  | 'courses'
  | 'course-categories'
  | 'activities'
  | 'documents'
  | 'subscriptions'
  | 'fund-requests'
  | 'audit-logs'
  | 'groups'
  | 'archives'
  | 'investors'
  | 'admins'
  | 'messages'
  | 'profits';

const dataEventClients = new Set<Response>();
let dataRevision = 0;

function broadcastDataChanged(resource: LiveResource): void {
  const event = {
    resource,
    revision: ++dataRevision,
    changedAt: new Date().toISOString()
  };
  const message = `event: DATA_CHANGED\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of dataEventClients) {
    try {
      client.write(message);
    } catch (error) {
      console.error('Unable to deliver live data event:', error);
      dataEventClients.delete(client);
    }
  }
}

app.set('etag', false);

function applyNoCacheHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.removeHeader('ETag');
}

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.path.startsWith('/products') || req.path.startsWith('/admin/products')) {
    applyNoCacheHeaders(res);
  }
  next();
});

app.get('/api/events/stream', (req: Request, res: Response) => {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Connection: process.env.VERCEL ? 'close' : 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  if (process.env.VERCEL) {
    res.write('retry: 15000\nevent: SYNC_REQUIRED\ndata: {}\n\n');
    res.end();
    return;
  }
  dataEventClients.add(res);
  res.write('event: SYNC_REQUIRED\ndata: {}\n\n');

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': heartbeat\n\n');
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    dataEventClients.delete(res);
  };
  req.on('close', cleanup);
  res.on('close', cleanup);
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(bodyParserErrorHandler);
app.use(rejectMaliciousPayloadMiddleware);
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (req.headers.authorization || req.headers['x-requested-with']) return next();
  const hasCookie = Boolean(req.headers.cookie && (
    req.headers.cookie.includes('electromen_admin_session=') ||
    req.headers.cookie.includes('electromen_investor_session=') ||
    req.headers.cookie.includes('electromen_client_session=')
  ));
  if (!hasCookie || !req.headers.origin) return next();
  try {
    const originHost = new URL(req.headers.origin).host;
    const forwardedHost = typeof req.headers['x-forwarded-host'] === 'string'
      ? req.headers['x-forwarded-host'].split(',')[0].trim()
      : '';
    const host = forwardedHost || (typeof req.headers.host === 'string' ? req.headers.host : '');
    if (host && originHost === host) return next();
  } catch {
    // Reject malformed origin header on cookie-authenticated mutations
  }
  return res.status(403).json({ success: false, error: 'Origine de requête non autorisée.' });
});

const securityAlertCooldowns = new Map<string, number>();
const withdrawalAbuseCounters = new Map<string, { count: number; windowStart: number }>();

function recordSecurityAlert(source: string, description: string, targetId?: string): void {
  const now = Date.now();
  const dedupeKey = `${source}:${targetId || ''}`;
  const lastLogged = securityAlertCooldowns.get(dedupeKey) ?? 0;
  if (now - lastLogged < 45_000) return;
  securityAlertCooldowns.set(dedupeKey, now);
  if (securityAlertCooldowns.size > 500) {
    for (const [k, ts] of securityAlertCooldowns.entries()) {
      if (now - ts > 120_000) securityAlertCooldowns.delete(k);
    }
  }
  void addServerAuditLog('Système Sécurité', 'security_alert', description, 'security', targetId).catch((err) => {
    console.error('Unable to persist security alert:', err);
  });
}

function trackAbnormalWithdrawalAttempt(investorId: string, ip: string, detail: string): void {
  const key = `${investorId}:${ip}`;
  const now = Date.now();
  const prev = withdrawalAbuseCounters.get(key);
  const current = !prev || now - prev.windowStart > 5 * 60 * 1000
    ? { count: 1, windowStart: now }
    : { count: prev.count + 1, windowStart: prev.windowStart };
  withdrawalAbuseCounters.set(key, current);
  if (current.count >= 3) {
    recordSecurityAlert(
      'overdraft_loop',
      `Tentatives répétées de retrait invalide/hors-solde (${current.count}x) depuis IP ${ip} : ${detail}`,
      investorId
    );
  }
}

const authRateLimiter = createRateLimitMiddleware({
  maxRequests: 12,
  windowMs: 5 * 60 * 1000,
  blockDurationMs: 5 * 60 * 1000,
  keyFn: (req) => `auth:${getClientIp(req)}`,
  limitMessage: 'Trop de tentatives de connexion depuis votre adresse.',
  onBlocked: ({ req, key, retryAfterSeconds }) => {
    recordSecurityAlert(
      'auth_rate_limit',
      `Blocage anti-brute-force sur ${req.path} (IP ${getClientIp(req)}, blocage ${retryAfterSeconds}s).`,
      key
    );
  }
});

const otpRegisterRateLimiter = createRateLimitMiddleware({
  maxRequests: 8,
  windowMs: 10 * 60 * 1000,
  minIntervalMs: 2500,
  blockDurationMs: 10 * 60 * 1000,
  keyFn: (req) => `otp-reg:${getClientIp(req)}`,
  limitMessage: 'Trop de demandes d’inscription ou de code de vérification.',
  cooldownMessage: 'Veuillez patienter quelques secondes entre deux demandes.',
  onBlocked: ({ req, key, reason }) => {
    if (reason === 'limit') {
      recordSecurityAlert(
        'otp_rate_limit',
        `Activité OTP/inscription excessive sur ${req.path} depuis IP ${getClientIp(req)}.`,
        key
      );
    }
  }
});

const fundRequestRateLimiter = createRateLimitMiddleware({
  maxRequests: 10,
  windowMs: 5 * 60 * 1000,
  minIntervalMs: 8000,
  blockDurationMs: 5 * 60 * 1000,
  keyFn: (req) => {
    const token = getInvestorSessionToken(req);
    const sessionHash = token ? crypto.createHash('sha256').update(token).digest('hex').slice(0, 16) : 'anon';
    return `fund:${getClientIp(req)}:${sessionHash}`;
  },
  limitMessage: 'Trop de demandes de dépôt ou de retrait soumises en peu de temps.',
  cooldownMessage: 'Soumission répétée bloquée par sécurité : veuillez patienter avant de renvoyer une demande.',
  onBlocked: ({ req, key, reason, retryAfterSeconds }) => {
    recordSecurityAlert(
      'fund_rate_limit',
      `Soumission financière bloquée (${reason === 'cooldown' ? 'clics/boucle rapide' : 'plafond dépassé'}) depuis IP ${getClientIp(req)} sur ${req.path} (${retryAfterSeconds}s).`,
      key
    );
  }
});

const sensitiveActionRateLimiter = createRateLimitMiddleware({
  maxRequests: 15,
  windowMs: 5 * 60 * 1000,
  minIntervalMs: 2000,
  blockDurationMs: 5 * 60 * 1000,
  keyFn: (req) => `action:${getClientIp(req)}:${req.path}`,
  limitMessage: 'Trop d’actions sensibles effectuées. Patientez quelques instants.',
  cooldownMessage: 'Action trop rapide détectée. Veuillez patienter avant de réessayer.',
  onBlocked: ({ req, key, reason }) => {
    if (reason === 'limit') {
      recordSecurityAlert(
        'action_rate_limit',
        `Rafale d'actions sensibles bloquée sur ${req.path} depuis IP ${getClientIp(req)}.`,
        key
      );
    }
  }
});

const heartbeatRateLimiter = createRateLimitMiddleware({
  maxRequests: 30,
  windowMs: 60 * 1000,
  keyFn: (req) => `hb:${getClientIp(req)}`,
  limitMessage: 'Fréquence de ping trop élevée.'
});

app.use('/api/admin', (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' && req.path === '/config') return next();
  void hasAdminSession(req)
    .then((authenticated) => {
      if (!authenticated) {
        res.status(401).json({ success: false, error: 'Authentification administrateur requise.' });
        return;
      }
      next();
    })
    .catch(next);
});

// Legacy JSON import sources and local media fallback
const DATA_DIR = path.resolve('data');
const CONFIG_FILE = path.join(DATA_DIR, 'admin-config.json');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const INVESTORS_FILE = path.join(DATA_DIR, 'investors.json');
const OPERATIONS_FILE = path.join(DATA_DIR, 'operations.json');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'subscriptions.json');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');
const COURSE_CATEGORIES_FILE = path.join(DATA_DIR, 'course-categories.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'audit-logs.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const UPLOADS_DIR = path.resolve('public/uploads');
const MESSAGES_FILE = path.join(DATA_DIR, 'investor-messages.json');
const PROFIT_DISTRIBUTIONS_FILE = path.join(DATA_DIR, 'profit-distributions.json');
const dataKeyByFile = new Map<string, ApplicationDataKey>([
  [CONFIG_FILE, 'admin-config'],
  [OPERATIONS_FILE, 'operations'],
  [SUBSCRIPTIONS_FILE, 'subscriptions'],
  [ACTIVITIES_FILE, 'activities'],
  [DOCUMENTS_FILE, 'documents'],
  [GROUPS_FILE, 'groups'],
  [COURSES_FILE, 'courses'],
  [COURSE_CATEGORIES_FILE, 'course-categories'],
  [AUDIT_LOGS_FILE, 'audit-logs'],
  [PRODUCTS_FILE, 'products'],
  [MESSAGES_FILE, 'investor-messages'],
  [PROFIT_DISTRIBUTIONS_FILE, 'profit-distributions']
]);
const liveResourceByFile = new Map<string, LiveResource>([
  [CONFIG_FILE, 'config'],
  [OPERATIONS_FILE, 'operations'],
  [PRODUCTS_FILE, 'products'],
  [COURSES_FILE, 'courses'],
  [COURSE_CATEGORIES_FILE, 'course-categories'],
  [ACTIVITIES_FILE, 'activities'],
  [DOCUMENTS_FILE, 'documents'],
  [SUBSCRIPTIONS_FILE, 'subscriptions'],
  [GROUPS_FILE, 'groups'],
  [MESSAGES_FILE, 'messages'],
  [PROFIT_DISTRIBUTIONS_FILE, 'profits']
]);

app.get('/uploads/:filename', asyncRoute(async (req: Request, res: Response, next: NextFunction) => {
  const safeFilename = path.basename(req.params.filename || '');
  const localPath = path.resolve(UPLOADS_DIR, safeFilename);
  if (safeFilename && localPath.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(localPath)) {
    return next();
  }

  let storage;
  try {
    storage = getSupabaseStorage();
  } catch (error) {
    if (error instanceof MediaStorageConfigurationError) {
      return res.status(503).json({ error: error.message });
    }
    throw error;
  }
  if (!storage) return next();

  const objectKey = createMediaObjectKey('uploads', req.params.filename);
  const { data } = storage.client.storage.from(storage.bucket).getPublicUrl(objectKey);
  res.redirect(302, data.publicUrl);
}));
app.use('/uploads', express.static(UPLOADS_DIR));

// =========================================================================
// DATA UTILITIES & STORAGE HELPERS
// =========================================================================

function dataKeyForFile(filePath: string): ApplicationDataKey {
  const key = dataKeyByFile.get(path.resolve(filePath));
  if (!key) throw new Error(`Ressource de données non configurée : ${filePath}`);
  return key;
}

async function readJson<T>(filePath: string, defaultValue: T): Promise<T> {
  return readApplicationData(dataKeyForFile(filePath), defaultValue);
}

async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await writeApplicationData(dataKeyForFile(filePath), data);
  const resource = liveResourceByFile.get(path.resolve(filePath));
  if (resource) broadcastDataChanged(resource);
}

async function archiveItem(
  entityType: string,
  entityId: string,
  label: string,
  payload: unknown,
  parentId?: string
): Promise<string> {
  const id = crypto.randomUUID();
  await createArchiveRecord({
    id,
    entityType,
    entityId,
    label,
    parentId,
    archivedAt: new Date().toISOString(),
    payload
  });
  broadcastDataChanged('archives');
  return id;
}

function isRecordWithId(value: unknown): value is { id: string } {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string';
}

async function restoreJsonItem<T extends { id: string }>(filePath: string, value: T, defaultItems: T[] = []): Promise<boolean> {
  const items = await readJson<T[]>(filePath, defaultItems);
  if (items.some((item) => item.id === value.id)) return false;
  await writeJson(filePath, [value, ...items]);
  return true;
}

function verifyEnvSecretMatch(submitted: string, envValue: string | undefined): boolean {
  const expected = envValue?.trim();
  const actual = submitted.trim();
  if (!expected || !actual || expected.length < 4 || expected.length > 128 || actual.length > 128) {
    return false;
  }
  const actualDigest = crypto.createHash('sha256').update(actual).digest();
  const expectedDigest = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(actualDigest, expectedDigest);
}

function verifyMasterCode(code: string, settings: AdminSecuritySettings): boolean {
  if (!settings.masterPasswordHash || !settings.masterPasswordSalt) return false;
  const storedHash = Buffer.from(settings.masterPasswordHash, 'hex');
  for (const candidate of [code.trim(), code]) {
    if (!candidate) continue;
    try {
      const submittedHash = crypto.pbkdf2Sync(candidate, settings.masterPasswordSalt, MASTER_CODE_PBKDF2_ITERATIONS, 64, 'sha512');
      if (storedHash.length === submittedHash.length && crypto.timingSafeEqual(storedHash, submittedHash)) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

// OWASP standard Salted PBKDF2 Password Hashing
function hashPasswordSecure(password: string, salt?: string): { hash: string; salt: string } {
  const userSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password.trim(), userSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: userSalt };
}

function verifyPasswordSecure(password: string, hash: string, salt: string): boolean {
  try {
    const testHash = crypto.pbkdf2Sync(password.trim(), salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

function legacyHash(password: string): string {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const INVESTOR_SESSION_COOKIE = 'electromen_investor_session';
const CLIENT_SESSION_COOKIE = 'electromen_client_session';
const ADMIN_SESSION_COOKIE = 'electromen_admin_session';
const INVESTOR_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const MASTER_CODE_PBKDF2_ITERATIONS = 310000;

function getRequestCookie(req: Request, name: string): string | null {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const entry = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : null;
}

function getAdminSessionToken(req: Request): string | null {
  const cookie = getRequestCookie(req, ADMIN_SESSION_COOKIE);
  if (cookie) return cookie;
  const authorization = req.headers.authorization;
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProto = typeof req.headers['x-forwarded-proto'] === 'string'
    ? req.headers['x-forwarded-proto'].split(',')[0].trim().toLowerCase()
    : '';
  return req.secure || forwardedProto === 'https' || process.env.NODE_ENV === 'production';
}

function setHttpOnlySessionCookie(req: Request, res: Response, name: string, token: string, maxAgeSeconds: number): void {
  const attrs = isHttpsRequest(req)
    ? 'HttpOnly; Secure; SameSite=None; Partitioned; Path=/'
    : 'HttpOnly; SameSite=Lax; Path=/';
  res.setHeader('Set-Cookie', `${name}=${token}; ${attrs}; Max-Age=${maxAgeSeconds}`);
}

function clearHttpOnlySessionCookie(req: Request, res: Response, name: string): void {
  const attrs = isHttpsRequest(req)
    ? 'HttpOnly; Secure; SameSite=None; Partitioned; Path=/'
    : 'HttpOnly; SameSite=Lax; Path=/';
  res.setHeader('Set-Cookie', `${name}=; ${attrs}; Max-Age=0`);
}

function publicInvestor(investor: ServerInvestorUser) {
  const {
    passwordHash,
    passwordSalt,
    passwordEscrow: _passwordEscrow,
    assignedPassword,
    assignedPasswordPlainText: _assignedPasswordPlainText,
    ...safeInvestor
  } = investor;
  return {
    ...safeInvestor,
    hasPasswordConfigured: Boolean((passwordHash && passwordSalt) || assignedPassword || investor.assignedPasswordPlainText),
    passwordAlgorithm: investor.passwordAlgorithm || (passwordHash ? INVESTOR_PASSWORD_ALGORITHM : undefined),
    passwordUpdatedAt: investor.passwordUpdatedAt,
    shareAllocations: Array.isArray(investor.shareAllocations) ? investor.shareAllocations : [],
    walletBalance: Number.isSafeInteger(investor.walletBalance) && (investor.walletBalance ?? 0) >= 0
      ? investor.walletBalance
      : 0
  };
}

function getInvestorSessionToken(req: Request): string | null {
  return getRequestCookie(req, INVESTOR_SESSION_COOKIE);
}

async function getAuthenticatedAdmin(req: Request): Promise<ServerAdminUser | undefined> {
  const token = getAdminSessionToken(req);
  if (!token) return undefined;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await findUserBySession<ServerAdminUser>(tokenHash);
  return user && (user.role === 'admin_principal' || user.role === 'admin_secondaire') ? user : undefined;
}

function getAdminEffectivePermissions(admin: ServerAdminUser): AdminPermission[] {
  return resolveAdminPermissions(admin.role, admin.permissions);
}

function hasAdminPermission(admin: ServerAdminUser | undefined, permission: AdminPermission): boolean {
  if (!admin) return false;
  return hasAdminPermissionFromList(admin.role, admin.permissions, permission);
}

async function requireAdminPermission(
  req: Request,
  res: Response,
  permission: AdminPermission
): Promise<ServerAdminUser | undefined> {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) {
    res.status(401).json({ success: false, error: 'Authentification administrateur requise.' });
    return undefined;
  }
  if (!hasAdminPermission(admin, permission)) {
    res.status(403).json({
      success: false,
      error: 'Vous ne disposez pas des droits requis pour effectuer cette action.'
    });
    return undefined;
  }
  return admin;
}

async function requireAdminAnyPermission(
  req: Request,
  res: Response,
  permissions: AdminPermission[]
): Promise<ServerAdminUser | undefined> {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) {
    res.status(401).json({ success: false, error: 'Authentification administrateur requise.' });
    return undefined;
  }
  if (permissions.some((permission) => hasAdminPermission(admin, permission))) {
    return admin;
  }
  res.status(403).json({
    success: false,
    error: 'Vous ne disposez pas des droits requis pour accéder à cette ressource.'
  });
  return undefined;
}

async function hasAdminSession(req: Request): Promise<boolean> {
  return Boolean(await getAuthenticatedAdmin(req));
}

async function hasPrincipalAdminSession(req: Request): Promise<boolean> {
  return (await getAuthenticatedAdmin(req))?.role === 'admin_principal';
}

async function getAuthenticatedInvestor(req: Request): Promise<ServerInvestorUser | undefined> {
  const token = getInvestorSessionToken(req);
  if (!token) return undefined;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return findInvestorBySession<ServerInvestorUser>(tokenHash);
}

async function establishInvestorSession(investor: ServerInvestorUser, req: Request, res: Response): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVESTOR_SESSION_DURATION_MS);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await createInvestorSession(tokenHash, investor.id, expiresAt);
  setHttpOnlySessionCookie(req, res, INVESTOR_SESSION_COOKIE, token, Math.floor(INVESTOR_SESSION_DURATION_MS / 1000));
}

async function establishUserSession(user: StoredUser, req: Request, res: Response, cookieName: string, durationMs: number): Promise<string> {
  const token = generateToken();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + durationMs);
  await createUserSession(tokenHash, user.id, expiresAt);
  setHttpOnlySessionCookie(req, res, cookieName, token, Math.floor(durationMs / 1000));
  return token;
}

function clearInvestorSessionCookie(req: Request, res: Response): void {
  clearHttpOnlySessionCookie(req, res, INVESTOR_SESSION_COOKIE);
}

// Rate Limiting & Brute-Force Tracker
const loginAttempts: Record<string, { count: number; lockedUntil?: number }> = {};

function checkRateLimit(key: string): { allowed: boolean; remainingSeconds?: number } {
  const record = loginAttempts[key];
  if (!record) return { allowed: true };
  if (record.lockedUntil && record.lockedUntil > Date.now()) {
    const remaining = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return { allowed: false, remainingSeconds: remaining };
  }
  return { allowed: true };
}

function recordFailedAttempt(key: string): void {
  const record = loginAttempts[key] || { count: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 min lock
  }
  loginAttempts[key] = record;
}

function recordSuccessfulAttempt(key: string): void {
  delete loginAttempts[key];
}

// Real Identity Validation
function validateRealIdentity(lastName: string, firstName: string, email: string, phone: string) {
  const dummyStrings = ['test', 'fake', 'admin', 'user', 'demo', 'aaa', 'bbb', 'ccc', 'abc', 'xyz', 'client', 'investisseur'];
  const cleanLast = (lastName || '').trim();
  const cleanFirst = (firstName || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const phoneDigits = (phone || '').replace(/\D/g, '');

  if (
    cleanLast.length < 2 ||
    cleanLast.length > 60 ||
    !/^[\p{L}\s'-]+$/u.test(cleanLast) ||
    dummyStrings.includes(cleanLast.toLowerCase())
  ) {
    return { valid: false, error: 'Nom de famille invalide ou générique.' };
  }
  if (
    cleanFirst.length < 2 ||
    cleanFirst.length > 60 ||
    !/^[\p{L}\s'-]+$/u.test(cleanFirst) ||
    dummyStrings.includes(cleanFirst.toLowerCase())
  ) {
    return { valid: false, error: 'Prénom invalide ou générique.' };
  }
  if (
    cleanEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
    cleanEmail.includes('fake') ||
    cleanEmail.includes('test@test')
  ) {
    return { valid: false, error: 'Adresse e-mail invalide ou de test.' };
  }
  if (phoneDigits.length < 8 || phoneDigits.length > 15) {
    return { valid: false, error: 'Numéro de téléphone incomplet (au moins 8 chiffres requis).' };
  }
  const dummyPhones = [
    '00000000', '11111111', '22222222', '33333333', '44444444',
    '55555555', '66666666', '77777777', '88888888', '99999999',
    '12345678', '87654321', '01234567', '0000000000', '1234567890'
  ];
  if (dummyPhones.some((dummy) => phoneDigits.includes(dummy))) {
    return { valid: false, error: 'Le numéro de téléphone saisi semble fictif. Veuillez renseigner un numéro joignable.' };
  }
  return { valid: true };
}

// =========================================================================
// DATA MODELS & INTERFACES
// =========================================================================

export type InvestorStatus = 'demande_non_soumise' | 'en_attente' | 'approuve' | 'refuse' | 'suspendu' | 'bloque';

export interface ServerClientUser extends StoredUser {
  lastName: string;
  firstName: string;
  name: string;
  email: string;
  phone: string;
  city?: string;
  accountType?: string;
  passwordHash: string;
  passwordSalt: string;
  isVerified: boolean;
  registeredDate: string;
  role: 'client';
}

export type BoutiqueSector = 'Électronique' | 'Électrotechnique' | 'Informatique';

export interface InvestorShareAllocation {
  id: string;
  sector: BoutiqueSector;
  operationId?: string;
  operationTitle?: string;
  shares: number;
  amount: number;
  updatedAt?: string;
}

export interface ServerInvestorUser extends StoredUser {
  lastName: string;
  firstName: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  passwordSalt: string;
  passwordAlgorithm?: typeof INVESTOR_PASSWORD_ALGORITHM;
  passwordUpdatedAt?: string;
  passwordEscrow?: InvestorPasswordEscrow;
  assignedPassword?: string;
  assignedPasswordPlainText?: string;
  status: InvestorStatus;
  statusReason?: string;
  statusUpdatedAt: string;
  isVerified: boolean;
  createdAt: string;
  totalInvested: number;
  sharesCount: number;
  dividendsEarned: number;
  walletBalance?: number;
  shareAllocations?: InvestorShareAllocation[];
  role: 'investor';
}

export interface ServerFundOperationRequest {
  id: string;
  reference: string;
  idempotencyKey?: string;
  type: 'depot' | 'retrait';
  amount: number;
  investorId: string;
  investorName: string;
  investorEmail: string;
  investorPhone: string;
  adminWhatsApp: string;
  sector?: 'Électronique' | 'Électrotechnique' | 'Informatique';
  paymentMethod?: string;
  notes?: string;
  status: 'En attente' | 'En cours de traitement' | 'Confirmé' | 'Refusé';
  requestedAt: string;
  requestedDateKey?: string;
  validatedBy?: string;
  validatedAt?: string;
  rejectionReason?: string;
}

export interface ServerWalletTransaction {
  id: string;
  investorId?: string;
  investorEmail?: string;
  type: 'depot' | 'retrait' | 'achat_parts' | 'dividende';
  amount: number;
  date: string;
  method: string;
  phone?: string;
  status: 'completed' | 'pending';
  reference: string;
  note?: string;
}

const MIN_FUND_AMOUNT = 500;
const MAX_DEPOSIT_PER_TX = 50_000_000;
const MAX_WITHDRAWAL_PER_TX = 5_000_000;
const MAX_DAILY_WITHDRAWAL = 10_000_000;
const MAX_PENDING_WITHDRAWALS_PER_INVESTOR = 5;

const SECTOR_WHATSAPP_MAP: Record<'Électronique' | 'Électrotechnique' | 'Informatique', string> = {
  Électronique: '+22665484738',
  Électrotechnique: '+22607315734',
  Informatique: '+22656283526'
};

export interface InvestmentOffer {
  id: string;
  ref: string;
  title: string;
  category: string;
  sharePrice: number;
  yield: string;
  yieldType: string;
  duration: string;
  risk: string;
  description: string;
  isOpen: boolean;
  isPublished: boolean;
  minShares?: number;
  maxShares?: number;
}

export interface InvestmentOperation {
  id: string;
  ref: string;
  title: string;
  category: string;
  sector?: 'Électronique' | 'Électrotechnique' | 'Informatique';
  objective?: string;
  yield: string;
  yieldType: string;
  description: string;
  duration: string;
  risk: string;
  riskColor: string;
  targetAmount: number;
  collectedAmount: number;
  percent: number;
  distribution: string;
  investorsCount: number;
  cycleNumber?: number;
  status: 'draft' | 'published' | 'completed';
  offerStatus: 'Brouillon' | 'Ouvert' | 'Suspendu' | 'Fermé';
  isPublished: boolean;
  openDate?: string;
  closeDate?: string;
  offers: InvestmentOffer[];
  sharePrice?: number;
  availableShares?: number;
  subscribedShares?: number;
}

export interface ShareSubscription {
  id: string;
  investorId: string;
  investorName: string;
  investorEmail: string;
  investorPhone: string;
  operationId: string;
  operationTitle: string;
  offerId: string;
  offerTitle: string;
  shares: number;
  sharePrice: number;
  totalAmount: number;
  status: 'pending_admin' | 'approved_pending_payment' | 'paid_and_issued' | 'rejected';
  sharesCredited?: boolean;
  adminPasswordCode?: string;
  requestedAt: string;
  approvedAt?: string;
  paidAt?: string;
  paymentMethod?: string;
}

export interface ServerAdminUser extends StoredUser {
  name: string;
  email: string;
  phone: string;
  role: 'admin_principal' | 'admin_secondaire';
  permissions?: AdminPermission[];
  passwordHash: string;
  passwordSalt?: string;
  passwordAlgorithm?: 'pbkdf2-sha512';
  assignedPasswordPlainText?: string;
  isProtected?: boolean;
  addedDate: string;
}

export interface AdminConfig {
  customAdminUrl: string;
  heroVideoUrl?: string;
  formationsVideoUrl?: string;
  isMaintenanceMode?: boolean;
  isInvestorChatOpen?: boolean;
  masterPasswordHash: string;
  masterPasswordHint: string;
  admins: ServerAdminUser[];
  activeTokens: Record<string, { email: string; role: string; expiresAt: number }>;
}

export interface ServerInvestorMessage {
  id: string;
  senderId?: string;
  senderName: string;
  senderEmail?: string;
  senderRole: 'investor' | 'admin';
  messageType: 'text' | 'voice';
  text: string;
  audioUrl?: string;
  audioDuration?: number;
  time: string;
  createdAt: string;
}

export interface ServerProfitDistribution {
  id: string;
  idempotencyKey?: string;
  projectName: string;
  sector: BoutiqueSector;
  operationId: string;
  operationTitle: string;
  totalProfit?: number;
  investorsAmount: number;
  companyAmount: number;
  individualAmount: number;
  eligibleCount: number;
  recipientIds: string[];
  period: string;
  notes: string;
  distributedAt: string;
  distributedBy: string;
}

export interface AuditAction {
  id: string;
  author: string;
  date: string;
  actionType: string;
  description: string;
  entityType: string;
  targetId?: string;
}

export interface InvestorActivity {
  id: string;
  title: string;
  description?: string;
  desc?: string;
  badge?: string;
  sector?: string;
  photoUrl?: string;
  imageUrl?: string;
  date?: string;
  isPublished?: boolean;
}

export interface InvestorDocument {
  id: string;
  title: string;
  description?: string;
  desc?: string;
  fileUrl?: string;
  format?: string;
  size?: string;
  date?: string;
  isPublished?: boolean;
}

export interface CategoryGroup {
  id: string;
  label: string;
  icon?: string;
  domain?: 'electronique' | 'electrotechnique' | 'informatique';
}

const DEFAULT_CONFIG: AdminConfig = {
  customAdminUrl: '/electromen-gestion',
  heroVideoUrl: '/assets/videos/electromen-hero.mp4',
  formationsVideoUrl: '/assets/videos/electromen-hero.mp4',
  isMaintenanceMode: false,
  isInvestorChatOpen: true,
  masterPasswordHash: '',
  masterPasswordHint: '',
  admins: [],
  activeTokens: {}
};

const processingFundRequests = new Set<string>();
const processingSubscriptions = new Set<string>();
const processingProfitDistributions = new Set<string>();
const processingShareSubscribes = new Set<string>();
const VALID_BOUTIQUE_SECTORS = new Set<BoutiqueSector>(['Électronique', 'Électrotechnique', 'Informatique']);

function sanitizeShareAllocations(
  raw: unknown,
  operations: InvestmentOperation[]
): InvestorShareAllocation[] | null {
  if (!Array.isArray(raw)) return null;
  const opById = new Map(operations.map((op) => [op.id, op]));
  const result: InvestorShareAllocation[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const record = item as Record<string, unknown>;
    const sector = record.sector;
    if (typeof sector !== 'string' || !VALID_BOUTIQUE_SECTORS.has(sector as BoutiqueSector)) {
      return null;
    }
    const shares = validateSafeNonNegativeInt(record.shares, { max: 10_000_000 });
    if (shares === null) return null;

    let cleanOperationId: string | undefined;
    let cleanOperationTitle: string | undefined;
    if (record.operationId !== undefined && record.operationId !== null && record.operationId !== '') {
      const validOpId = validateSafeId(record.operationId);
      if (!validOpId) return null;
      cleanOperationId = validOpId;
      cleanOperationTitle = opById.get(validOpId)?.title;
    }
    if (!cleanOperationTitle && typeof record.operationTitle === 'string' && record.operationTitle.trim()) {
      const sanitizedTitle = sanitizePlainText(record.operationTitle, { maxLength: 160 });
      if (sanitizedTitle === null) return null;
      cleanOperationTitle = sanitizedTitle || undefined;
    }

    const op = cleanOperationId ? opById.get(cleanOperationId) : undefined;
    const opSharePrice = Number(op?.sharePrice) || Number(op?.offers?.[0]?.sharePrice) || 0;
    const computedAmount = record.amount === undefined || record.amount === null || record.amount === ''
      ? (opSharePrice > 0 ? shares * opSharePrice : 0)
      : validateSafeNonNegativeInt(record.amount, { max: 10_000_000_000 });
    if (computedAmount === null) return null;

    const cleanId = (typeof record.id === 'string' && validateSafeId(record.id)) || `alloc-${Date.now()}-${i}`;
    result.push({
      id: cleanId,
      sector: sector as BoutiqueSector,
      ...(cleanOperationId ? { operationId: cleanOperationId } : {}),
      ...(cleanOperationTitle ? { operationTitle: cleanOperationTitle } : {}),
      shares,
      amount: computedAmount,
      updatedAt: new Date().toISOString()
    });
  }
  return result;
}

function mergeInvestorShareAllocation(
  existing: InvestorShareAllocation[] | undefined,
  sector: BoutiqueSector,
  operationId: string | undefined,
  operationTitle: string | undefined,
  sharesDelta: number,
  amountDelta: number
): InvestorShareAllocation[] {
  const list = Array.isArray(existing) ? existing.map((item) => ({ ...item })) : [];
  const idx = list.findIndex(
    (item) => item.sector === sector && (item.operationId || '') === (operationId || '')
  );
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      operationTitle: operationTitle || list[idx].operationTitle,
      shares: Math.max(0, (list[idx].shares || 0) + sharesDelta),
      amount: Math.max(0, (list[idx].amount || 0) + amountDelta),
      updatedAt: new Date().toISOString()
    };
    return list;
  }
  list.push({
    id: `alloc-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    sector,
    ...(operationId ? { operationId } : {}),
    ...(operationTitle ? { operationTitle } : {}),
    shares: Math.max(0, sharesDelta),
    amount: Math.max(0, amountDelta),
    updatedAt: new Date().toISOString()
  });
  return list;
}

async function loadConfig(): Promise<AdminConfig> {
  return readJson<AdminConfig>(CONFIG_FILE, DEFAULT_CONFIG);
}

async function saveConfig(config: AdminConfig): Promise<void> {
  await writeJson(CONFIG_FILE, {
    ...config,
    admins: [],
    activeTokens: {},
    masterPasswordHash: '',
    masterPasswordHint: ''
  });
}

function readLegacyAdminConfig(): AdminConfig {
  if (!fs.existsSync(CONFIG_FILE)) return DEFAULT_CONFIG;
  const parsed: unknown = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Le fichier historique admin-config.json ne contient pas un objet valide.');
  }
  const legacy = parsed as Partial<AdminConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...legacy,
    admins: Array.isArray(legacy.admins) ? legacy.admins : []
  };
}

// Record audit log helper
async function addServerAuditLog(author: string, actionType: string, description: string, entityType: string, targetId?: string): Promise<void> {
  const newLog: AuditAction = {
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    author,
    date: `${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    actionType,
    description,
    entityType,
    targetId
  };
  await appendApplicationRecord('audit-logs', newLog);
  broadcastDataChanged('audit-logs');
}

// =========================================================================
// 1. OTP VERIFICATION ENDPOINTS (EMAIL / PHONE VALIDATION)
// =========================================================================

app.post('/api/auth/send-otp', otpRegisterRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const cleanEmail = validateEmailInput(req.body?.email);
  if (!cleanEmail) {
    return res.status(400).json({ success: false, error: 'Adresse e-mail valide requise.' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await saveUserOtp(cleanEmail, code, new Date(Date.now() + 10 * 60 * 1000));

  console.log(`[ELECTRO-MEN SECURITY OTP] Code généré pour ${cleanEmail} : ${code}`);

  return res.json({
    success: true,
    message: `Code de vérification envoyé à ${cleanEmail}. Valable 10 minutes.`,
    devOtp: code // Available in response for preview/demo verification
  });
}));

app.post('/api/investor/change-password', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const investor = await getAuthenticatedInvestor(req);
  if (!investor) {
    return res.status(401).json({ success: false, error: 'Session expirée. Veuillez vous reconnecter.' });
  }

  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ success: false, error: 'Veuillez renseigner les mots de passe requis.' });
  }
  if (currentPassword.length > 128 || newPassword.length < 12 || newPassword.length > 128) {
    return res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit comporter entre 12 et 128 caractères.' });
  }
  if (!verifyInvestorPassword(currentPassword, investor)) {
    return res.status(400).json({ success: false, error: 'Le mot de passe actuel est incorrect.' });
  }

  const { hash, salt } = hashInvestorPassword(newPassword);
  const passwordEscrow = encryptInvestorEscrowPassword(newPassword);
  const updatedInvestor = await updateInvestor<ServerInvestorUser>(investor.id, (current) => {
    const {
      assignedPassword: _assignedPassword,
      assignedPasswordPlainText: _assignedPasswordPlainText,
      ...withoutLegacyPassword
    } = current;
    return {
      ...withoutLegacyPassword,
      passwordHash: hash,
      passwordSalt: salt,
      passwordAlgorithm: INVESTOR_PASSWORD_ALGORITHM,
      passwordUpdatedAt: new Date().toISOString(),
      passwordEscrow
    };
  });
  if (!updatedInvestor) {
    return res.status(404).json({ success: false, error: 'Compte investisseur introuvable.' });
  }

  const token = getInvestorSessionToken(req);
  if (token) {
    await deleteOtherInvestorSessions(
      investor.id,
      crypto.createHash('sha256').update(token).digest('hex')
    );
  }
  return res.json({ success: true, message: 'Votre mot de passe a été modifié.' });
}));

app.post('/api/auth/verify-otp', otpRegisterRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const cleanEmail = validateEmailInput(req.body?.email);
  const rawCode = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!cleanEmail || !/^\d{6}$/.test(rawCode)) {
    return res.status(400).json({ success: false, error: 'Email et code OTP à 6 chiffres requis.' });
  }

  const entry = await findUserOtp(cleanEmail);

  if (!entry) {
    return res.status(400).json({ success: false, error: 'Aucun code généré pour cette adresse ou code expiré. Demandez un nouveau code.' });
  }

  if (Date.now() > entry.expiresAt.getTime()) {
    await deleteUserOtp(cleanEmail);
    return res.status(400).json({ success: false, error: 'Ce code a expiré. Veuillez en générer un nouveau.' });
  }

  const attempts = await incrementUserOtpAttempts(cleanEmail);
  if (attempts > 5) {
    await deleteUserOtp(cleanEmail);
    return res.status(429).json({ success: false, error: 'Nombre maximal de tentatives dépassé. Veuillez générer un nouveau code.' });
  }

  if (entry.code !== rawCode) {
    return res.status(400).json({ success: false, error: 'Code de vérification incorrect. Veuillez vérifier.' });
  }

  await deleteUserOtp(cleanEmail);
  const client = await findUserByEmail<ServerClientUser>(cleanEmail);
  if (!client || client.role !== 'client') {
    return res.status(404).json({ success: false, error: 'Compte client introuvable.' });
  }
  await updateUser(client.id, { ...client, isVerified: true });

  return res.json({ success: true, message: 'Adresse e-mail vérifiée avec succès.' });
}));

// =========================================================================
// 2. CLIENT ACCOUNT MANAGEMENT (STRICT VALIDATION & OWASP PASSWORDS)
// =========================================================================

app.post('/api/auth/register-client', otpRegisterRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const { lastName, firstName, email, phone, city, accountType, password, termsAccepted } = req.body || {};

  if (termsAccepted !== true) {
    return res.status(400).json({ success: false, error: 'Vous devez accepter les Conditions d’Utilisation et la Politique de Confidentialité.' });
  }

  if (
    typeof lastName !== 'string' ||
    typeof firstName !== 'string' ||
    typeof email !== 'string' ||
    typeof phone !== 'string' ||
    typeof password !== 'string'
  ) {
    return res.status(400).json({ success: false, error: 'Veuillez renseigner tous les champs obligatoires avec des textes valides.' });
  }

  const identityCheck = validateRealIdentity(lastName, firstName, email, phone);
  if (!identityCheck.valid) {
    return res.status(400).json({ success: false, error: identityCheck.error });
  }

  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter entre 6 et 128 caractères.' });
  }

  const cleanEmail = validateEmailInput(email);
  const cleanPhone = validatePhoneInput(phone);
  const cleanLastName = sanitizePlainText(lastName, { minLength: 2, maxLength: 60, required: true });
  const cleanFirstName = sanitizePlainText(firstName, { minLength: 2, maxLength: 60, required: true });
  const cleanCity = city !== undefined ? sanitizePlainText(city, { maxLength: 80 }) : 'Ouagadougou';
  const cleanAccountType = accountType !== undefined ? sanitizePlainText(accountType, { maxLength: 60 }) : 'Client Particulier';
  if (!cleanEmail || !cleanPhone || !cleanLastName || !cleanFirstName || cleanCity === null || cleanAccountType === null) {
    return res.status(400).json({ success: false, error: 'Certains champs contiennent des caractères invalides ou dépassent la taille autorisée.' });
  }

  if (await findUserByEmail<StoredUser>(cleanEmail)) {
    return res.status(409).json({ success: false, error: 'Un compte utilisateur existe déjà avec cette adresse e-mail. Veuillez vous connecter.' });
  }

  const { hash, salt } = hashPasswordSecure(password);
  const fullName = `${cleanLastName.toUpperCase()} ${cleanFirstName}`;
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const newClient: ServerClientUser = {
    id: crypto.randomUUID(),
    lastName: cleanLastName,
    firstName: cleanFirstName,
    name: fullName,
    email: cleanEmail,
    phone: cleanPhone,
    city: cleanCity || 'Ouagadougou',
    accountType: cleanAccountType || 'Client Particulier',
    passwordHash: hash,
    passwordSalt: salt,
    isVerified: false, // Must be verified by OTP
    registeredDate: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    role: 'client'
  };

  try {
    await createUserWithOtp(newClient, otpCode, new Date(Date.now() + 10 * 60 * 1000));
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return res.status(409).json({ success: false, error: 'Un compte utilisateur existe déjà avec cet e-mail ou ce numéro de téléphone.' });
    }
    throw error;
  }

  await addServerAuditLog(fullName, 'register_client', `Création du compte client ${fullName} (${cleanEmail})`, 'client', newClient.id);

  return res.status(201).json({
    success: true,
    message: 'Compte client créé avec succès. Veuillez saisir le code OTP envoyé pour vérifier votre adresse e-mail.',
    devOtp: otpCode,
    client: {
      id: newClient.id,
      name: newClient.name,
      email: newClient.email,
      phone: newClient.phone,
      isVerified: false
    }
  });
}));

app.post('/api/auth/login-client', authRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const cleanEmail = validateEmailInput(email);
  if (!cleanEmail || typeof password !== 'string' || !password || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Adresse e-mail valide et mot de passe requis.' });
  }

  const rateLimit = checkRateLimit(cleanEmail);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.remainingSeconds ?? 60));
    return res.status(429).json({
      success: false,
      error: `Trop de tentatives de connexion infructueuses. Compte temporairement verrouillé pour ${rateLimit.remainingSeconds} secondes.`
    });
  }

  const client = await findUserByEmail<ServerClientUser>(cleanEmail);

  if (!client || client.role !== 'client') {
    recordFailedAttempt(cleanEmail);
    return res.status(401).json({ success: false, error: 'Identifiants invalides.' });
  }

  const isMatch = verifyPasswordSecure(password, client.passwordHash, client.passwordSalt);
  if (!isMatch) {
    recordFailedAttempt(cleanEmail);
    return res.status(401).json({ success: false, error: 'Identifiants invalides.' });
  }

  recordSuccessfulAttempt(cleanEmail);
  const token = await establishUserSession(client, req, res, CLIENT_SESSION_COOKIE, INVESTOR_SESSION_DURATION_MS);

  return res.json({
    success: true,
    token,
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      city: client.city,
      isVerified: client.isVerified,
      registeredDate: client.registeredDate
    }
  });
}));

// =========================================================================
// 3. INVESTOR ACCOUNTS & ADMISSION WORKFLOW (SEPARATE & SECURE)
// =========================================================================

function investorConflictMessage(error: unknown): string | null {
  const databaseError = error as { code?: string; constraint?: string };
  if (databaseError.code !== '23505') return null;
  if (databaseError.constraint?.includes('email')) {
    return 'Un compte investisseur existe déjà avec cette adresse e-mail.';
  }
  if (databaseError.constraint?.includes('phone')) {
    return 'Un compte investisseur existe déjà avec ce numéro de téléphone.';
  }
  return 'Cet identifiant investisseur est déjà utilisé. Veuillez réessayer.';
}

app.post('/api/investor/register', otpRegisterRateLimiter, async (req: Request, res: Response) => {
  const { lastName, firstName, email, phone, password, termsAccepted } = req.body || {};
  if (
    typeof lastName !== 'string' ||
    typeof firstName !== 'string' ||
    typeof email !== 'string' ||
    typeof phone !== 'string' ||
    typeof password !== 'string'
  ) {
    return res.status(400).json({ success: false, error: 'Veuillez renseigner tous les champs obligatoires.' });
  }
  if (termsAccepted !== true) {
    return res.status(400).json({ success: false, error: 'Vous devez accepter les Conditions Générales et la Charte des Investisseurs.' });
  }

  const identityCheck = validateRealIdentity(lastName, firstName, email, phone);
  if (!identityCheck.valid) {
    return res.status(400).json({ success: false, error: identityCheck.error });
  }
  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter entre 12 et 128 caractères.' });
  }

  const cleanEmail = validateEmailInput(email);
  const cleanPhone = validatePhoneInput(phone);
  const cleanLastName = sanitizePlainText(lastName, { minLength: 2, maxLength: 60, required: true });
  const cleanFirstName = sanitizePlainText(firstName, { minLength: 2, maxLength: 60, required: true });
  if (!cleanEmail || !cleanPhone || !cleanLastName || !cleanFirstName) {
    return res.status(400).json({ success: false, error: 'Les informations saisies sont invalides.' });
  }

  try {
    if (await findInvestorByEmail<ServerInvestorUser>(cleanEmail)) {
      return res.status(409).json({ success: false, error: 'Un compte investisseur existe déjà avec cette adresse e-mail.' });
    }

    const { hash, salt } = hashInvestorPassword(password);
    const passwordEscrow = encryptInvestorEscrowPassword(password);
    const fullName = `${cleanFirstName} ${cleanLastName}`;
    const newInvestor: ServerInvestorUser = {
      id: crypto.randomUUID(),
      lastName: cleanLastName,
      firstName: cleanFirstName,
      name: fullName,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash: hash,
      passwordSalt: salt,
      passwordAlgorithm: INVESTOR_PASSWORD_ALGORITHM,
      passwordUpdatedAt: new Date().toISOString(),
      passwordEscrow,
      status: 'en_attente',
      statusReason: 'Demande soumise par l’utilisateur, en cours d’examen par l’administrateur.',
      statusUpdatedAt: new Date().toLocaleDateString('fr-FR'),
      isVerified: false,
      createdAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
      totalInvested: 0,
      sharesCount: 0,
      dividendsEarned: 0,
      walletBalance: 0,
      role: 'investor'
    };

    await createInvestor(newInvestor);
    await establishInvestorSession(newInvestor, req, res);
    await addServerAuditLog(fullName, 'investor_application', `Nouvelle candidature investisseur : ${fullName} (${cleanEmail})`, 'investor', newInvestor.id);
    try {
      broadcastPresenceUpdate();
    } catch {}

    return res.status(201).json({
      success: true,
      message: 'Votre compte investisseur a été créé. Votre dossier est en attente d’approbation administrative.',
      investor: publicInvestor(newInvestor)
    });
  } catch (error) {
    const conflictMessage = investorConflictMessage(error);
    if (conflictMessage) {
      return res.status(409).json({ success: false, error: conflictMessage });
    }
    console.error('Investor registration failed:', error);
    return res.status(500).json({ success: false, error: 'La création du compte a échoué. Veuillez réessayer.' });
  }
});

app.post('/api/investor/login', authRateLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const cleanEmail = validateEmailInput(email);
  if (!cleanEmail || typeof password !== 'string' || !password || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Veuillez renseigner une adresse e-mail et un mot de passe valides.' });
  }

  const attemptKey = `investor:${cleanEmail}`;
  const rateLimit = checkRateLimit(attemptKey);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.remainingSeconds ?? 60));
    return res.status(429).json({
      success: false,
      error: `Trop de tentatives. Réessayez dans ${rateLimit.remainingSeconds} secondes.`
    });
  }

  try {
    const investor = await findInvestorByEmail<ServerInvestorUser>(cleanEmail);
    if (!investor || !verifyInvestorPassword(password, investor)) {
      recordFailedAttempt(attemptKey);
      return res.status(401).json({ success: false, error: 'Adresse e-mail ou mot de passe incorrect.' });
    }
    if (investor.status === 'bloque' || investor.status === 'suspendu') {
      return res.status(403).json({ success: false, error: 'Ce compte investisseur est temporairement suspendu. Contactez l’administrateur.' });
    }

    recordSuccessfulAttempt(attemptKey);
    let authenticatedInvestor = investor;
    if (
      investor.passwordAlgorithm !== INVESTOR_PASSWORD_ALGORITHM ||
      investor.assignedPassword !== undefined ||
      investor.assignedPasswordPlainText !== undefined
    ) {
      const upgradedInvestor = await updateInvestor<ServerInvestorUser>(
        investor.id,
        (current) => ({
          ...withInvestorPassword(current, password),
          passwordEscrow: encryptInvestorEscrowPassword(password)
        })
      );
      if (!upgradedInvestor) {
        return res.status(500).json({ success: false, error: 'La mise à jour sécurisée du compte a échoué.' });
      }
      authenticatedInvestor = upgradedInvestor;
    }

    await establishInvestorSession(authenticatedInvestor, req, res);
    return res.json({ success: true, investor: publicInvestor(authenticatedInvestor) });
  } catch (error) {
    console.error('Investor login failed:', error);
    return res.status(500).json({ success: false, error: 'La connexion est momentanément indisponible.' });
  }
});

app.get('/api/investor/me', async (req: Request, res: Response) => {
  try {
    const investor = await getAuthenticatedInvestor(req);
    if (!investor) return res.status(401).json({ success: false, error: 'Session expirée. Veuillez vous reconnecter.' });
    return res.json({ success: true, investor: publicInvestor(investor) });
  } catch (error) {
    console.error('Investor session lookup failed:', error);
    return res.status(500).json({ success: false, error: 'La vérification de session a échoué.' });
  }
});

app.get('/api/investor/subscriptions', asyncRoute(async (req: Request, res: Response) => {
  const investor = await getAuthenticatedInvestor(req);
  if (!investor) {
    return res.status(401).json({ success: false, error: 'Session expirée. Veuillez vous reconnecter.' });
  }

  const legacyIdentity = investor as ServerInvestorUser & {
    investorId?: unknown;
    investor_id?: unknown;
    userId?: unknown;
    user_id?: unknown;
  };
  const legacyIds = [
    legacyIdentity.investorId,
    legacyIdentity.investor_id,
    legacyIdentity.userId,
    legacyIdentity.user_id
  ].filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  const subscriptions = await readInvestorSubscriptions<ShareSubscription>({
    id: investor.id,
    email: investor.email,
    legacyIds
  });
  return res.json({ success: true, subscriptions });
}));

app.post('/api/investor/logout', async (req: Request, res: Response) => {
  try {
    const token = getInvestorSessionToken(req);
    if (token) {
      await deleteInvestorSession(crypto.createHash('sha256').update(token).digest('hex'));
    }
    clearInvestorSessionCookie(req, res);
    return res.json({ success: true });
  } catch (error) {
    console.error('Investor logout failed:', error);
    return res.status(500).json({ success: false, error: 'La déconnexion n’a pas pu être confirmée.' });
  }
});

// =========================================================================
// 3B. STRICT SERVER-SIDE INVESTOR WALLET & WITHDRAWAL ENFORCEMENT
// =========================================================================

function getTodayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getRealInvestorBalance(investor: ServerInvestorUser): number {
  return Number.isSafeInteger(investor.walletBalance) && (investor.walletBalance ?? 0) >= 0
    ? (investor.walletBalance as number)
    : 0;
}

function belongsToInvestor(
  record: { investorId?: string; investorEmail?: string },
  investor: ServerInvestorUser
): boolean {
  const email = investor.email.trim().toLowerCase();
  if (typeof record.investorId === 'string' && record.investorId.trim() === investor.id) {
    return true;
  }
  return typeof record.investorEmail === 'string' && record.investorEmail.trim().toLowerCase() === email;
}

app.get('/api/investor/wallet', asyncRoute(async (req: Request, res: Response) => {
  const sessionInvestor = await getAuthenticatedInvestor(req);
  if (!sessionInvestor) {
    return res.status(401).json({ success: false, error: 'Session expirée. Veuillez vous reconnecter.' });
  }
  const investor = await findInvestorByIdentifier<ServerInvestorUser>(sessionInvestor.id);
  if (!investor) {
    return res.status(404).json({ success: false, error: 'Compte investisseur introuvable.' });
  }

  const allRequests = await readApplicationData<ServerFundOperationRequest[]>('fund-requests', []);
  const myRequests = allRequests.filter((r) => belongsToInvestor(r, investor));
  const pendingWithdrawalsTotal = myRequests
    .filter((r) => r.type === 'retrait' && (r.status === 'En attente' || r.status === 'En cours de traitement'))
    .reduce((sum, r) => sum + (Number.isSafeInteger(r.amount) && r.amount > 0 ? r.amount : 0), 0);

  const realBalance = getRealInvestorBalance(investor);
  const availableWithdrawalBalance = Math.max(0, realBalance - pendingWithdrawalsTotal);

  const allTx = await readApplicationData<ServerWalletTransaction[]>('wallet-transactions', []);
  const myTx = allTx.filter((tx) => belongsToInvestor(tx, investor));

  return res.json({
    success: true,
    wallet: {
      balance: realBalance,
      availableWithdrawalBalance,
      pendingWithdrawalsTotal,
      sharesCount: investor.sharesCount || 0,
      dividendsEarned: investor.dividendsEarned || 0,
      totalInvested: investor.totalInvested || 0
    },
    limits: {
      minAmount: MIN_FUND_AMOUNT,
      maxDepositPerTx: MAX_DEPOSIT_PER_TX,
      maxWithdrawalPerTx: MAX_WITHDRAWAL_PER_TX,
      maxDailyWithdrawal: MAX_DAILY_WITHDRAWAL,
      maxPendingWithdrawals: MAX_PENDING_WITHDRAWALS_PER_INVESTOR
    },
    fundRequests: myRequests,
    transactions: myTx
  });
}));

app.post('/api/investor/fund-requests', fundRequestRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const sessionInvestor = await getAuthenticatedInvestor(req);
  if (!sessionInvestor) {
    return res.status(401).json({ success: false, error: 'Authentification investisseur requise pour soumettre une opération financière.' });
  }

  const investor = await findInvestorByIdentifier<ServerInvestorUser>(sessionInvestor.id);
  if (!investor) {
    return res.status(404).json({ success: false, error: 'Compte investisseur introuvable.' });
  }

  if (investor.status !== 'approuve') {
    return res.status(403).json({
      success: false,
      error: `Opération refusée : votre compte investisseur a le statut "${investor.status}". Seuls les comptes approuvés peuvent effectuer des dépôts ou des retraits.`
    });
  }

  const body = req.body || {};
  const type = body.type;
  if (type !== 'depot' && type !== 'retrait') {
    return res.status(400).json({ success: false, error: 'Type d’opération invalide (depot ou retrait attendu).' });
  }

  const rawAmount = typeof body.amount === 'string' || typeof body.amount === 'number'
    ? Number(typeof body.amount === 'string' ? body.amount.trim() : body.amount)
    : Number.NaN;
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return res.status(400).json({ success: false, error: 'Le montant doit être strictement positif (supérieur à 0 FCFA).' });
  }

  const maxAllowed = type === 'depot' ? MAX_DEPOSIT_PER_TX : MAX_WITHDRAWAL_PER_TX;
  const amount = validateSafePositiveInt(body.amount, { min: MIN_FUND_AMOUNT, max: maxAllowed });
  if (amount === null) {
    if (Number.isSafeInteger(rawAmount) && rawAmount > maxAllowed) {
      return res.status(400).json({
        success: false,
        error: `Montant refusé : le plafond maximal autorisé par ${type === 'depot' ? 'dépôt' : 'retrait'} est de ${maxAllowed.toLocaleString('fr-FR')} FCFA.`
      });
    }
    return res.status(400).json({
      success: false,
      error: `Le montant doit être un entier valide compris entre ${MIN_FUND_AMOUNT.toLocaleString('fr-FR')} et ${maxAllowed.toLocaleString('fr-FR')} FCFA.`
    });
  }

  const sectorInputRaw = body.sector ?? 'Électronique';
  if (sectorInputRaw !== 'Électronique' && sectorInputRaw !== 'Électrotechnique' && sectorInputRaw !== 'Informatique') {
    return res.status(400).json({ success: false, error: 'Secteur d’investissement invalide.' });
  }
  const sectorInput: 'Électronique' | 'Électrotechnique' | 'Informatique' = sectorInputRaw;

  const paymentMethod = body.paymentMethod !== undefined
    ? sanitizePlainText(body.paymentMethod, { minLength: 2, maxLength: 100, required: true })
    : 'Orange Money';
  if (paymentMethod === null) {
    return res.status(400).json({ success: false, error: 'Moyen de paiement invalide ou trop long.' });
  }

  const phoneToUse = body.investorPhone !== undefined
    ? validatePhoneInput(body.investorPhone)
    : validatePhoneInput(investor.phone);
  if (!phoneToUse) {
    return res.status(400).json({ success: false, error: 'Numéro de téléphone Mobile Money invalide.' });
  }

  const notes = body.notes !== undefined
    ? sanitizePlainText(body.notes, { maxLength: 300 })
    : `Demande de ${type === 'depot' ? 'dépôt' : 'retrait'} initiée pour le secteur ${sectorInput}.`;
  if (notes === null) {
    return res.status(400).json({ success: false, error: 'Notes invalides ou dépassant 300 caractères.' });
  }

  const rawIdempotencyKey = req.get('X-Idempotency-Key') ?? body.idempotencyKey;
  let idempotencyKey: string | undefined;
  if (rawIdempotencyKey !== undefined) {
    const validKey = validateSafeId(rawIdempotencyKey, 120);
    if (!validKey) {
      return res.status(400).json({ success: false, error: 'Clé d’idempotence invalide.' });
    }
    idempotencyKey = validKey;
  }

  const refPrefix = type === 'depot' ? 'DEP' : 'RET';
  const requestedRef = typeof body.reference === 'string' && /^[A-Z0-9-]{4,30}$/.test(body.reference.trim())
    ? body.reference.trim()
    : `${refPrefix}-${Math.floor(10000 + Math.random() * 90000)}`;

  const now = new Date();
  const formattedDate = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
  const todayDateKey = getTodayDateKey();

  let outcome: { request: ServerFundOperationRequest; duplicate: boolean };
  try {
    outcome = await createFundRequestAtomic<ServerFundOperationRequest>({
      investorId: investor.id,
      investorEmail: investor.email,
      idempotencyKey,
      todayDateKey,
      maxDailyWithdrawal: MAX_DAILY_WITHDRAWAL,
      maxPendingWithdrawals: MAX_PENDING_WITHDRAWALS_PER_INVESTOR,
      buildRequest: () => ({
        id: `req-fund-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        reference: requestedRef,
        ...(idempotencyKey ? { idempotencyKey } : {}),
        type,
        amount,
        investorId: investor.id,
        investorName: investor.name,
        investorEmail: investor.email,
        investorPhone: phoneToUse,
        adminWhatsApp: SECTOR_WHATSAPP_MAP[sectorInput],
        sector: sectorInput,
        paymentMethod,
        notes,
        status: 'En attente',
        requestedAt: formattedDate,
        requestedDateKey: todayDateKey
      })
    });
  } catch (error) {
    if (error instanceof FundRequestRuleError) {
      if (type === 'retrait') {
        trackAbnormalWithdrawalAttempt(investor.id, getClientIp(req), error.message);
      }
      return res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    }
    throw error;
  }

  if (outcome.duplicate) {
    return res.status(200).json({
      success: true,
      duplicate: true,
      request: outcome.request
    });
  }

  await addServerAuditLog(
    investor.name,
    'request_fund_operation',
    `Demande de ${type === 'depot' ? 'dépôt' : 'retrait'} de ${amount.toLocaleString('fr-FR')} FCFA (${outcome.request.reference})`,
    'wallet',
    outcome.request.id
  );
  broadcastDataChanged('fund-requests');

  return res.status(201).json({
    success: true,
    request: outcome.request
  });
}));

// Admin Fund Requests & Wallet Management (Protected by /api/admin auth middleware)
app.get('/api/admin/fund-requests', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminAnyPermission(req, res, ['manage_funds', 'manage_wallet_adjust']);
  if (!admin) return;
  const [fundRequests, transactions] = await Promise.all([
    readApplicationData<ServerFundOperationRequest[]>('fund-requests', []),
    readApplicationData<ServerWalletTransaction[]>('wallet-transactions', [])
  ]);
  return res.json({ success: true, fundRequests, transactions });
}));

app.patch('/api/admin/fund-requests/:id/processing', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_funds');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant de demande invalide.' });
  if (processingFundRequests.has(id)) {
    return res.status(409).json({ success: false, error: 'Cette demande est déjà en cours de traitement.' });
  }
  processingFundRequests.add(id);
  try {
    let notPendingStatus: string | undefined;
    const updated = await updateApplicationRecord<ServerFundOperationRequest>('fund-requests', id, (current) => {
      if (current.status !== 'En attente') {
        notPendingStatus = current.status;
        return current;
      }
      return {
        ...current,
        status: 'En cours de traitement'
      };
    });
    if (!updated) return res.status(404).json({ success: false, error: 'Demande de fonds introuvable.' });
    if (notPendingStatus) {
      return res.status(409).json({ success: false, error: `Seule une demande en attente peut passer en cours de traitement (statut actuel : "${notPendingStatus}").` });
    }
    broadcastDataChanged('fund-requests');
    return res.json({ success: true, request: updated });
  } finally {
    processingFundRequests.delete(id);
  }
}));

app.post('/api/admin/fund-requests/:id/confirm', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_funds');
  if (!admin) return;

  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant de demande invalide.' });
  if (processingFundRequests.has(id)) {
    return res.status(409).json({ success: false, error: 'Validation déjà en cours pour cette demande.' });
  }
  processingFundRequests.add(id);

  try {
    // Atomically claim the pending request before adjusting balance to prevent parallel double-confirmation
    let claimedTarget: ServerFundOperationRequest | undefined;
    let alreadyFinalStatus: string | undefined;
    let previousStatus: ServerFundOperationRequest['status'] = 'En attente';
    const claimResult = await updateApplicationRecord<ServerFundOperationRequest>('fund-requests', id, (current) => {
      if (current.status === 'Confirmé' || current.status === 'Refusé') {
        alreadyFinalStatus = current.status;
        return current;
      }
      previousStatus = current.status;
      claimedTarget = current;
      return {
        ...current,
        status: 'En cours de traitement'
      };
    });

    if (!claimResult) return res.status(404).json({ success: false, error: 'Demande introuvable.' });
    if (alreadyFinalStatus || !claimedTarget) {
      return res.status(409).json({ success: false, error: `Cette demande a déjà le statut "${alreadyFinalStatus || claimResult.status}".` });
    }
    const target = claimedTarget;

    const investor = await findInvestorByIdentifier<ServerInvestorUser>(target.investorId || target.investorEmail);
    if (!investor) {
      await updateApplicationRecord<ServerFundOperationRequest>('fund-requests', id, (current) =>
        current.status === 'En cours de traitement' ? { ...current, status: previousStatus } : current
      ).catch(() => {});
      return res.status(404).json({ success: false, error: 'Compte investisseur associé introuvable.' });
    }

    const delta = target.type === 'depot' ? target.amount : -target.amount;
    let balanceResult;
    try {
      balanceResult = await adjustInvestorWalletBalance<ServerInvestorUser>(investor.id, delta);
    } catch (error) {
      await updateApplicationRecord<ServerFundOperationRequest>('fund-requests', id, (current) =>
        current.status === 'En cours de traitement' ? { ...current, status: previousStatus } : current
      ).catch(() => {});
      if (error instanceof InsufficientBalanceError) {
        return res.status(400).json({
          success: false,
          error: `Confirmation impossible : ${error.message}`
        });
      }
      throw error;
    }
    if (!balanceResult) {
      await updateApplicationRecord<ServerFundOperationRequest>('fund-requests', id, (current) =>
        current.status === 'En cours de traitement' ? { ...current, status: previousStatus } : current
      ).catch(() => {});
      return res.status(404).json({ success: false, error: 'Compte investisseur introuvable.' });
    }

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
    const adminLabel = `${admin.name} (${admin.role === 'admin_principal' ? 'Super-Admin' : 'Admin Secondaire'})`;

    const updatedReq = await updateApplicationRecord<ServerFundOperationRequest>('fund-requests', id, (current) => ({
      ...current,
      status: 'Confirmé',
      validatedBy: adminLabel,
      validatedAt: formattedDate
    }));

    const newTx: ServerWalletTransaction = {
      id: `tx-fund-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      investorId: investor.id,
      investorEmail: investor.email,
      type: target.type === 'depot' ? 'depot' : 'retrait',
      amount: target.amount,
      date: formattedDate,
      method: target.paymentMethod || 'Mobile Money (+226)',
      phone: target.investorPhone,
      status: 'completed',
      reference: target.reference,
      note: `${target.type === 'depot' ? 'Dépôt' : 'Retrait'} admis par ${admin.name}`
    };
    await appendApplicationRecord('wallet-transactions', newTx);

    await addServerAuditLog(
      admin.name,
      'confirm_fund_operation',
      `Confirmation effective ${target.type === 'depot' ? 'du dépôt' : 'du retrait'} de ${target.amount.toLocaleString('fr-FR')} FCFA pour ${target.investorName} (${target.reference})`,
      'wallet',
      id
    );
    broadcastDataChanged('fund-requests');
    broadcastDataChanged('investors');

    return res.json({
      success: true,
      request: updatedReq,
      walletBalance: balanceResult.newBalance,
      transaction: newTx
    });
  } finally {
    processingFundRequests.delete(id);
  }
}));

app.post('/api/admin/fund-requests/:id/reject', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_funds');
  if (!admin) return;

  const id = validateSafeId(req.params.id);
  const reason = sanitizePlainText(req.body?.reason, { minLength: 2, maxLength: 300, required: true });
  if (!id || !reason) {
    return res.status(400).json({ success: false, error: 'Identifiant et motif de refus valides requis.' });
  }
  if (processingFundRequests.has(id)) {
    return res.status(409).json({ success: false, error: 'Une action est déjà en cours sur cette demande.' });
  }
  processingFundRequests.add(id);

  try {
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
    let alreadyFinalStatus: string | undefined;
    let rejectedTarget: ServerFundOperationRequest | undefined;
    const updatedReq = await updateApplicationRecord<ServerFundOperationRequest>('fund-requests', id, (current) => {
      if (current.status === 'Confirmé' || current.status === 'Refusé') {
        alreadyFinalStatus = current.status;
        return current;
      }
      rejectedTarget = {
        ...current,
        status: 'Refusé',
        rejectionReason: reason,
        validatedBy: admin.name,
        validatedAt: formattedDate
      };
      return rejectedTarget;
    });

    if (!updatedReq) return res.status(404).json({ success: false, error: 'Demande introuvable.' });
    if (alreadyFinalStatus || !rejectedTarget) {
      return res.status(409).json({ success: false, error: `Cette demande a déjà le statut "${alreadyFinalStatus || updatedReq.status}".` });
    }

    await addServerAuditLog(
      admin.name,
      'reject_fund_operation',
      `Rejet de la demande ${rejectedTarget.reference} (${rejectedTarget.amount.toLocaleString('fr-FR')} FCFA) pour ${rejectedTarget.investorName}. Motif : ${reason}`,
      'wallet',
      id
    );
    broadcastDataChanged('fund-requests');

    return res.json({ success: true, request: updatedReq });
  } finally {
    processingFundRequests.delete(id);
  }
}));

app.delete('/api/admin/fund-requests/:id', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Seul l’administrateur principal peut supprimer une demande de fonds.' });
  }
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });

  const all = await readApplicationData<ServerFundOperationRequest[]>('fund-requests', []);
  const target = all.find((r) => r.id === id);
  if (!target) return res.status(404).json({ success: false, error: 'Demande introuvable.' });

  await archiveItem('fund-request', target.id, `${target.reference} (${target.investorName})`, target);
  await deleteApplicationRecord('fund-requests', id);
  broadcastDataChanged('fund-requests');
  return res.json({ success: true, message: 'Demande de fonds archivée.' });
}));

app.post('/api/admin/wallet/adjust', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_wallet_adjust');
  if (!admin) return;
  const { email, investorId, deltaBalance, reason } = req.body || {};
  const identifier = typeof investorId === 'string' && investorId.trim()
    ? validateSafeId(investorId)
    : validateEmailInput(email);
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Investisseur ou adresse e-mail valide requis.' });
  }

  const parsedDelta = typeof deltaBalance === 'number' ? deltaBalance : Number(deltaBalance);
  if (
    !Number.isSafeInteger(parsedDelta) ||
    parsedDelta === 0 ||
    Math.abs(parsedDelta) > MAX_DEPOSIT_PER_TX
  ) {
    return res.status(400).json({
      success: false,
      error: `Le montant d’ajustement doit être un entier non nul compris entre -${MAX_DEPOSIT_PER_TX.toLocaleString('fr-FR')} et +${MAX_DEPOSIT_PER_TX.toLocaleString('fr-FR')} FCFA.`
    });
  }

  const cleanReason = sanitizePlainText(reason, { maxLength: 300 }) || 'Régularisation administrative';

  let result;
  try {
    result = await adjustInvestorWalletBalance<ServerInvestorUser>(identifier, parsedDelta);
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return res.status(400).json({
        success: false,
        error: `Débit refusé : ${error.message}`
      });
    }
    throw error;
  }
  if (!result) return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });

  const now = new Date();
  const formattedDate = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
  const tx: ServerWalletTransaction = {
    id: `tx-adm-adj-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    investorId: result.investor.id,
    investorEmail: result.investor.email,
    type: parsedDelta >= 0 ? 'depot' : 'retrait',
    amount: Math.abs(parsedDelta),
    date: formattedDate,
    method: `Ajustement (${admin.name})`,
    status: 'completed',
    reference: `ADM-ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
    note: cleanReason
  };
  await appendApplicationRecord('wallet-transactions', tx);
  await addServerAuditLog(
    admin.name,
    'adjust_wallet',
    `Ajustement de solde (${parsedDelta >= 0 ? '+' : ''}${parsedDelta.toLocaleString('fr-FR')} FCFA) pour ${result.investor.email}. Motif : ${cleanReason}`,
    'wallet',
    result.investor.id
  );
  broadcastDataChanged('investors');
  broadcastDataChanged('fund-requests');

  return res.json({
    success: true,
    investor: publicInvestor(result.investor),
    walletBalance: result.newBalance,
    transaction: tx
  });
}));

app.get('/api/profit-distributions', asyncRoute(async (req: Request, res: Response) => {
  const [admin, investor] = await Promise.all([getAuthenticatedAdmin(req), getAuthenticatedInvestor(req)]);
  if (!admin && !investor) {
    return res.status(401).json({ success: false, error: 'Session requise pour consulter les distributions de gains.' });
  }
  const distributions = await readApplicationData<ServerProfitDistribution[]>('profit-distributions', []);
  return res.json({ success: true, distributions });
}));

app.post('/api/admin/profits/distribute', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_subscriptions');
  if (!admin) return;
  const { investorsAmount, companyAmount, totalProfit, projectName, notes, sector, operationId, period } = req.body || {};
  const parsedInvestorsAmount = validateSafePositiveInt(investorsAmount, { min: 1, max: 500_000_000 });
  const parsedCompanyAmount = companyAmount === undefined ? 0 : validateSafeNonNegativeInt(companyAmount, { max: 500_000_000 });
  const parsedTotalProfit = totalProfit === undefined
    ? parsedInvestorsAmount !== null && parsedCompanyAmount !== null
      ? parsedInvestorsAmount + parsedCompanyAmount
      : null
    : validateSafeNonNegativeInt(totalProfit, { max: 1_000_000_000 });
  if (parsedInvestorsAmount === null || parsedCompanyAmount === null || parsedTotalProfit === null) {
    return res.status(400).json({ success: false, error: 'Les montants de distribution doivent être des entiers positifs valides.' });
  }

  if (typeof sector !== 'string' || !VALID_BOUTIQUE_SECTORS.has(sector as BoutiqueSector)) {
    return res.status(400).json({ success: false, error: 'Veuillez sélectionner une boutique valide (Électronique, Électrotechnique ou Informatique).' });
  }
  const cleanSector = sector as BoutiqueSector;

  const cleanOperationId = validateSafeId(operationId);
  if (!cleanOperationId) {
    return res.status(400).json({ success: false, error: 'Veuillez sélectionner une opération cible valide pour cette boutique.' });
  }

  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const operation = operations.find((op) => op.id === cleanOperationId);
  if (!operation) {
    return res.status(404).json({ success: false, error: 'Opération cible introuvable.' });
  }
  if (operation.sector && operation.sector !== cleanSector) {
    return res.status(400).json({
      success: false,
      error: `L’opération « ${operation.title} » appartient à la boutique ${operation.sector} et non à ${cleanSector}.`
    });
  }

  const rawIdempotencyKey = req.get('X-Idempotency-Key') ?? req.body?.idempotencyKey;
  let idempotencyKey: string | undefined;
  if (rawIdempotencyKey !== undefined) {
    const validKey = validateSafeId(rawIdempotencyKey, 120);
    if (!validKey) {
      return res.status(400).json({ success: false, error: 'Clé d’idempotence invalide.' });
    }
    idempotencyKey = validKey;
  }

  const lockKey = idempotencyKey || `${cleanSector}:${cleanOperationId}`;
  if (processingProfitDistributions.has(lockKey)) {
    return res.status(409).json({ success: false, error: 'Une distribution est déjà en cours de traitement pour cette opération.' });
  }
  processingProfitDistributions.add(lockKey);

  try {
    const existingDistributions = await readApplicationData<ServerProfitDistribution[]>('profit-distributions', []);
    if (idempotencyKey && existingDistributions.some((d) => d.idempotencyKey === idempotencyKey)) {
      return res.status(409).json({
        success: false,
        error: 'Cette distribution de gains a déjà été validée et créditée.'
      });
    }

    const [investors, subscriptions] = await Promise.all([
      listInvestors<ServerInvestorUser>(),
      readJson<ShareSubscription[]>(SUBSCRIPTIONS_FILE, [])
    ]);

    const confirmedSubInvestorIds = new Set<string>();
    const confirmedSubInvestorEmails = new Set<string>();
    for (const sub of subscriptions) {
      if (sub.operationId === operation.id && (sub.status === 'paid_and_issued' || sub.status === 'approved_pending_payment')) {
        if (sub.investorId) confirmedSubInvestorIds.add(sub.investorId);
        if (sub.investorEmail) confirmedSubInvestorEmails.add(sub.investorEmail.trim().toLowerCase());
      }
    }

    const eligible = investors.filter((inv) => {
      if (inv.status !== 'approuve') return false;
      const hasMatchingAllocation = Array.isArray(inv.shareAllocations) && inv.shareAllocations.some(
        (alloc) => alloc.sector === cleanSector && alloc.operationId === operation.id && (alloc.shares || 0) > 0
      );
      const hasMatchingSubscription =
        confirmedSubInvestorIds.has(inv.id) || confirmedSubInvestorEmails.has(inv.email.trim().toLowerCase());
      return hasMatchingAllocation || hasMatchingSubscription;
    });

    if (eligible.length === 0) {
      return res.status(400).json({
        success: false,
        error: `Aucun investisseur approuvé n’est associé à la boutique « ${cleanSector} » pour l’opération « ${operation.title} ».`
      });
    }

    const individualAmount = Math.floor(parsedInvestorsAmount / eligible.length);
    if (individualAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Montant par investisseur trop faible pour être réparti.' });
    }

    const cleanPeriod = sanitizePlainText(period, { maxLength: 80 }) || 'Cycle en cours';
    const cleanNotes = sanitizePlainText(notes, { maxLength: 300 }) || 'Distribution directe des dividendes';
    const cleanProjectName = sanitizePlainText(projectName, { maxLength: 160 }) || operation.title;

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    for (const inv of eligible) {
      await updateInvestor<ServerInvestorUser>(inv.id, (current) => ({
        ...current,
        walletBalance: getRealInvestorBalance(current) + individualAmount,
        dividendsEarned: (current.dividendsEarned || 0) + individualAmount
      }));
      await appendApplicationRecord('wallet-transactions', {
        id: `tx-dist-${Date.now()}-${inv.id.slice(0, 6)}`,
        investorId: inv.id,
        investorEmail: inv.email,
        type: 'dividende',
        amount: individualAmount,
        date: formattedDate,
        method: `Dividendes ${cleanSector} — ${operation.title}`,
        status: 'completed',
        reference: `DIST-${cleanSector.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`,
        note: `${cleanNotes} (${cleanPeriod})`
      } satisfies ServerWalletTransaction);
    }

    const distributionRecord: ServerProfitDistribution = {
      id: `dist-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      projectName: cleanProjectName,
      sector: cleanSector,
      operationId: operation.id,
      operationTitle: operation.title,
      totalProfit: parsedTotalProfit,
      investorsAmount: parsedInvestorsAmount,
      companyAmount: parsedCompanyAmount,
      individualAmount,
      eligibleCount: eligible.length,
      recipientIds: eligible.map((inv) => inv.id),
      period: cleanPeriod,
      notes: cleanNotes,
      distributedAt: now.toLocaleDateString('fr-FR'),
      distributedBy: admin.name
    };
    await appendApplicationRecord('profit-distributions', distributionRecord);

    await addServerAuditLog(
      admin.name,
      'profit_distribution',
      `Distribution ciblée (${cleanSector} / ${operation.title}) de ${parsedInvestorsAmount.toLocaleString('fr-FR')} FCFA (${individualAmount.toLocaleString('fr-FR')} FCFA/associé, ${eligible.length} éligibles)`,
      'wallet',
      distributionRecord.id
    );
    broadcastDataChanged('investors');
    broadcastDataChanged('fund-requests');
    broadcastDataChanged('profits');

    return res.json({
      success: true,
      distribution: distributionRecord,
      eligibleCount: eligible.length,
      individualAmount,
      investorsShareTotal: parsedInvestorsAmount,
      companyShare: parsedCompanyAmount
    });
  } finally {
    processingProfitDistributions.delete(lockKey);
  }
}));

app.delete('/api/admin/profit-distributions/:id', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_subscriptions');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const existing = await readApplicationData<ServerProfitDistribution[]>('profit-distributions', []);
  const target = existing.find((item) => item.id === id);
  if (!target) return res.status(404).json({ success: false, error: 'Distribution introuvable.' });
  await archiveItem('profit-distribution', target.id, `${target.sector} — ${target.operationTitle}`, target);
  await deleteApplicationRecord('profit-distributions', id);
  await addServerAuditLog(admin.name, 'delete_profit_distribution', `Archivage distribution "${target.projectName}"`, 'wallet', id);
  broadcastDataChanged('profits');
  return res.json({ success: true, message: 'Distribution archivée.' });
}));

// =========================================================================
// 4. STRICT SERVER-SIDE SHARE PURCHASE VALIDATION
// =========================================================================

app.post('/api/investor/subscribe-shares', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const { operationId, offerId, sharesCount, useWalletBalance } = req.body || {};
  const sessionInvestor = await getAuthenticatedInvestor(req);
  if (!sessionInvestor) {
    return res.status(401).json({ success: false, error: 'Vous devez vous connecter pour souscrire des parts.' });
  }
  const cleanOperationId = validateSafeId(operationId);
  if (!cleanOperationId) {
    return res.status(400).json({ success: false, error: 'Identifiant d’opération invalide.' });
  }
  const rawIdempotencyKey = req.get('X-Idempotency-Key') ?? req.body?.idempotencyKey;
  let idempotencyKey: string | undefined;
  if (rawIdempotencyKey !== undefined) {
    const validKey = validateSafeId(rawIdempotencyKey, 120);
    if (!validKey) {
      return res.status(400).json({ success: false, error: 'Clé d’idempotence invalide.' });
    }
    idempotencyKey = validKey;
  }

  const subLockKey = `${sessionInvestor.id}:${cleanOperationId}:${idempotencyKey || 'active'}`;
  if (processingShareSubscribes.has(subLockKey)) {
    return res.status(409).json({ success: false, error: 'Votre souscription est déjà en cours d’enregistrement.' });
  }
  processingShareSubscribes.add(subLockKey);

  try {
    const investor = await findInvestorByIdentifier<ServerInvestorUser>(sessionInvestor.id);
    if (!investor) {
      return res.status(404).json({
        success: false,
        error: 'Accès refusé : Aucun compte investisseur trouvé. Vous devez obligatoirement posséder un compte pour acheter des parts.'
      });
    }

    if (investor.status !== 'approuve') {
      return res.status(403).json({
        success: false,
        error: `Accès refusé : Votre compte investisseur a le statut "${investor.status}". Seuls les comptes approuvés et validés par l’administrateur peuvent acheter des parts.`
      });
    }

    const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
    const operation = operations.find((op) => op.id === cleanOperationId);

    if (!operation || operation.isPublished === false) {
      return res.status(400).json({
        success: false,
        error: 'Opération invalide : L’opération de financement sélectionnée n’existe pas ou n’est pas publiée par l’administrateur.'
      });
    }

    if (operation.offerStatus === 'Fermé' || operation.offerStatus === 'Suspendu') {
      return res.status(400).json({
        success: false,
        error: 'Cette opération de financement est actuellement clôturée ou suspendue.'
      });
    }

    let offer: InvestmentOffer | undefined = (operation.offers || []).find((o) => o.id === offerId);
    if (!offer) {
      offer = (operation.offers || []).find((o) => o.isOpen !== false && o.isPublished !== false) || operation.offers?.[0];
    }
    if (!offer) {
      offer = {
        id: `off-${operation.id}-std`,
        ref: `OFF-${operation.id.slice(-4)}`,
        title: `Parts Ordinaires - ${operation.title}`,
        category: operation.category || operation.sector || 'Électronique',
        sharePrice: Number(operation.sharePrice) || Number((operation.offers || [])[0]?.sharePrice) || 0,
        yield: operation.yield || '15% à 18%',
        yieldType: 'Dividendes directs annuels',
        duration: operation.duration || '12 Mois',
        risk: 'Faible',
        description: `Souscription aux parts pour ${operation.title}`,
        isOpen: true,
        isPublished: true
      };
    }

    const count = validateSafePositiveInt(sharesCount, { min: 1, max: 100_000 });
    if (count === null) {
      return res.status(400).json({
        success: false,
        error: 'Le nombre de parts doit être un entier compris entre 1 et 100 000.'
      });
    }

    const sharePrice = Number(operation.sharePrice) || Number(offer.sharePrice);
    if (!Number.isSafeInteger(sharePrice) || sharePrice <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Le prix unitaire de cette opération n’est pas défini. Contactez l’administrateur.'
      });
    }
    if (!await reserveOperationShares(operation.id, count)) {
      return res.status(409).json({
        success: false,
        error: 'Le nombre de parts demandé dépasse le quota encore disponible pour cette opération.'
      });
    }
    const totalAmount = count * sharePrice;
    if (!Number.isSafeInteger(totalAmount)) {
      await releaseOperationShares(operation.id, count);
      return res.status(400).json({ success: false, error: 'Le montant total de la souscription est invalide.' });
    }

    let paidFromWallet = false;
    if (useWalletBalance === true) {
      try {
        const debitRes = await adjustInvestorWalletBalance<ServerInvestorUser>(investor.id, -totalAmount);
        if (!debitRes) {
          await releaseOperationShares(operation.id, count);
          return res.status(404).json({ success: false, error: 'Compte investisseur introuvable.' });
        }
        paidFromWallet = true;
      } catch (error) {
        await releaseOperationShares(operation.id, count);
        if (error instanceof InsufficientBalanceError) {
          return res.status(400).json({
            success: false,
            error: `Solde du portefeuille insuffisant pour cet achat : ${error.message}`
          });
        }
        throw error;
      }
    }

    const subId = `SUB-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const opSector: BoutiqueSector =
      operation.sector && VALID_BOUTIQUE_SECTORS.has(operation.sector)
        ? operation.sector
        : 'Électronique';

    const newSub: ShareSubscription = {
      id: subId,
      investorId: investor.id,
      investorName: investor.name,
      investorEmail: investor.email,
      investorPhone: investor.phone,
      operationId: operation.id,
      operationTitle: operation.title,
      offerId: offer.id,
      offerTitle: offer.title,
      shares: count,
      sharePrice,
      totalAmount,
      status: paidFromWallet ? 'paid_and_issued' : 'pending_admin',
      sharesCredited: paidFromWallet,
      requestedAt: `${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      ...(paidFromWallet ? { paidAt: new Date().toLocaleDateString('fr-FR'), paymentMethod: 'Portefeuille Investisseur' } : {})
    };

    if (paidFromWallet) {
      const updatedInvestor = await updateInvestor<ServerInvestorUser>(investor.id, (current) => ({
        ...current,
        sharesCount: (current.sharesCount || 0) + count,
        totalInvested: (current.totalInvested || 0) + totalAmount,
        shareAllocations: mergeInvestorShareAllocation(
          current.shareAllocations,
          opSector,
          operation.id,
          operation.title,
          count,
          totalAmount
        )
      }));
      if (!updatedInvestor) {
        await adjustInvestorWalletBalance<ServerInvestorUser>(investor.id, totalAmount).catch(() => {});
        await releaseOperationShares(operation.id, count);
        return res.status(404).json({ success: false, error: 'Compte investisseur introuvable.' });
      }
      await appendApplicationRecord('wallet-transactions', {
        id: `tx-sub-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        investorId: investor.id,
        investorEmail: investor.email,
        type: 'achat_parts',
        amount: totalAmount,
        date: newSub.requestedAt,
        method: `Portefeuille Investisseur (${opSector})`,
        status: 'completed',
        reference: subId,
        note: `Achat de ${count} part(s) sur ${operation.title}`
      } satisfies ServerWalletTransaction);
    }

    if (paidFromWallet) {
      operation.collectedAmount = (operation.collectedAmount || 0) + totalAmount;
      operation.investorsCount = (operation.investorsCount || 0) + 1;
    }
    operation.subscribedShares = (operation.subscribedShares || 0) + count;
    if (operation.targetAmount && operation.targetAmount > 0) {
      operation.percent = Math.min(100, Math.round((operation.collectedAmount / operation.targetAmount) * 100));
    }
    const subs = await readJson<ShareSubscription[]>(SUBSCRIPTIONS_FILE, []);
    subs.unshift(newSub);
    try {
      await writeJson(SUBSCRIPTIONS_FILE, subs);
      await writeJson(OPERATIONS_FILE, operations);
    } catch (error) {
      console.error('Échec de persistance de la souscription :', error);
      await writeJson(SUBSCRIPTIONS_FILE, subs.filter((subscription) => subscription.id !== subId));
      if (paidFromWallet) {
        await updateInvestor<ServerInvestorUser>(investor.id, (current) => ({
          ...current,
          sharesCount: Math.max(0, (current.sharesCount || 0) - count),
          totalInvested: Math.max(0, (current.totalInvested || 0) - totalAmount),
          shareAllocations: mergeInvestorShareAllocation(
            current.shareAllocations,
            opSector,
            operation.id,
            operation.title,
            -count,
            -totalAmount
          )
        }));
        await adjustInvestorWalletBalance<ServerInvestorUser>(investor.id, totalAmount).catch(() => {});
      }
      await releaseOperationShares(operation.id, count);
      return res.status(500).json({ success: false, error: 'La souscription n’a pas pu être enregistrée.' });
    }
    broadcastDataChanged('investors');
    broadcastDataChanged('subscriptions');

    await addServerAuditLog(
      investor.name,
      'subscribe_shares',
      `Souscription de ${count} parts (${totalAmount.toLocaleString('fr-FR')} FCFA) pour "${operation.title}" - ${offer.title}`,
      'subscription',
      subId
    );

    try {
      broadcastPresenceUpdate();
    } catch {}

    return res.status(201).json({
      success: true,
      message: paidFromWallet
        ? 'Souscription confirmée et débitée de votre portefeuille avec succès.'
        : 'Demande de souscription enregistrée avec succès. En attente de validation administrative.',
      subscription: newSub
    });
  } finally {
    processingShareSubscribes.delete(subLockKey);
  }
}));

// =========================================================================
// 5. PUBLIC APIS (OPERATIONS, ACTIVITIES, DOCUMENTS - STRICTLY PUBLISHED ONLY)
// =========================================================================

app.get('/api/operations', asyncRoute(async (_req: Request, res: Response) => {
  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const inventories = new Map((await listOperationInventories()).map((item) => [item.operationId, item]));
  // Filter strictly published operations and published offers
  const publishedOps = operations
    .filter((op) => op.isPublished)
    .map((op) => ({
      ...op,
      availableShares: inventories.get(op.id)?.totalShares ?? op.availableShares,
      subscribedShares: inventories.get(op.id)?.committedShares ?? op.subscribedShares ?? 0,
      offers: (op.offers || []).filter((o) => o.isPublished)
    }));
  res.json({ operations: publishedOps });
}));

app.get('/api/activities', asyncRoute(async (_req: Request, res: Response) => {
  const acts = await readJson<InvestorActivity[]>(ACTIVITIES_FILE, []);
  const published = acts.filter((a) => a.isPublished !== false);
  res.json({ activities: published });
}));

app.get('/api/documents', asyncRoute(async (_req: Request, res: Response) => {
  const docs = await readJson<InvestorDocument[]>(DOCUMENTS_FILE, []);
  const published = docs.filter((d) => d.isPublished !== false);
  res.json({ documents: published });
}));

// =========================================================================
// 6. ADMIN APIS (FULL CRUD & CONTROL OVER ALL ENTITIES)
// =========================================================================

// Operations CRUD
app.get('/api/admin/operations', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminAnyPermission(req, res, ['manage_operations', 'manage_subscriptions', 'manage_investors']);
  if (!admin) return;
  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const inventories = new Map((await listOperationInventories()).map((item) => [item.operationId, item]));
  res.json({
    operations: operations.map((operation) => ({
      ...operation,
      availableShares: inventories.get(operation.id)?.totalShares ?? operation.availableShares,
      subscribedShares: inventories.get(operation.id)?.committedShares ?? operation.subscribedShares ?? 0
    }))
  });
}));

app.post('/api/admin/operations', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_operations');
  if (!admin) return;
  const body = req.body || {};
  const cleanTitle = sanitizePlainText(body.title, { minLength: 1, maxLength: 160, required: true });
  if (!cleanTitle) {
    return res.status(400).json({ success: false, error: 'Titre de l’opération requis.' });
  }
  const cleanSector = body.sector !== undefined ? sanitizePlainText(body.sector, { maxLength: 60 }) : undefined;
  const cleanCategory = body.category !== undefined ? sanitizePlainText(body.category, { maxLength: 80 }) : undefined;
  const cleanObjective = body.objective !== undefined ? sanitizePlainText(body.objective, { maxLength: 1000, allowNewlines: true }) : undefined;
  const cleanDescription = body.description !== undefined ? sanitizePlainText(body.description, { maxLength: 2000, allowNewlines: true }) : undefined;
  const cleanYieldStr = body.yieldStr !== undefined ? sanitizePlainText(body.yieldStr, { maxLength: 80 }) : undefined;
  const cleanDuration = body.duration !== undefined ? sanitizePlainText(body.duration, { maxLength: 60 }) : undefined;
  const cleanDistribution = body.distribution !== undefined ? sanitizePlainText(body.distribution, { maxLength: 60 }) : undefined;
  if (cleanSector === null || cleanCategory === null || cleanObjective === null || cleanDescription === null || cleanYieldStr === null || cleanDuration === null || cleanDistribution === null) {
    return res.status(400).json({ success: false, error: 'Un ou plusieurs champs texte contiennent des caractères non autorisés.' });
  }

  const firstOfferPrice = Array.isArray(body.offers) ? Number(body.offers[0]?.sharePrice) : 0;
  const price = Number(body.sharePrice) || firstOfferPrice;
  const shareLimit = Number(body.availableShares);
  if (!Number.isSafeInteger(price) || price <= 0 || price > 100_000_000) {
    return res.status(400).json({ success: false, error: 'Le prix unitaire de la part doit être un nombre positif.' });
  }
  if (!Number.isSafeInteger(shareLimit) || shareLimit < 1 || shareLimit > 10_000_000) {
    return res.status(400).json({ success: false, error: 'Le nombre de parts disponibles doit être un entier positif.' });
  }
  const parsedTarget = body.targetAmount !== undefined
    ? validateSafeNonNegativeInt(body.targetAmount, { max: 10_000_000_000 })
    : 10_000_000;
  if (parsedTarget === null) {
    return res.status(400).json({ success: false, error: 'Le montant cible est invalide.' });
  }

  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const opId = (typeof body.id === 'string' && validateSafeId(body.id)) || `op-${Date.now()}`;
  const published = body.isPublished !== undefined ? Boolean(body.isPublished) : body.offerStatus === 'Ouvert';
  const allowedStatuses = new Set(['Brouillon', 'Ouvert', 'Suspendu', 'Fermé']);
  const statusStr = (typeof body.offerStatus === 'string' && allowedStatuses.has(body.offerStatus)
    ? body.offerStatus
    : published ? 'Ouvert' : 'Brouillon') as InvestmentOperation['offerStatus'];

  const defaultOffer: InvestmentOffer = {
    id: `off-${Date.now()}-std`,
    ref: `OFF-${Date.now().toString().slice(-4)}`,
    title: `Parts Ordinaires - ${cleanTitle}`,
    category: cleanSector || cleanCategory || 'Souscription Ouverte',
    sharePrice: price,
    yield: cleanYieldStr || '15% à 18%',
    yieldType: 'Dividendes directs annuels',
    duration: cleanDuration || '12 Mois renouvelable',
    risk: 'Faible (Garanti par stock actif)',
    description: `Acquisition de parts dans l'opération ${cleanTitle}`,
    isOpen: statusStr === 'Ouvert',
    isPublished: published
  };

  const opSector = cleanSector === 'Électronique' || cleanSector === 'Électrotechnique' || cleanSector === 'Informatique'
    ? cleanSector
    : 'Électronique';

  const cleanRef = sanitizePlainText(body.ref, { maxLength: 40 }) || `OP-${Date.now().toString().slice(-4)}`;
  const newOp: InvestmentOperation = {
    id: opId,
    ref: cleanRef,
    title: cleanTitle,
    category: cleanCategory || opSector,
    sector: opSector,
    objective: cleanObjective || cleanDescription || '',
    yield: cleanYieldStr || '15% à 18%',
    yieldType: 'Dividendes directs annuels',
    description: cleanDescription || cleanObjective || `Opération de financement pour ${cleanTitle}`,
    duration: cleanDuration || '12 Mois',
    risk: 'Faible',
    riskColor: 'emerald',
    targetAmount: parsedTarget || 10_000_000,
    collectedAmount: 0,
    percent: 0,
    distribution: cleanDistribution || 'Trimestrielle',
    investorsCount: 0,
    cycleNumber: 1,
    status: published ? 'published' : 'draft',
    offerStatus: statusStr,
    isPublished: published,
    sharePrice: price,
    availableShares: shareLimit,
    openDate: new Date().toLocaleDateString('fr-FR'),
    offers: Array.isArray(body.offers) && body.offers.length > 0
      ? body.offers.map((offer: InvestmentOffer, idx: number) => ({
          ...offer,
          id: (typeof offer.id === 'string' && validateSafeId(offer.id)) || `off-${Date.now()}-${idx}`,
          title: sanitizePlainText(offer.title, { maxLength: 160 }) || defaultOffer.title,
          description: sanitizePlainText(offer.description, { maxLength: 1000 }) || defaultOffer.description,
          sharePrice: price
        }))
      : [defaultOffer]
  };

  operations.unshift(newOp);
  await initializeOperationInventory([{ operationId: opId, totalShares: shareLimit, committedShares: 0 }]);
  await writeJson(OPERATIONS_FILE, operations);

  await addServerAuditLog(admin.name, 'create_operation', `Création et publication de l'opération "${newOp.title}" (${statusStr})`, 'operation', opId);
  res.status(201).json({ success: true, operation: newOp });
}));

app.patch('/api/admin/operations/:id/status', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_operations');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const { offerStatus, isPublished } = req.body || {};
  const allowedStatuses = new Set(['Brouillon', 'Ouvert', 'Suspendu', 'Fermé']);
  if (offerStatus !== undefined && (typeof offerStatus !== 'string' || !allowedStatuses.has(offerStatus))) {
    return res.status(400).json({ success: false, error: 'Statut d’opération invalide.' });
  }
  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const idx = operations.findIndex((op) => op.id === id);

  if (idx < 0) {
    return res.status(404).json({ success: false, error: 'Opération introuvable.' });
  }

  if (offerStatus) operations[idx].offerStatus = offerStatus as InvestmentOperation['offerStatus'];
  if (isPublished !== undefined) operations[idx].isPublished = Boolean(isPublished);
  await writeJson(OPERATIONS_FILE, operations);

  await addServerAuditLog(admin.name, 'update_operation_status', `Statut de l'opération "${operations[idx].title}" -> ${offerStatus || operations[idx].offerStatus}`, 'operation', id);
  res.json({ success: true, operation: operations[idx] });
}));

app.put('/api/admin/operations/:id', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_operations');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const updates = req.body || {};
  if (typeof updates !== 'object' || Array.isArray(updates)) {
    return res.status(400).json({ success: false, error: 'Format des données invalide.' });
  }
  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const idx = operations.findIndex((op) => op.id === id);

  if (idx < 0) {
    return res.status(404).json({ success: false, error: 'Opération introuvable.' });
  }

  const current = operations[idx];
  const requestedPrice = updates.sharePrice === undefined ? current.sharePrice : Number(updates.sharePrice);
  const requestedLimit = updates.availableShares === undefined ? current.availableShares : Number(updates.availableShares);
  if (requestedPrice !== undefined && (!Number.isSafeInteger(requestedPrice) || requestedPrice <= 0 || requestedPrice > 100_000_000)) {
    return res.status(400).json({ success: false, error: 'Le prix unitaire de la part doit être un nombre positif.' });
  }
  if (requestedLimit !== undefined && (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 10_000_000)) {
    return res.status(400).json({ success: false, error: 'Le nombre de parts disponibles doit être un entier positif.' });
  }
  if (requestedLimit !== undefined && !(await updateOperationInventory(id, requestedLimit))) {
    return res.status(409).json({ success: false, error: 'Le nombre de parts disponibles ne peut pas être inférieur aux parts déjà souscrites.' });
  }

  const cleanTitle = updates.title !== undefined ? sanitizePlainText(updates.title, { minLength: 1, maxLength: 160, required: true }) : current.title;
  const cleanDescription = updates.description !== undefined ? sanitizePlainText(updates.description, { maxLength: 2000, allowNewlines: true }) : current.description;
  const cleanObjective = updates.objective !== undefined ? sanitizePlainText(updates.objective, { maxLength: 1000, allowNewlines: true }) : current.objective;
  const cleanYield = updates.yield !== undefined ? sanitizePlainText(updates.yield, { maxLength: 80 }) : current.yield;
  const cleanDuration = updates.duration !== undefined ? sanitizePlainText(updates.duration, { maxLength: 60 }) : current.duration;
  const cleanDistribution = updates.distribution !== undefined ? sanitizePlainText(updates.distribution, { maxLength: 60 }) : current.distribution;
  if (!cleanTitle || cleanDescription === null || cleanObjective === null || cleanYield === null || cleanDuration === null || cleanDistribution === null) {
    return res.status(400).json({ success: false, error: 'Champs de mise à jour invalides.' });
  }
  const allowedStatuses = new Set(['Brouillon', 'Ouvert', 'Suspendu', 'Fermé']);
  const nextOfferStatus = typeof updates.offerStatus === 'string' && allowedStatuses.has(updates.offerStatus)
    ? (updates.offerStatus as InvestmentOperation['offerStatus'])
    : current.offerStatus;

  operations[idx] = {
    ...current,
    title: cleanTitle,
    description: cleanDescription,
    objective: cleanObjective,
    yield: cleanYield,
    duration: cleanDuration,
    distribution: cleanDistribution,
    offerStatus: nextOfferStatus,
    isPublished: updates.isPublished !== undefined ? Boolean(updates.isPublished) : current.isPublished,
    sharePrice: requestedPrice,
    availableShares: requestedLimit,
    offers: current.offers?.map((offer) => ({ ...offer, sharePrice: requestedPrice ?? offer.sharePrice }))
  };
  await writeJson(OPERATIONS_FILE, operations);

  await addServerAuditLog(admin.name, 'update_operation', `Mise à jour de l'opération "${operations[idx].title}"`, 'operation', id);
  res.json({ success: true, operation: operations[idx] });
}));

app.delete('/api/admin/operations/:id', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_operations');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const target = operations.find((op) => op.id === id);

  if (!target) {
    return res.status(404).json({ success: false, error: 'Opération introuvable.' });
  }

  const archiveId = await archiveItem('operation', target.id, target.title, target);
  const remaining = operations.filter((op) => op.id !== id);
  try {
    await writeJson(OPERATIONS_FILE, remaining);
  } catch (error) {
    await deleteArchiveRecord(archiveId);
    throw error;
  }

  await addServerAuditLog(admin.name, 'archive_operation', `Archivage de l'opération "${target.title}"`, 'operation', id);
  res.json({ success: true, message: `Opération "${target.title}" supprimée avec succès.` });
}));

// Offers inside Operation
app.post('/api/admin/operations/:opId/offers', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_operations');
  if (!admin) return;
  const opId = validateSafeId(req.params.opId);
  if (!opId) {
    return res.status(400).json({ success: false, error: 'Identifiant d’opération invalide.' });
  }
  const { title, yieldStr, duration, risk, description, isOpen } = req.body || {};
  const cleanTitle = sanitizePlainText(title, { maxLength: 160 });
  const cleanYield = sanitizePlainText(yieldStr, { maxLength: 80 });
  const cleanDuration = sanitizePlainText(duration, { maxLength: 60 });
  const cleanRisk = sanitizePlainText(risk, { maxLength: 80 });
  const cleanDescription = sanitizePlainText(description, { maxLength: 2000, allowNewlines: true });
  if (cleanTitle === null || cleanYield === null || cleanDuration === null || cleanRisk === null || cleanDescription === null) {
    return res.status(400).json({ success: false, error: 'Données d’offre invalides.' });
  }

  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const op = operations.find((o) => o.id === opId);
  if (!op) {
    return res.status(404).json({ success: false, error: 'Opération parente introuvable.' });
  }
  const operationSharePrice = Number(op.sharePrice) || Number(op.offers?.[0]?.sharePrice);
  if (!Number.isSafeInteger(operationSharePrice) || operationSharePrice <= 0) {
    return res.status(400).json({ success: false, error: 'Définissez d’abord un prix unitaire valide sur l’opération.' });
  }

  const newOffer: InvestmentOffer = {
    id: `off-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ref: `OFF-${Date.now().toString().slice(-4)}`,
    title: cleanTitle || 'Nouvelle Offre',
    category: 'Offre Spécifique',
    sharePrice: operationSharePrice,
    yield: cleanYield || '15% à 18%',
    yieldType: 'Dividendes directs annuels',
    duration: cleanDuration || '12 Mois',
    risk: cleanRisk || 'Faible',
    description: cleanDescription,
    isOpen: isOpen !== undefined ? Boolean(isOpen) : true,
    isPublished: true
  };

  if (!op.offers) op.offers = [];
  op.offers.push(newOffer);
  await writeJson(OPERATIONS_FILE, operations);

  await addServerAuditLog(admin.name, 'add_offer', `Ajout de l'offre "${newOffer.title}" dans l'opération "${op.title}"`, 'offer', newOffer.id);
  res.status(201).json({ success: true, offer: newOffer });
}));

app.delete('/api/admin/operations/:opId/offers/:offerId', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_operations');
  if (!admin) return;
  const opId = validateSafeId(req.params.opId);
  const offerId = validateSafeId(req.params.offerId);
  if (!opId || !offerId) {
    return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  }
  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const op = operations.find((o) => o.id === opId);
  if (!op) {
    return res.status(404).json({ success: false, error: 'Opération introuvable.' });
  }

  const offer = (op.offers || []).find((o) => o.id === offerId);
  if (!offer) return res.status(404).json({ success: false, error: 'Offre introuvable.' });
  const archiveId = await archiveItem('offer', offer.id, offer.title, offer, opId);
  op.offers = (op.offers || []).filter((o) => o.id !== offerId);
  try {
    await writeJson(OPERATIONS_FILE, operations);
  } catch (error) {
    await deleteArchiveRecord(archiveId);
    throw error;
  }

  await addServerAuditLog(admin.name, 'delete_offer', `Suppression de l'offre "${offer?.title || offerId}"`, 'offer', offerId);
  res.json({ success: true, message: 'Offre supprimée avec succès.' });
}));

// =========================================================================
// COURSES & ACADEMY MANAGEMENT API (ADMIN CONTROL & APPRENANT STREAM)
// =========================================================================

const DEFAULT_COURSE_CATEGORIES = [
  { id: 'cat-elec-1', label: 'IoT & Systèmes Embarqués', domain: 'electronique', isActive: true },
  { id: 'cat-elec-2', label: 'Microcontrôleurs & Capteurs', domain: 'electronique', isActive: true },
  { id: 'cat-electrotech-1', label: 'Armoires Industrielles & VFD', domain: 'electrotechnique', isActive: true },
  { id: 'cat-electrotech-2', label: 'Solaire & Onduleurs 380V', domain: 'electrotechnique', isActive: true },
  { id: 'cat-info-1', label: 'Réseaux & Télécoms', domain: 'informatique', isActive: true },
  { id: 'cat-info-2', label: 'Maintenance & Systèmes', domain: 'informatique', isActive: true }
];

// =========================================================================
// CATALOGUE PRODUITS CRUD (PERSISTANCE POSTGRESQL)
// =========================================================================

function normalizeTokenText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function inferProductDomain(raw: Record<string, unknown>): 'electronique' | 'electrotechnique' | 'informatique' {
  const domainNorm = normalizeTokenText(raw.domain);
  if (domainNorm === 'electrotechnique' || domainNorm.includes('electrotech')) return 'electrotechnique';
  if (domainNorm === 'informatique' || domainNorm === 'info') return 'informatique';
  if (domainNorm === 'electronique' || domainNorm.includes('microelectron')) return 'electronique';

  const catNorm = normalizeTokenText(raw.category);
  const subNorm = normalizeTokenText(raw.subGroup);
  if (
    catNorm === 'electrotechnique' ||
    ['protection', 'commande', 'variateurs', 'alimentation', 'cablage'].includes(subNorm)
  ) {
    return 'electrotechnique';
  }
  if (
    catNorm === 'informatique' ||
    ['ordinateurs', 'composants_pc', 'peripheriques', 'reseau', 'energie_pc'].includes(subNorm)
  ) {
    return 'informatique';
  }
  return 'electronique';
}

function normalizeProductRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const domain = inferProductDomain(item);
  const parsedPrice = Number(item.price);
  const parsedOldPrice = item.oldPrice !== undefined && item.oldPrice !== null && item.oldPrice !== '' ? Number(item.oldPrice) : undefined;
  const parsedStock = Number(item.stock);
  const isDraft = item.isDraft === true || item.isDraft === 'true';
  const isPublished = item.isPublished === false || item.isPublished === 'false' ? false : !isDraft;

  return {
    ...item,
    domain,
    price: Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0,
    ...(parsedOldPrice !== undefined && Number.isFinite(parsedOldPrice) && parsedOldPrice > 0 ? { oldPrice: parsedOldPrice } : {}),
    stock: Number.isFinite(parsedStock) && parsedStock >= 0 ? parsedStock : 0,
    isDraft,
    isPublished
  };
}

app.get('/api/products', asyncRoute(async (req: Request, res: Response) => {
  applyNoCacheHeaders(res);
  const [rawProducts, storedGroups] = await Promise.all([
    readJson<any[]>(PRODUCTS_FILE, []),
    readJson<Record<string, unknown>>(GROUPS_FILE, {})
  ]);
  const domainFilter = normalizeTokenText(req.query.domain);
  const products = rawProducts
    .map(normalizeProductRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => !domainFilter || item.domain === domainFilter);
  res.json({ success: true, products, groups: storedGroups });
}));

app.get('/api/groups', asyncRoute(async (_req: Request, res: Response) => {
  applyNoCacheHeaders(res);
  const groups = await readJson<Record<string, unknown>>(GROUPS_FILE, {});
  res.json({ success: true, groups });
}));

app.put('/api/admin/groups', asyncRoute(async (req: Request, res: Response) => {
  applyNoCacheHeaders(res);
  const admin = await requireAdminPermission(req, res, 'manage_products');
  if (!admin) return;
  const body = req.body?.groups ?? req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ success: false, error: 'Données de catégories invalides.' });
  }
  await writeJson(GROUPS_FILE, body);
  res.json({ success: true, groups: body });
}));

app.post('/api/admin/products', asyncRoute(async (req: Request, res: Response) => {
  applyNoCacheHeaders(res);
  const admin = await requireAdminPermission(req, res, 'manage_products');
  if (!admin) return;
  const prod = req.body;
  if (!prod || typeof prod !== 'object' || Array.isArray(prod)) {
    return res.status(400).json({ success: false, error: 'Données produit invalides.' });
  }
  const cleanName = sanitizePlainText(prod.name, { minLength: 1, maxLength: 160, required: true });
  if (!cleanName) {
    return res.status(400).json({ success: false, error: 'Nom de produit valide requis.' });
  }
  const cleanDescription = prod.description !== undefined
    ? sanitizePlainText(prod.description, { maxLength: 2000, allowNewlines: true })
    : undefined;
  const cleanImage = prod.image !== undefined ? validateSafeUrlOrPath(prod.image, 10000) : undefined;
  if (cleanDescription === null || cleanImage === null) {
    return res.status(400).json({ success: false, error: 'Description ou URL image produit invalide.' });
  }
  const cleanPrice = prod.price !== undefined ? validateSafeNonNegativeInt(prod.price, { max: 500_000_000 }) : undefined;
  if (prod.price !== undefined && cleanPrice === null) {
    return res.status(400).json({ success: false, error: 'Prix du produit invalide.' });
  }
  const cleanStock = prod.stock !== undefined ? validateSafeNonNegativeInt(prod.stock, { max: 1_000_000 }) : undefined;
  if (prod.stock !== undefined && cleanStock === null) {
    return res.status(400).json({ success: false, error: 'Stock du produit invalide.' });
  }

  const products = await readJson<any[]>(PRODUCTS_FILE, []);
  const newProd = normalizeProductRecord({
    ...prod,
    name: cleanName,
    ...(cleanDescription !== undefined ? { description: cleanDescription } : {}),
    ...(cleanImage !== undefined ? { image: cleanImage } : {}),
    ...(cleanPrice !== undefined && cleanPrice !== null ? { price: cleanPrice } : {}),
    ...(cleanStock !== undefined && cleanStock !== null ? { stock: cleanStock } : {}),
    id: (typeof prod.id === 'string' && validateSafeId(prod.id)) || `prod-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    ref: sanitizePlainText(prod.ref, { maxLength: 60 }) || `ELM-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString()
  }) || {
    ...prod,
    name: cleanName,
    id: (typeof prod.id === 'string' && validateSafeId(prod.id)) || `prod-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    ref: sanitizePlainText(prod.ref, { maxLength: 60 }) || `ELM-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString()
  };

  products.unshift(newProd);
  await writeJson(PRODUCTS_FILE, products);
  await addServerAuditLog(admin.name, 'create_product', `Ajout du produit "${newProd.name}" (${newProd.ref})`, 'product', String(newProd.id));
  broadcastDataChanged('products');
  res.status(201).json({ success: true, product: newProd });
}));

app.post('/api/admin/products/bulk-csv', asyncRoute(async (req: Request, res: Response) => {
  applyNoCacheHeaders(res);
  const admin = await requireAdminPermission(req, res, 'manage_products');
  if (!admin) return;

  const rawList = Array.isArray(req.body?.products) ? req.body.products : null;
  if (!rawList || rawList.length === 0) {
    return res.status(400).json({ success: false, error: 'Aucun produit valide fourni pour l’import CSV.' });
  }
  if (rawList.length > 1000) {
    return res.status(400).json({ success: false, error: 'L’import CSV est limité à 1000 produits par lot.' });
  }

  const upsertByRef = req.body?.upsertByRef !== false;
  const cleanFilename = sanitizePlainText(req.body?.filename, { maxLength: 160 }) || 'import.csv';

  const existingProducts = await readJson<any[]>(PRODUCTS_FILE, []);
  const nextProducts = [...existingProducts];
  const indexById = new Map<string, number>();
  const indexByRef = new Map<string, number>();
  const usedIds = new Set<string>();

  nextProducts.forEach((item, idx) => {
    if (item && typeof item === 'object') {
      if (typeof item.id === 'string' && item.id.trim()) {
        indexById.set(item.id.trim(), idx);
        usedIds.add(item.id.trim());
      }
      if (typeof item.ref === 'string' && item.ref.trim()) {
        indexByRef.set(item.ref.trim().toLowerCase(), idx);
      }
    }
  });

  const newItems: Record<string, unknown>[] = [];
  const importedProducts: Record<string, unknown>[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  const nowIso = new Date().toISOString();

  for (let i = 0; i < rawList.length; i += 1) {
    const raw = rawList[i];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return res.status(400).json({ success: false, error: `Ligne ${i + 1} : structure produit invalide.` });
    }

    const cleanName = sanitizePlainText(raw.name, { minLength: 1, maxLength: 160, required: true });
    if (!cleanName) {
      return res.status(400).json({ success: false, error: `Ligne ${i + 1} : nom de produit valide requis.` });
    }

    const cleanPrice = validateSafeNonNegativeInt(raw.price, { max: 500_000_000 });
    if (cleanPrice === null) {
      return res.status(400).json({ success: false, error: `Ligne ${i + 1} ("${cleanName}") : prix invalide.` });
    }

    const cleanOldPrice =
      raw.oldPrice !== undefined && raw.oldPrice !== null && raw.oldPrice !== ''
        ? validateSafeNonNegativeInt(raw.oldPrice, { max: 500_000_000 })
        : undefined;
    if (raw.oldPrice !== undefined && raw.oldPrice !== null && raw.oldPrice !== '' && cleanOldPrice === null) {
      return res.status(400).json({ success: false, error: `Ligne ${i + 1} ("${cleanName}") : ancien prix invalide.` });
    }

    const cleanStock =
      raw.stock !== undefined && raw.stock !== null && raw.stock !== ''
        ? validateSafeNonNegativeInt(raw.stock, { max: 1_000_000 })
        : 0;
    if (cleanStock === null) {
      return res.status(400).json({ success: false, error: `Ligne ${i + 1} ("${cleanName}") : quantité de stock invalide.` });
    }

    const cleanDescription =
      raw.description !== undefined
        ? sanitizePlainText(raw.description, { maxLength: 5000, allowNewlines: true })
        : '';
    if (cleanDescription === null) {
      return res.status(400).json({ success: false, error: `Ligne ${i + 1} ("${cleanName}") : description invalide.` });
    }

    const validatedImage = raw.image !== undefined && raw.image !== '' ? validateSafeUrlOrPath(raw.image, 500000) : '';
    const cleanImage = validatedImage ?? '';

    const validatedVideo = raw.videoUrl !== undefined && raw.videoUrl !== '' ? validateSafeUrlOrPath(raw.videoUrl, 2048) : '';
    const cleanVideo = validatedVideo ?? '';

    const cleanBrand = sanitizePlainText(raw.brand, { maxLength: 120 }) || undefined;
    const cleanRefInput = sanitizePlainText(raw.ref, { maxLength: 60 }) || '';
    const cleanCategory = sanitizePlainText(raw.category, { maxLength: 120 }) || 'electronique';
    const cleanCategoryLabel = sanitizePlainText(raw.categoryLabel, { maxLength: 160 }) || undefined;
    const cleanSubGroup = sanitizePlainText(raw.subGroup, { maxLength: 120 }) || undefined;
    const cleanSubGroupLabel = sanitizePlainText(raw.subGroupLabel, { maxLength: 160 }) || undefined;
    const cleanSpecs = Array.isArray(raw.specs)
      ? raw.specs
          .map((s: unknown) => sanitizePlainText(s, { maxLength: 240 }))
          .filter((s: string | null): s is string => Boolean(s))
      : [];
    const cleanDetails = Array.isArray(raw.details)
      ? raw.details
          .map((s: unknown) => sanitizePlainText(s, { maxLength: 240 }))
          .filter((s: string | null): s is string => Boolean(s))
      : cleanSpecs;

    const cleanStockStatus =
      raw.stockStatus === 'out_of_stock' || raw.stockStatus === 'on_order' || raw.stockStatus === 'in_stock'
        ? raw.stockStatus
        : cleanStock > 0
        ? 'in_stock'
        : 'out_of_stock';
    const normalizedStock = cleanStockStatus === 'out_of_stock' ? 0 : cleanStock;
    const cleanInStock = cleanStockStatus === 'in_stock' && normalizedStock > 0;
    const isDraft = raw.isDraft === true || raw.isDraft === 'true';
    const isPublished = raw.isPublished === false || raw.isPublished === 'false' ? false : !isDraft;

    let existingIdx: number | undefined;
    if (upsertByRef) {
      if (typeof raw.id === 'string' && validateSafeId(raw.id) && indexById.has(raw.id.trim())) {
        existingIdx = indexById.get(raw.id.trim());
      } else if (cleanRefInput && indexByRef.has(cleanRefInput.toLowerCase())) {
        existingIdx = indexByRef.get(cleanRefInput.toLowerCase());
      }
    }

    const basePayload: Record<string, unknown> = {
      name: cleanName,
      ...(cleanBrand ? { brand: cleanBrand } : {}),
      ref: cleanRefInput || `ELM-CSV-${Date.now().toString().slice(-5)}-${i + 1}`,
      domain: raw.domain,
      category: cleanCategory,
      ...(cleanCategoryLabel ? { categoryLabel: cleanCategoryLabel } : {}),
      ...(cleanSubGroup ? { subGroup: cleanSubGroup } : {}),
      ...(cleanSubGroupLabel ? { subGroupLabel: cleanSubGroupLabel } : {}),
      price: cleanPrice,
      ...(cleanOldPrice !== undefined && cleanOldPrice !== null && cleanOldPrice > 0 ? { oldPrice: cleanOldPrice } : {}),
      stock: normalizedStock,
      stockStatus: cleanStockStatus,
      inStock: cleanInStock,
      description: cleanDescription,
      specs: cleanSpecs,
      details: cleanDetails,
      hasRealPhoto: Boolean(cleanImage),
      image: cleanImage,
      ...(cleanVideo ? { videoUrl: cleanVideo } : {}),
      isPublished,
      isDraft,
      isPromo: Boolean(raw.isPromo || (cleanOldPrice !== undefined && cleanOldPrice !== null && cleanOldPrice > cleanPrice)),
      isNew: Boolean(raw.isNew || raw.isNewArrival),
      isNewArrival: Boolean(raw.isNewArrival || raw.isNew),
      isFlashSale: Boolean(raw.isFlashSale),
      isFeaturedOnHome: Boolean(raw.isFeaturedOnHome)
    };

    if (existingIdx !== undefined) {
      const current = nextProducts[existingIdx] || {};
      const merged = normalizeProductRecord({
        ...current,
        ...basePayload,
        id: current.id,
        ref: cleanRefInput || current.ref,
        createdAt: current.createdAt || nowIso,
        updatedAt: nowIso
      }) || {
        ...current,
        ...basePayload,
        id: current.id,
        updatedAt: nowIso
      };
      nextProducts[existingIdx] = merged;
      importedProducts.push(merged);
      updatedCount += 1;
    } else {
      const safeId =
        (typeof raw.id === 'string' && !usedIds.has(raw.id.trim()) && validateSafeId(raw.id)) ||
        `prod-csv-${Date.now()}-${i}-${Math.floor(100 + Math.random() * 900)}`;
      const created = normalizeProductRecord({
        ...basePayload,
        id: safeId,
        createdAt: nowIso
      }) || {
        ...basePayload,
        id: safeId,
        createdAt: nowIso
      };
      newItems.push(created);
      importedProducts.push(created);
      createdCount += 1;
      if (typeof created.id === 'string') {
        usedIds.add(created.id);
      }
    }
  }

  const finalProducts = [...newItems, ...nextProducts];
  await writeJson(PRODUCTS_FILE, finalProducts);
  await addServerAuditLog(
    admin.name,
    'import_products_csv',
    `Import CSV (${cleanFilename}) : ${createdCount} créé(s), ${updatedCount} mis à jour`,
    'product'
  );
  broadcastDataChanged('products');

  res.status(200).json({
    success: true,
    createdCount,
    updatedCount,
    importedCount: importedProducts.length,
    importedProducts,
    products: finalProducts
  });
}));

app.put('/api/admin/products/:id', asyncRoute(async (req: Request, res: Response) => {
  applyNoCacheHeaders(res);
  const admin = await requireAdminPermission(req, res, 'manage_products');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  const updateData = req.body;
  if (!id || !updateData || typeof updateData !== 'object' || Array.isArray(updateData)) {
    return res.status(400).json({ success: false, error: 'Identifiant ou données produit invalides.' });
  }
  if (updateData.name !== undefined && !sanitizePlainText(updateData.name, { minLength: 1, maxLength: 160, required: true })) {
    return res.status(400).json({ success: false, error: 'Nom de produit invalide.' });
  }
  const cleanPrice = updateData.price !== undefined ? validateSafeNonNegativeInt(updateData.price, { max: 500_000_000 }) : undefined;
  if (updateData.price !== undefined && cleanPrice === null) {
    return res.status(400).json({ success: false, error: 'Prix du produit invalide.' });
  }
  const cleanStock = updateData.stock !== undefined ? validateSafeNonNegativeInt(updateData.stock, { max: 1_000_000 }) : undefined;
  if (updateData.stock !== undefined && cleanStock === null) {
    return res.status(400).json({ success: false, error: 'Stock du produit invalide.' });
  }
  const cleanImage = updateData.image !== undefined ? validateSafeUrlOrPath(updateData.image, 10000) : undefined;
  if (updateData.image !== undefined && cleanImage === null) {
    return res.status(400).json({ success: false, error: 'URL d’image invalide.' });
  }

  const products = await readJson<any[]>(PRODUCTS_FILE, []);
  const idx = products.findIndex((p) => p.id === id);

  const normalizedUpdate = {
    ...updateData,
    ...(cleanPrice !== undefined && cleanPrice !== null ? { price: cleanPrice } : {}),
    ...(cleanStock !== undefined && cleanStock !== null ? { stock: cleanStock } : {}),
    ...(cleanImage !== undefined && cleanImage !== null ? { image: cleanImage } : {})
  };

  if (idx === -1) {
    const newProd = normalizeProductRecord({ ...normalizedUpdate, id }) || { ...normalizedUpdate, id };
    products.push(newProd);
    await writeJson(PRODUCTS_FILE, products);
    broadcastDataChanged('products');
    return res.json({ success: true, product: newProd });
  }

  products[idx] = normalizeProductRecord({ ...products[idx], ...normalizedUpdate, id }) || {
    ...products[idx],
    ...normalizedUpdate,
    id
  };
  await writeJson(PRODUCTS_FILE, products);
  await addServerAuditLog(admin.name, 'update_product', `Modification du produit "${products[idx].name}" (${products[idx].ref})`, 'product', id);
  broadcastDataChanged('products');
  res.json({ success: true, product: products[idx] });
}));

app.delete('/api/admin/products/:id', asyncRoute(async (req: Request, res: Response) => {
  applyNoCacheHeaders(res);
  const admin = await requireAdminPermission(req, res, 'delete_products');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const products = await readJson<any[]>(PRODUCTS_FILE, []);
  const target = products.find((p) => p.id === id);
  if (!target) return res.status(404).json({ success: false, error: 'Produit introuvable.' });
  const archiveId = await archiveItem('product', target.id, target.name || target.title || id, target);
  const filtered = products.filter((p) => p.id !== id);

  try {
    await writeJson(PRODUCTS_FILE, filtered);
  } catch (error) {
    await deleteArchiveRecord(archiveId);
    throw error;
  }
  await addServerAuditLog(admin.name, 'archive_product', `Archivage du produit "${target.name}" (${target.ref})`, 'product', id);
  broadcastDataChanged('products');
  res.json({ success: true, deletedId: id, message: 'Produit déplacé dans la corbeille.' });
}));

app.get('/api/courses', asyncRoute(async (_req: Request, res: Response) => {
  const courses = await readJson<any[]>(COURSES_FILE, []);
  res.json({ success: true, courses });
}));

app.post('/api/admin/courses', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_courses');
  if (!admin) return;
  const {
    title,
    domain,
    category,
    description,
    imageUrl,
    videoUrl,
    duration,
    level,
    pedagogicalObjectives,
    features,
    price,
    isFree,
    status
  } = req.body || {};

  const cleanTitle = sanitizePlainText(title, { minLength: 1, maxLength: 160, required: true });
  if (!cleanTitle) {
    return res.status(400).json({ success: false, error: 'Titre de formation obligatoire.' });
  }
  if (!domain || !['electronique', 'electrotechnique', 'informatique'].includes(domain)) {
    return res.status(400).json({ success: false, error: 'Domaine pédagogique invalide (electronique, electrotechnique ou informatique).' });
  }
  const cleanCategory = sanitizePlainText(category, { maxLength: 80 }) || 'Programme Général';
  const cleanDescription = sanitizePlainText(description, { maxLength: 3000, allowNewlines: true }) ?? '';
  const cleanImageUrl = validateSafeUrlOrPath(imageUrl, 2048);
  const cleanVideoUrl = validateSafeUrlOrPath(videoUrl, 2048);
  const cleanDuration = sanitizePlainText(duration, { maxLength: 60 }) ?? '';
  const cleanLevel = sanitizePlainText(level, { maxLength: 60 }) ?? '';
  const parsedPrice = price === undefined || price === '' ? 0 : validateSafeNonNegativeInt(price, { max: 50_000_000 });
  if (cleanImageUrl === null || cleanVideoUrl === null || parsedPrice === null) {
    return res.status(400).json({ success: false, error: 'URL média ou tarif de formation invalide.' });
  }

  const courses = await readJson<any[]>(COURSES_FILE, []);
  const initialStatus = status === 'draft' || status === 'suspended' ? status : 'published';

  const newCourse = {
    id: `course-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    title: cleanTitle,
    domain,
    category: cleanCategory,
    description: cleanDescription,
    imageUrl: cleanImageUrl,
    videoUrl: cleanVideoUrl,
    duration: cleanDuration,
    level: cleanLevel,
    pedagogicalObjectives: Array.isArray(pedagogicalObjectives)
      ? pedagogicalObjectives.map((item) => sanitizePlainText(item, { maxLength: 300 })).filter((v): v is string => Boolean(v))
      : [],
    features: Array.isArray(features)
      ? features.map((item) => sanitizePlainText(item, { maxLength: 300 })).filter((v): v is string => Boolean(v))
      : [],
    price: parsedPrice,
    isFree: Boolean(isFree || parsedPrice === 0),
    status: initialStatus,
    isPublished: initialStatus === 'published',
    dateAdded: new Date().toLocaleDateString('fr-FR'),
    syllabus: []
  };

  courses.unshift(newCourse);
  await writeJson(COURSES_FILE, courses);

  await addServerAuditLog(admin.name, 'create_course', `Création de la formation "${newCourse.title}" (${newCourse.domain})`, 'course', newCourse.id);
  res.json({ success: true, course: newCourse });
}));

app.put('/api/admin/courses/:id', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_courses');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  const body = req.body || {};
  if (!id || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ success: false, error: 'Identifiant ou données de formation invalides.' });
  }
  const courses = await readJson<any[]>(COURSES_FILE, []);
  const idx = courses.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Formation introuvable.' });

  const current = courses[idx];
  const cleanTitle = body.title !== undefined ? sanitizePlainText(body.title, { minLength: 1, maxLength: 160, required: true }) : current.title;
  const cleanDescription = body.description !== undefined ? sanitizePlainText(body.description, { maxLength: 3000, allowNewlines: true }) : current.description;
  const cleanImageUrl = body.imageUrl !== undefined ? validateSafeUrlOrPath(body.imageUrl, 2048) : current.imageUrl;
  const cleanVideoUrl = body.videoUrl !== undefined ? validateSafeUrlOrPath(body.videoUrl, 2048) : current.videoUrl;
  const parsedPrice = body.price !== undefined ? validateSafeNonNegativeInt(body.price, { max: 50_000_000 }) : current.price;
  if (!cleanTitle || cleanDescription === null || cleanImageUrl === null || cleanVideoUrl === null || parsedPrice === null) {
    return res.status(400).json({ success: false, error: 'Données de formation invalides.' });
  }
  const nextStatus = body.status === 'draft' || body.status === 'suspended' || body.status === 'published'
    ? body.status
    : current.status;

  const updated = {
    ...current,
    title: cleanTitle,
    category: body.category !== undefined ? (sanitizePlainText(body.category, { maxLength: 80 }) || current.category) : current.category,
    domain: body.domain && ['electronique', 'electrotechnique', 'informatique'].includes(body.domain) ? body.domain : current.domain,
    description: cleanDescription,
    imageUrl: cleanImageUrl,
    videoUrl: cleanVideoUrl,
    duration: body.duration !== undefined ? (sanitizePlainText(body.duration, { maxLength: 60 }) ?? current.duration) : current.duration,
    level: body.level !== undefined ? (sanitizePlainText(body.level, { maxLength: 60 }) ?? current.level) : current.level,
    price: parsedPrice,
    isFree: body.isFree !== undefined ? Boolean(body.isFree) : current.isFree,
    status: nextStatus,
    id,
    isPublished: nextStatus === 'published'
  };

  courses[idx] = updated;
  await writeJson(COURSES_FILE, courses);

  await addServerAuditLog(admin.name, 'update_course', `Modification de la formation "${updated.title}"`, 'course', id);
  res.json({ success: true, course: updated });
}));

app.patch('/api/admin/courses/:id/status', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_courses');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const { status } = req.body || {};
  if (!['published', 'draft', 'suspended'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Statut invalide.' });
  }

  const courses = await readJson<any[]>(COURSES_FILE, []);
  const idx = courses.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Formation introuvable.' });

  courses[idx].status = status;
  courses[idx].isPublished = status === 'published';
  await writeJson(COURSES_FILE, courses);

  await addServerAuditLog(admin.name, 'update_course_status', `Statut de la formation "${courses[idx].title}" changé en ${status}`, 'course', id);
  res.json({ success: true, course: courses[idx] });
}));

app.delete('/api/admin/courses/:id', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'delete_courses');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const courses = await readJson<any[]>(COURSES_FILE, []);
  const target = courses.find((c) => c.id === id);
  if (!target) return res.status(404).json({ success: false, error: 'Formation introuvable.' });

  const archiveId = await archiveItem('course', target.id, target.title, target);
  const filtered = courses.filter((c) => c.id !== id);
  try {
    await writeJson(COURSES_FILE, filtered);
  } catch (error) {
    await deleteArchiveRecord(archiveId);
    throw error;
  }

  await addServerAuditLog(admin.name, 'archive_course', `Archivage de la formation "${target.title}"`, 'course', id);
  res.json({ success: true, message: 'Formation supprimée avec succès.' });
}));

// Category Management API
app.get('/api/course-categories', asyncRoute(async (_req: Request, res: Response) => {
  const categories = await readJson<any[]>(COURSE_CATEGORIES_FILE, DEFAULT_COURSE_CATEGORIES);
  res.json({ success: true, categories });
}));

app.post('/api/admin/course-categories', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_courses');
  if (!admin) return;
  const { label, name, domain } = req.body || {};
  const cleanLabel = sanitizePlainText(label ?? name, { minLength: 1, maxLength: 100, required: true });
  if (!cleanLabel) {
    return res.status(400).json({ success: false, error: 'Libellé de catégorie obligatoire.' });
  }
  const cleanDomain = domain ?? 'electronique';
  if (!['electronique', 'electrotechnique', 'informatique'].includes(cleanDomain)) {
    return res.status(400).json({ success: false, error: 'Domaine invalide.' });
  }

  const categories = await readJson<any[]>(COURSE_CATEGORIES_FILE, DEFAULT_COURSE_CATEGORIES);
  const newCat = {
    id: `cat-${cleanDomain.slice(0, 4)}-${Date.now()}`,
    label: cleanLabel,
    name: cleanLabel,
    domain: cleanDomain,
    isActive: true
  };

  categories.push(newCat);
  await writeJson(COURSE_CATEGORIES_FILE, categories);

  await addServerAuditLog(admin.name, 'create_course_category', `Ajout de la catégorie de cours "${newCat.label}" (${cleanDomain})`, 'category', newCat.id);
  res.status(201).json({ success: true, category: newCat });
}));

app.put('/api/admin/course-categories/:id', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_courses');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const { label, name, domain, isActive } = req.body || {};
  const categories = await readJson<any[]>(COURSE_CATEGORIES_FILE, DEFAULT_COURSE_CATEGORIES);
  const idx = categories.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Catégorie introuvable.' });

  const cleanLabel = (label !== undefined || name !== undefined)
    ? sanitizePlainText(label ?? name, { minLength: 1, maxLength: 100, required: true })
    : undefined;
  if (cleanLabel === null) {
    return res.status(400).json({ success: false, error: 'Libellé de catégorie invalide.' });
  }
  if (cleanLabel) {
    categories[idx].label = cleanLabel;
    categories[idx].name = cleanLabel;
  }
  if (domain && ['electronique', 'electrotechnique', 'informatique'].includes(domain)) categories[idx].domain = domain;
  if (typeof isActive === 'boolean') categories[idx].isActive = isActive;

  await writeJson(COURSE_CATEGORIES_FILE, categories);
  await addServerAuditLog(admin.name, 'update_course_category', `Mise à jour de la catégorie de cours "${categories[idx].label}"`, 'category', id);
  res.json({ success: true, category: categories[idx] });
}));

app.delete('/api/admin/course-categories/:id', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'delete_courses');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const categories = await readJson<any[]>(COURSE_CATEGORIES_FILE, DEFAULT_COURSE_CATEGORIES);
  const target = categories.find((c) => c.id === id);
  if (!target) return res.status(404).json({ success: false, error: 'Catégorie introuvable.' });

  const archiveId = await archiveItem('course-category', target.id, target.label || target.name || id, target);
  const filtered = categories.filter((c) => c.id !== id);
  try {
    await writeJson(COURSE_CATEGORIES_FILE, filtered);
  } catch (error) {
    await deleteArchiveRecord(archiveId);
    throw error;
  }
  await addServerAuditLog(admin.name, 'archive_course_category', `Archivage de la catégorie de cours "${target.label || target.name}"`, 'category', id);
  res.json({ success: true, message: 'Catégorie supprimée avec succès.' });
}));

// Investor Status & Admin Management
app.get('/api/admin/investors', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminAnyPermission(req, res, [
    'manage_investors',
    'manage_investors_password',
    'manage_funds',
    'manage_wallet_adjust',
    'manage_subscriptions'
  ]);
  if (!admin) return;
  const investors = await listInvestors<ServerInvestorUser>();
  res.json({ investors: investors.map(publicInvestor) });
}));

app.post('/api/admin/investors', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_investors');
  if (!admin) return;
  const { lastName, firstName, email, phone, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Veuillez renseigner l’adresse e-mail et le mot de passe.' });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter entre 8 et 128 caractères.' });
  }

  if (lastName !== undefined || firstName !== undefined || phone !== undefined) {
    if (typeof lastName !== 'string' || typeof firstName !== 'string' || typeof phone !== 'string') {
      return res.status(400).json({ success: false, error: 'Le nom, le prénom et le téléphone sont obligatoires pour créer un investisseur.' });
    }
    const identityCheck = validateRealIdentity(lastName, firstName, cleanEmail, phone);
    if (!identityCheck.valid) {
      return res.status(400).json({ success: false, error: identityCheck.error });
    }
    if (await findInvestorByEmail<ServerInvestorUser>(cleanEmail)) {
      return res.status(409).json({
        success: false,
        error: 'Un investisseur existe déjà avec cette adresse. Utilisez le mode activation pour conserver son dossier.'
      });
    }

    const numberField = (value: unknown): number | null => {
      if (value === undefined || value === null || value === '') return 0;
      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 0) {
        return null;
      }
      return parsed;
    };
    let totalInvested = numberField(req.body.totalInvested);
    let sharesCount = numberField(req.body.sharesCount);
    const dividendsEarned = numberField(req.body.dividendsEarned);
    if (totalInvested === null || sharesCount === null || dividendsEarned === null) {
      return res.status(400).json({ success: false, error: 'Les montants et le nombre de parts doivent être des entiers positifs ou nuls.' });
    }

    const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
    let shareAllocations: InvestorShareAllocation[] = [];
    if (req.body.shareAllocations !== undefined) {
      const sanitizedAllocations = sanitizeShareAllocations(req.body.shareAllocations, operations);
      if (!sanitizedAllocations) {
        return res.status(400).json({ success: false, error: 'Répartition des parts par boutique/opération invalide.' });
      }
      shareAllocations = sanitizedAllocations;
      if (shareAllocations.length > 0) {
        sharesCount = shareAllocations.reduce((sum, item) => sum + item.shares, 0);
        const allocAmountSum = shareAllocations.reduce((sum, item) => sum + item.amount, 0);
        if (allocAmountSum > 0 || totalInvested === 0) {
          totalInvested = allocAmountSum;
        }
      }
    }

    const { hash, salt } = hashInvestorPassword(password);
    const passwordEscrow = encryptInvestorEscrowPassword(password);
    const cleanLastName = lastName.trim();
    const cleanFirstName = firstName.trim();
    const fullName = `${cleanFirstName} ${cleanLastName}`;
    const nowIso = new Date().toISOString();
    const investor: ServerInvestorUser = {
      id: crypto.randomUUID(),
      lastName: cleanLastName,
      firstName: cleanFirstName,
      name: fullName,
      email: cleanEmail,
      phone: phone.trim(),
      passwordHash: hash,
      passwordSalt: salt,
      passwordAlgorithm: INVESTOR_PASSWORD_ALGORITHM,
      passwordUpdatedAt: nowIso,
      passwordEscrow,
      status: 'en_attente',
      statusReason: 'Compte créé par l’administrateur, en attente de validation.',
      statusUpdatedAt: new Date().toLocaleDateString('fr-FR'),
      isVerified: false,
      createdAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
      totalInvested,
      sharesCount,
      dividendsEarned,
      ...(shareAllocations.length > 0 ? { shareAllocations } : {}),
      role: 'investor'
    };
    try {
      await createInvestor(investor);
    } catch (error) {
      const conflictMessage = investorConflictMessage(error);
      if (conflictMessage) return res.status(409).json({ success: false, error: conflictMessage });
      throw error;
    }
    await addServerAuditLog(
      admin.name,
      'create_investor',
      `Création du compte investisseur ${fullName} (${cleanEmail}).`,
      'investor',
      investor.id
    );
    broadcastDataChanged('investors');
    return res.status(201).json({
      success: true,
      message: 'Compte investisseur créé. Il pourra se connecter avec le mot de passe fourni.',
      investor: publicInvestor(investor)
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'L’adresse e-mail est invalide.' });
  }
  const existingInvestor = await findInvestorByEmail<ServerInvestorUser>(cleanEmail);
  if (!existingInvestor) {
    return res.status(404).json({
      success: false,
      error: 'Aucun investisseur existant ne correspond à cette adresse. Utilisez l’adresse déjà enregistrée dans son dossier.'
    });
  }

  const updatedInvestor = await updateInvestor<ServerInvestorUser>(
    existingInvestor.id,
    (current) => ({
      ...withInvestorPassword(current, password),
      passwordEscrow: encryptInvestorEscrowPassword(password)
    })
  );
  if (!updatedInvestor) {
    return res.status(404).json({ success: false, error: 'Le compte investisseur n’existe plus.' });
  }
  await deleteInvestorSessions(updatedInvestor.id);

  await addServerAuditLog(
    admin.name,
    'provision_investor_account',
    `Activation de l’accès investisseur pour ${updatedInvestor.email}; dossier et portefeuille existants conservés.`,
    'investor',
    updatedInvestor.id
  );
  broadcastDataChanged('investors');
  return res.json({
    success: true,
    message: 'Accès activé. Le profil, l’identifiant et les parts existants ont été conservés.',
    investor: publicInvestor(updatedInvestor)
  });
}));

app.get('/api/admin/investors/:id', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminAnyPermission(req, res, [
    'manage_investors',
    'manage_investors_password',
    'manage_funds',
    'manage_wallet_adjust',
    'manage_subscriptions'
  ]);
  if (!admin) return;
  const investor = await findInvestorByIdentifier<ServerInvestorUser>(req.params.id);
  if (!investor) return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });
  const legacyIdentity = investor as ServerInvestorUser & {
    investorId?: unknown;
    investor_id?: unknown;
    userId?: unknown;
    user_id?: unknown;
  };
  const legacyIds = [
    legacyIdentity.investorId,
    legacyIdentity.investor_id,
    legacyIdentity.userId,
    legacyIdentity.user_id
  ].filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  const subscriptions = await readInvestorSubscriptions<ShareSubscription>({
    id: investor.id,
    email: investor.email,
    legacyIds
  });
  return res.json({ success: true, investor: publicInvestor(investor), subscriptions });
}));

app.patch('/api/admin/investors/:id', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_investors');
  if (!admin) return;
  const investor = await findInvestorByIdentifier<ServerInvestorUser>(req.params.id);
  if (!investor) return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });

  const body = req.body || {};
  const nextLastName = body.lastName === undefined ? investor.lastName : body.lastName;
  const nextFirstName = body.firstName === undefined ? investor.firstName : body.firstName;
  const nextEmail = body.email === undefined ? investor.email : body.email;
  const nextPhone = body.phone === undefined ? investor.phone : body.phone;
  const nextStatus = body.status === undefined ? investor.status : body.status;
  if (
    typeof nextLastName !== 'string' ||
    typeof nextFirstName !== 'string' ||
    typeof nextEmail !== 'string' ||
    typeof nextPhone !== 'string'
  ) {
    return res.status(400).json({ success: false, error: 'Les champs d’identité doivent être des textes valides.' });
  }
  const identityCheck = validateRealIdentity(nextLastName, nextFirstName, nextEmail, nextPhone);
  if (!identityCheck.valid) return res.status(400).json({ success: false, error: identityCheck.error });
  if (body.statusReason !== undefined && (typeof body.statusReason !== 'string' || body.statusReason.length > 500)) {
    return res.status(400).json({ success: false, error: 'Le motif du statut doit être un texte de 500 caractères maximum.' });
  }
  const validStatuses: InvestorStatus[] = ['demande_non_soumise', 'en_attente', 'approuve', 'refuse', 'suspendu', 'bloque'];
  if (!validStatuses.includes(nextStatus)) {
    return res.status(400).json({ success: false, error: 'Statut investisseur invalide.' });
  }
  const parseAmount = (value: unknown, current: number): number | null => {
    if (value === undefined) return Number.isSafeInteger(current) && current >= 0 ? current : 0;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  };
  let totalInvested = parseAmount(body.totalInvested, investor.totalInvested);
  let sharesCount = parseAmount(body.sharesCount, investor.sharesCount);
  const dividendsEarned = parseAmount(body.dividendsEarned, investor.dividendsEarned);
  if (totalInvested === null || sharesCount === null || dividendsEarned === null) {
    return res.status(400).json({ success: false, error: 'Les montants et le nombre de parts doivent être des entiers positifs ou nuls.' });
  }

  let nextAllocations: InvestorShareAllocation[] | undefined = investor.shareAllocations;
  if (body.shareAllocations !== undefined) {
    const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
    const sanitizedAllocations = sanitizeShareAllocations(body.shareAllocations, operations);
    if (!sanitizedAllocations) {
      return res.status(400).json({ success: false, error: 'Répartition des parts par boutique/opération invalide.' });
    }
    nextAllocations = sanitizedAllocations;
    sharesCount = sanitizedAllocations.reduce((sum, item) => sum + item.shares, 0);
    const allocAmountSum = sanitizedAllocations.reduce((sum, item) => sum + item.amount, 0);
    if (body.totalInvested === undefined || allocAmountSum > 0) {
      totalInvested = allocAmountSum;
    }
  }

  try {
    const updatedInvestor = await updateInvestor<ServerInvestorUser>(investor.id, (current) => ({
      ...current,
      lastName: nextLastName.trim(),
      firstName: nextFirstName.trim(),
      name: `${nextFirstName.trim()} ${nextLastName.trim()}`,
      email: nextEmail.trim().toLowerCase(),
      phone: nextPhone.trim(),
      status: nextStatus,
      statusReason: typeof body.statusReason === 'string'
        ? body.statusReason.trim()
        : nextStatus === current.status
          ? current.statusReason
          : `Statut mis à jour en "${nextStatus}" par l'administrateur.`,
      statusUpdatedAt: nextStatus === current.status ? current.statusUpdatedAt : new Date().toLocaleDateString('fr-FR'),
      totalInvested,
      sharesCount,
      dividendsEarned,
      ...(nextAllocations !== undefined ? { shareAllocations: nextAllocations } : {})
    }));
    if (!updatedInvestor) return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });
    if (investor.email.trim().toLowerCase() !== updatedInvestor.email.trim().toLowerCase()) {
      await deleteInvestorSessions(updatedInvestor.id);
    }
    await addServerAuditLog(
      admin.name,
      'update_investor',
      `Mise à jour du profil et du portefeuille de ${updatedInvestor.name}.`,
      'investor',
      updatedInvestor.id
    );
    broadcastDataChanged('investors');
    return res.json({ success: true, investor: publicInvestor(updatedInvestor) });
  } catch (error) {
    const conflictMessage = investorConflictMessage(error);
    if (conflictMessage) return res.status(409).json({ success: false, error: conflictMessage });
    throw error;
  }
}));

app.get('/api/admin/investors/:id/password', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_investors_password');
  if (!admin) return;
  const investor = await findInvestorByIdentifier<ServerInvestorUser>(req.params.id);
  if (!investor) return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });

  const escrowedPassword = decryptInvestorEscrowPassword(investor.passwordEscrow);
  const currentPassword =
    escrowedPassword ||
    (typeof investor.assignedPassword === 'string' && investor.assignedPassword.length > 0
      ? investor.assignedPassword
      : typeof investor.assignedPasswordPlainText === 'string' && investor.assignedPasswordPlainText.length > 0
        ? investor.assignedPasswordPlainText
        : null);

  await addServerAuditLog(
    admin.name,
    'view_investor_password',
    `Consultation du mot de passe du dossier investisseur ${investor.email}.`,
    'investor',
    investor.id
  );

  return res.json({
    success: true,
    hasPasswordConfigured: Boolean(
      (investor.passwordHash && investor.passwordSalt) ||
      investor.assignedPassword ||
      investor.assignedPasswordPlainText
    ),
    passwordAlgorithm: investor.passwordAlgorithm || (investor.passwordHash ? INVESTOR_PASSWORD_ALGORITHM : undefined),
    passwordUpdatedAt: investor.passwordUpdatedAt,
    currentPassword
  });
}));

app.put('/api/admin/investors/:id/password', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_investors_password');
  if (!admin) return;
  const { password } = req.body || {};
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter entre 8 et 128 caractères.' });
  }
  const investor = await findInvestorByIdentifier<ServerInvestorUser>(req.params.id);
  if (!investor) return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });
  const passwordEscrow = encryptInvestorEscrowPassword(password);
  const updatedInvestor = await updateInvestor<ServerInvestorUser>(investor.id, (current) => ({
    ...withInvestorPassword(current, password),
    passwordEscrow
  }));
  if (!updatedInvestor) return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });
  await deleteInvestorSessions(updatedInvestor.id);
  await addServerAuditLog(
    admin.name,
    'reset_investor_password',
    `Modification du mot de passe de ${updatedInvestor.email}; sessions existantes révoquées.`,
    'investor',
    updatedInvestor.id
  );
  broadcastDataChanged('investors');
  return res.json({
    success: true,
    message: 'Mot de passe mis à jour; l’investisseur pourra se connecter immédiatement avec ce mot de passe.',
    investor: publicInvestor(updatedInvestor)
  });
}));

app.patch('/api/admin/investors/:id/subscriptions/:subscriptionId', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_subscriptions');
  if (!admin) return;
  const investor = await findInvestorByIdentifier<ServerInvestorUser>(req.params.id);
  if (!investor) return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });
  const legacyIdentity = investor as ServerInvestorUser & {
    investorId?: unknown;
    investor_id?: unknown;
    userId?: unknown;
    user_id?: unknown;
  };
  const legacyIds = [
    legacyIdentity.investorId,
    legacyIdentity.investor_id,
    legacyIdentity.userId,
    legacyIdentity.user_id
  ].filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  const subscriptions = await readInvestorSubscriptions<ShareSubscription>({
    id: investor.id,
    email: investor.email,
    legacyIds
  });
  const target = subscriptions.find((item) => item.id === req.params.subscriptionId);
  if (!target) return res.status(404).json({ success: false, error: 'Souscription introuvable pour cet investisseur.' });

  const body = req.body || {};
  const shares = body.shares === undefined ? target.shares : Number(body.shares);
  const sharePrice = body.sharePrice === undefined ? target.sharePrice : Number(body.sharePrice);
  const totalAmount = body.totalAmount === undefined ? target.totalAmount : Number(body.totalAmount);
  const validStatuses: ShareSubscription['status'][] = ['pending_admin', 'approved_pending_payment', 'paid_and_issued', 'rejected'];
  const status = body.status === undefined ? target.status : body.status;
  if (
    !Number.isSafeInteger(shares) || shares < 1 ||
    !Number.isSafeInteger(sharePrice) || sharePrice < 1 ||
    !Number.isSafeInteger(totalAmount) || totalAmount < 0 ||
    !validStatuses.includes(status)
  ) {
    return res.status(400).json({ success: false, error: 'Parts, prix, montant ou statut de souscription invalide.' });
  }
  for (const field of ['approvedAt', 'paidAt', 'paymentMethod'] as const) {
    if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > 120)) {
      return res.status(400).json({ success: false, error: `Le champ ${field} est invalide.` });
    }
  }

  const updatedSubscription = await updateApplicationRecord<ShareSubscription>(
    'subscriptions',
    target.id,
    (current) => ({
      ...current,
      shares,
      sharePrice,
      totalAmount,
      status,
      ...(body.approvedAt !== undefined ? { approvedAt: body.approvedAt.trim() || undefined } : {}),
      ...(body.paidAt !== undefined ? { paidAt: body.paidAt.trim() || undefined } : {}),
      ...(body.paymentMethod !== undefined ? { paymentMethod: body.paymentMethod.trim() || undefined } : {})
    })
  );
  if (!updatedSubscription) return res.status(404).json({ success: false, error: 'Souscription introuvable.' });
  await addServerAuditLog(
    admin.name,
    'update_investor_subscription',
    `Mise à jour de la souscription ${updatedSubscription.id} pour ${investor.email}.`,
    'investor',
    investor.id
  );
  broadcastDataChanged('investors');
  broadcastDataChanged('subscriptions');
  return res.json({ success: true, subscription: updatedSubscription });
}));

app.get('/api/investor/status/:idOrEmail', asyncRoute(async (req: Request, res: Response) => {
  const sessionInvestor = await getAuthenticatedInvestor(req);
  if (!sessionInvestor) return res.status(401).json({ success: false, error: 'Session expirée. Veuillez vous reconnecter.' });
  if (req.params.idOrEmail.toLowerCase() !== sessionInvestor.id.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Accès refusé à ce compte investisseur.' });
  }
  return res.json({ success: true, investor: publicInvestor(sessionInvestor) });
}));

const handleUpdateInvestorStatus = async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_investors');
  if (!admin) return;
  const id = validateSafeId(req.params.id) || validateEmailInput(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant investisseur invalide.' });
  const { status, reason } = req.body || {};

  const validStatuses: InvestorStatus[] = ['demande_non_soumise', 'en_attente', 'approuve', 'refuse', 'suspendu', 'bloque'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Statut investisseur invalide.' });
  }
  const cleanReason = reason !== undefined ? sanitizePlainText(reason, { maxLength: 500 }) : '';
  if (cleanReason === null) {
    return res.status(400).json({ success: false, error: 'Le motif du statut est invalide ou dépasse 500 caractères.' });
  }

  const inv = await findInvestorByIdentifier<ServerInvestorUser>(id);
  if (!inv) {
    return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });
  }

  const oldStatus = inv.status;
  const updatedInvestor = await updateInvestor<ServerInvestorUser>(inv.id, (current) => ({
    ...current,
    status,
    statusReason: cleanReason || (status === 'approuve' ? 'Compte formellement approuvé et validé par l’administrateur.' : `Statut mis à jour en "${status}" par l'administrateur.`),
    statusUpdatedAt: new Date().toLocaleDateString('fr-FR')
  }));
  if (!updatedInvestor) return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });

  await addServerAuditLog(admin.name, 'update_investor_status', `Statut de ${inv.name} modifié : "${oldStatus}" -> "${status}"`, 'investor', inv.id);
  broadcastDataChanged('investors');

  try {
    broadcastPresenceUpdate();
  } catch {}

  res.json({ success: true, investor: publicInvestor(updatedInvestor) });
};

app.post('/api/admin/investors/:id/status', asyncRoute(handleUpdateInvestorStatus));
app.patch('/api/admin/investors/:id/status', asyncRoute(handleUpdateInvestorStatus));

app.delete('/api/admin/investors/:id', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Une session Super-Administrateur est requise pour supprimer un compte.' });
  }
  const admin = await getAuthenticatedAdmin(req);
  const { id } = req.params;
  const target = await findInvestorByIdentifier<ServerInvestorUser>(id);
  if (!target) {
    return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });
  }
  const archiveId = await archiveItem('investor', target.id, target.name, target);
  if (!await deleteInvestor(target.id)) {
    await deleteArchiveRecord(archiveId);
    return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });
  }

  await addServerAuditLog(admin?.name || 'Admin Principal', 'archive_investor', `Archivage du compte investisseur de ${target.name}`, 'investor', id);
  broadcastDataChanged('investors');
  res.json({ success: true, message: `Compte investisseur de ${target.name} placé dans la corbeille.` });
}));

// Audit Logs Management
app.get('/api/admin/audit-logs', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'view_audit');
  if (!admin) return;
  const logs = await readJson<AuditAction[]>(AUDIT_LOGS_FILE, []);
  res.json({ auditLogs: logs });
}));

app.delete('/api/admin/audit-logs/:id', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Seul l’administrateur principal peut supprimer une entrée du journal.' });
  }
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const logs = await readJson<AuditAction[]>(AUDIT_LOGS_FILE, []);
  const target = logs.find((log) => log.id === id);
  if (!target) return res.status(404).json({ success: false, error: 'Entrée du journal introuvable.' });
  const archiveId = await archiveItem('audit-log', target.id, target.description, target);
  const remaining = logs.filter((l) => l.id !== id);
  try {
    await writeJson(AUDIT_LOGS_FILE, remaining);
  } catch (error) {
    await deleteArchiveRecord(archiveId);
    throw error;
  }
  res.json({ success: true, message: 'Entrée du journal supprimée.' });
}));

app.delete('/api/admin/audit-logs', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Seul l’administrateur principal peut vider le journal d’audit.' });
  }
  const logs = await readJson<AuditAction[]>(AUDIT_LOGS_FILE, []);
  if (logs.length) {
    const archiveId = await archiveItem('audit-log-batch', `batch-${Date.now()}`, `${logs.length} entrées du journal`, logs);
    try {
      await writeJson(AUDIT_LOGS_FILE, []);
    } catch (error) {
      await deleteArchiveRecord(archiveId);
      throw error;
    }
  } else {
    await writeJson(AUDIT_LOGS_FILE, []);
  }
  res.json({ success: true, message: 'Journal d’audit entièrement vidé.' });
}));

app.get('/api/admin/subscriptions', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminAnyPermission(req, res, ['manage_subscriptions', 'manage_investors', 'manage_operations']);
  if (!admin) return;
  const subscriptions = await readJson<ShareSubscription[]>(SUBSCRIPTIONS_FILE, []);
  res.json({ success: true, subscriptions });
}));

app.post('/api/admin/subscriptions/:id/approve', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_subscriptions');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant de souscription invalide.' });
  if (processingSubscriptions.has(id)) {
    return res.status(409).json({ success: false, error: 'Cette souscription est déjà en cours de traitement.' });
  }
  processingSubscriptions.add(id);

  try {
    const cleanCode = req.body?.adminPasswordCode !== undefined
      ? sanitizePlainText(req.body.adminPasswordCode, { maxLength: 80 })
      : undefined;
    if (cleanCode === null) {
      return res.status(400).json({ success: false, error: 'Code de validation invalide.' });
    }
    const nowFormatted = `${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    let invalidState: string | undefined;
    const updated = await updateApplicationRecord<ShareSubscription>('subscriptions', id, (current) => {
      if (current.status !== 'pending_admin') {
        invalidState = current.status;
        return current;
      }
      return {
        ...current,
        status: 'approved_pending_payment',
        approvedAt: nowFormatted,
        ...(cleanCode ? { adminPasswordCode: cleanCode } : {})
      };
    });
    if (!updated) return res.status(404).json({ success: false, error: 'Souscription introuvable.' });
    if (invalidState) {
      return res.status(409).json({ success: false, error: `Cette souscription a déjà le statut "${invalidState}".` });
    }
    await addServerAuditLog(admin.name, 'approve_subscription', `Approbation souscription ${id} (${updated.investorName})`, 'subscription', id);
    broadcastDataChanged('subscriptions');
    return res.json({ success: true, subscription: updated });
  } finally {
    processingSubscriptions.delete(id);
  }
}));

app.post('/api/admin/subscriptions/:id/validate', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_subscriptions');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant de souscription invalide.' });
  if (processingSubscriptions.has(id)) {
    return res.status(409).json({ success: false, error: 'Validation déjà en cours pour cette souscription.' });
  }
  processingSubscriptions.add(id);

  try {
    const cleanMethod = sanitizePlainText(req.body?.paymentMethod, { maxLength: 80 }) || 'Mobile Money / Virement';
    const nowFormatted = `${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

    let invalidState: string | undefined;
    let shouldCreditInvestor = false;
    const updated = await updateApplicationRecord<ShareSubscription>('subscriptions', id, (current) => {
      if (current.status === 'paid_and_issued' || current.status === 'rejected') {
        invalidState = current.status;
        return current;
      }
      shouldCreditInvestor = !current.sharesCredited;
      return {
        ...current,
        status: 'paid_and_issued',
        sharesCredited: true,
        paidAt: nowFormatted,
        paymentMethod: cleanMethod
      };
    });
    if (!updated) return res.status(404).json({ success: false, error: 'Souscription introuvable.' });
    if (invalidState) {
      return res.status(409).json({ success: false, error: `Cette souscription a déjà le statut "${invalidState}".` });
    }

    const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
    const operation = operations.find((op) => op.id === updated.operationId);
    const opSector: BoutiqueSector =
      operation?.sector && VALID_BOUTIQUE_SECTORS.has(operation.sector)
        ? operation.sector
        : 'Électronique';

    if (shouldCreditInvestor) {
      const investor = await findInvestorByIdentifier<ServerInvestorUser>(updated.investorId || updated.investorEmail);
      if (investor) {
        await updateInvestor<ServerInvestorUser>(investor.id, (current) => ({
          ...current,
          sharesCount: (current.sharesCount || 0) + updated.shares,
          totalInvested: (current.totalInvested || 0) + updated.totalAmount,
          shareAllocations: mergeInvestorShareAllocation(
            current.shareAllocations,
            opSector,
            updated.operationId,
            updated.operationTitle || operation?.title,
            updated.shares,
            updated.totalAmount
          )
        }));
      }
      if (operation) {
        operation.collectedAmount = (operation.collectedAmount || 0) + updated.totalAmount;
        operation.investorsCount = (operation.investorsCount || 0) + 1;
        if (operation.targetAmount && operation.targetAmount > 0) {
          operation.percent = Math.min(100, Math.round((operation.collectedAmount / operation.targetAmount) * 100));
        }
        await writeJson(OPERATIONS_FILE, operations);
      }
    }

    await addServerAuditLog(
      admin.name,
      'validate_subscription_payment',
      `Paiement validé & ${updated.shares} part(s) émise(s) pour ${updated.investorName} (${updated.operationTitle})`,
      'subscription',
      id
    );
    broadcastDataChanged('subscriptions');
    broadcastDataChanged('investors');
    broadcastDataChanged('operations');
    return res.json({ success: true, subscription: updated });
  } finally {
    processingSubscriptions.delete(id);
  }
}));

app.post('/api/admin/subscriptions/:id/reject', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_subscriptions');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant de souscription invalide.' });
  if (processingSubscriptions.has(id)) {
    return res.status(409).json({ success: false, error: 'Une action est déjà en cours sur cette souscription.' });
  }
  processingSubscriptions.add(id);

  try {
    let invalidState: string | undefined;
    let wasCreditedBefore = false;
    const updated = await updateApplicationRecord<ShareSubscription>('subscriptions', id, (current) => {
      if (current.status === 'paid_and_issued' || current.status === 'rejected') {
        invalidState = current.status;
        return current;
      }
      wasCreditedBefore = Boolean(current.sharesCredited);
      return {
        ...current,
        status: 'rejected',
        sharesCredited: false
      };
    });
    if (!updated) return res.status(404).json({ success: false, error: 'Souscription introuvable.' });
    if (invalidState) {
      return res.status(409).json({ success: false, error: `Cette souscription a déjà le statut "${invalidState}".` });
    }

    if (updated.operationId) {
      await releaseOperationShares(updated.operationId, updated.shares);
      const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
      const opIdx = operations.findIndex((op) => op.id === updated.operationId);
      if (opIdx >= 0) {
        operations[opIdx].subscribedShares = Math.max(0, (operations[opIdx].subscribedShares || 0) - updated.shares);
        if (wasCreditedBefore) {
          operations[opIdx].collectedAmount = Math.max(0, (operations[opIdx].collectedAmount || 0) - updated.totalAmount);
          if (operations[opIdx].targetAmount && operations[opIdx].targetAmount > 0) {
            operations[opIdx].percent = Math.min(100, Math.round((operations[opIdx].collectedAmount / operations[opIdx].targetAmount) * 100));
          }
        }
        await writeJson(OPERATIONS_FILE, operations);
      }
    }

    if (wasCreditedBefore) {
      const investor = await findInvestorByIdentifier<ServerInvestorUser>(updated.investorId || updated.investorEmail);
      if (investor) {
        await updateInvestor<ServerInvestorUser>(investor.id, (current) => ({
          ...current,
          sharesCount: Math.max(0, (current.sharesCount || 0) - updated.shares),
          totalInvested: Math.max(0, (current.totalInvested || 0) - updated.totalAmount)
        }));
        broadcastDataChanged('investors');
      }
    }

    await addServerAuditLog(admin.name, 'reject_subscription', `Refus souscription ${id} (${updated.investorName})`, 'subscription', id);
    broadcastDataChanged('subscriptions');
    broadcastDataChanged('operations');
    return res.json({ success: true, subscription: updated });
  } finally {
    processingSubscriptions.delete(id);
  }
}));

app.delete('/api/admin/subscriptions/:id', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_subscriptions');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const subscriptions = await readJson<ShareSubscription[]>(SUBSCRIPTIONS_FILE, []);
  const target = subscriptions.find((subscription) => subscription.id === id);
  if (!target) return res.status(404).json({ success: false, error: 'Souscription introuvable.' });
  const archiveId = await archiveItem('subscription', target.id, `${target.investorName} — ${target.operationTitle || target.id}`, target);
  try {
    await writeJson(SUBSCRIPTIONS_FILE, subscriptions.filter((subscription) => subscription.id !== id));
  } catch (error) {
    await deleteArchiveRecord(archiveId);
    throw error;
  }
  if (target.status !== 'rejected' && target.operationId) {
    await releaseOperationShares(target.operationId, target.shares);
  }
  await addServerAuditLog(admin.name, 'archive_subscription', `Archivage souscription ${id}`, 'subscription', id);
  broadcastDataChanged('subscriptions');
  res.json({ success: true, message: 'Souscription déplacée dans la corbeille.' });
}));

// Activities CRUD
app.post('/api/admin/activities', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_content');
  if (!admin) return;
  const { title, description, desc, badge, sector, photoUrl, imageUrl } = req.body || {};
  const cleanTitle = sanitizePlainText(title, { minLength: 1, maxLength: 160, required: true });
  const cleanDesc = sanitizePlainText(description ?? desc ?? '', { maxLength: 2000, allowNewlines: true });
  const cleanBadge = sanitizePlainText(badge, { maxLength: 60 });
  const cleanSector = sanitizePlainText(sector, { maxLength: 60 });
  const rawPhoto = photoUrl ?? imageUrl;
  const cleanPhotoUrl = rawPhoto !== undefined && rawPhoto !== '' ? validateSafeUrlOrPath(rawPhoto, 10000) : '';
  if (!cleanTitle || cleanDesc === null || cleanBadge === null || cleanSector === null || cleanPhotoUrl === null) {
    return res.status(400).json({ success: false, error: 'Données d’activité invalides.' });
  }

  const acts = await readJson<InvestorActivity[]>(ACTIVITIES_FILE, []);
  const newAct: InvestorActivity = {
    id: `act-${Date.now()}`,
    title: cleanTitle,
    description: cleanDesc,
    badge: cleanBadge || 'Réalisation',
    sector: cleanSector || 'Industrie',
    photoUrl: cleanPhotoUrl || undefined,
    imageUrl: cleanPhotoUrl || undefined,
    date: new Date().toLocaleDateString('fr-FR'),
    isPublished: true
  };
  acts.unshift(newAct);
  await writeJson(ACTIVITIES_FILE, acts);

  await addServerAuditLog(admin.name, 'add_activity', `Publication activité "${newAct.title}"`, 'activity', newAct.id);
  res.status(201).json({ success: true, activity: newAct });
}));

app.delete('/api/admin/activities/:id', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_content');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const acts = await readJson<InvestorActivity[]>(ACTIVITIES_FILE, []);
  const target = acts.find((activity) => activity.id === id);
  if (!target) return res.status(404).json({ success: false, error: 'Activité introuvable.' });
  const archiveId = await archiveItem('activity', target.id, target.title, target);
  const remaining = acts.filter((a) => a.id !== id);
  try {
    await writeJson(ACTIVITIES_FILE, remaining);
  } catch (error) {
    await deleteArchiveRecord(archiveId);
    throw error;
  }
  await addServerAuditLog(admin.name, 'archive_activity', `Archivage activité "${target.title}"`, 'activity', id);
  res.json({ success: true, message: 'Activité déplacée dans la corbeille.' });
}));

// Documents CRUD
app.post('/api/admin/documents', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_content');
  if (!admin) return;
  const { title, description, desc, fileUrl, url, format, size } = req.body || {};
  const cleanTitle = sanitizePlainText(title, { minLength: 1, maxLength: 160, required: true });
  const cleanDesc = sanitizePlainText(description ?? desc ?? '', { maxLength: 2000, allowNewlines: true });
  const rawFileUrl = fileUrl ?? url;
  const cleanFileUrl = rawFileUrl !== undefined && rawFileUrl !== '' ? validateSafeUrlOrPath(rawFileUrl, 2048) : '';
  const cleanFormat = sanitizePlainText(format, { maxLength: 30 });
  const cleanSize = sanitizePlainText(size, { maxLength: 40 });
  if (!cleanTitle || cleanDesc === null || cleanFileUrl === null || cleanFormat === null || cleanSize === null) {
    return res.status(400).json({ success: false, error: 'Données du document invalides.' });
  }

  const docs = await readJson<InvestorDocument[]>(DOCUMENTS_FILE, []);
  const newDoc: InvestorDocument = {
    id: `doc-${Date.now()}`,
    title: cleanTitle,
    description: cleanDesc,
    fileUrl: cleanFileUrl || '/assets/aistudio/Note_Regle_f4d3053f.pdf',
    format: cleanFormat || 'PDF',
    size: cleanSize || '1.2 Mo',
    date: new Date().toLocaleDateString('fr-FR'),
    isPublished: true
  };
  docs.unshift(newDoc);
  await writeJson(DOCUMENTS_FILE, docs);

  await addServerAuditLog(admin.name, 'add_document', `Publication document "${newDoc.title}"`, 'document', newDoc.id);
  res.status(201).json({ success: true, document: newDoc });
}));

app.delete('/api/admin/documents/:id', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_content');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const docs = await readJson<InvestorDocument[]>(DOCUMENTS_FILE, []);
  const target = docs.find((document) => document.id === id);
  if (!target) return res.status(404).json({ success: false, error: 'Document introuvable.' });
  const archiveId = await archiveItem('document', target.id, target.title, target);
  const remaining = docs.filter((d) => d.id !== id);
  try {
    await writeJson(DOCUMENTS_FILE, remaining);
  } catch (error) {
    await deleteArchiveRecord(archiveId);
    throw error;
  }
  await addServerAuditLog(admin.name, 'archive_document', `Archivage document "${target.title}"`, 'document', id);
  res.json({ success: true, message: 'Document déplacé dans la corbeille.' });
}));

// =========================================================================
// 7. BACKUP & HIGH-SECURITY TOTAL RESET (REMISE À ZÉRO TOTALE)
// =========================================================================

async function buildFullBackup() {
  return {
    exportDate: new Date().toISOString(),
    clients: (await listUsersByRole<ServerClientUser>('client')).map(({ passwordHash: _hash, passwordSalt: _salt, ...client }) => client),
    investors: (await listInvestors<ServerInvestorUser>()).map(publicInvestor),
    operations: await readJson(OPERATIONS_FILE, []),
    subscriptions: await readJson(SUBSCRIPTIONS_FILE, []),
    activities: await readJson(ACTIVITIES_FILE, []),
    documents: await readJson(DOCUMENTS_FILE, []),
    groups: await readJson(GROUPS_FILE, {}),
    courses: await readJson(COURSES_FILE, []),
    courseCategories: await readJson(COURSE_CATEGORIES_FILE, []),
    products: await readJson(PRODUCTS_FILE, []),
    auditLogs: await readJson(AUDIT_LOGS_FILE, [])
  };
}

app.get('/api/admin/backup', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Seul l’administrateur principal peut exporter une sauvegarde complète.' });
  }
  const backup = await buildFullBackup();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="backup-electromen-${Date.now()}.json"`);
  res.json(backup);
}));

app.post('/api/admin/total-reset', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({
      success: false,
      error: 'Une session de l’administrateur principal est requise pour la remise à zéro totale.'
    });
  }

  // 1. Create safety backup before wipe
  const backup = await buildFullBackup();
  const backupName = `backup-pre-reset-${Date.now()}.json`;
  await saveApplicationBackup(backupName, backup);

  // 2. Wipe all business data
  await replaceUsersByRole('client', []);
  await replaceInvestors<ServerInvestorUser>([]);
  await writeJson(OPERATIONS_FILE, []);
  await writeJson(SUBSCRIPTIONS_FILE, []);
  await writeJson(ACTIVITIES_FILE, []);
  await writeJson(DOCUMENTS_FILE, []);
  await writeJson(GROUPS_FILE, {});
  await writeJson(COURSES_FILE, []);
  await writeJson(COURSE_CATEGORIES_FILE, []);
  await writeJson(PRODUCTS_FILE, []);
  await clearUserOtps();
  await writeJson(AUDIT_LOGS_FILE, [
    {
      id: `aud-reset-${Date.now()}`,
      author: 'Franck Kaboré (Super-Admin)',
      date: `${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}`,
      actionType: 'total_reset',
      description: `Remise à zéro totale effectuée par le Super-Administrateur. Sauvegarde préalable générée sous ${backupName}.`,
      entityType: 'system'
    }
  ]);

  console.log(`[ELECTRO-MEN SECURITY] REMISE À ZÉRO TOTALE EFFECTUÉE. Sauvegarde enregistrée : ${backupName}`);

  res.json({
    success: true,
    message: 'Remise à zéro totale effectuée avec succès. Toutes les données métier ont été effacées et l’application est revenue à l’état vierge.',
    backupName,
    backup
  });
}));

// =========================================================================
// 8. EXISTING SYSTEM & ADMIN CONFIG ROUTES
// =========================================================================

app.get('/api/admin/archives', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'view_audit');
  if (!admin) return;
  res.json({ archives: await listArchiveRecords() });
}));

app.post('/api/admin/archives/:id/restore', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'view_audit');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant d’archive invalide.' });
  const record = await findArchiveRecord(id);
  if (!record || record.payload === undefined) {
    return res.status(404).json({ success: false, error: 'Élément archivé introuvable.' });
  }
  const payload = record.payload;
  let restored = false;

  switch (record.entityType) {
    case 'operation': {
      if (!isRecordWithId(payload)) break;
      const operation = payload as InvestmentOperation;
      const subscriptions = await readJson<ShareSubscription[]>(SUBSCRIPTIONS_FILE, []);
      const committedShares = subscriptions
        .filter((subscription) => subscription.operationId === operation.id && subscription.status !== 'rejected')
        .reduce((total, subscription) => total + subscription.shares, 0);
      const totalShares = Math.max(operation.availableShares || 0, committedShares);
      if (!await restoreJsonItem(OPERATIONS_FILE, operation)) {
        return res.status(409).json({ success: false, error: 'Une opération portant déjà cet identifiant existe.' });
      }
      await initializeOperationInventory([{ operationId: operation.id, totalShares, committedShares }]);
      restored = true;
      break;
    }
    case 'offer': {
      if (!isRecordWithId(payload) || !record.parentId) break;
      const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
      const operation = operations.find((item) => item.id === record.parentId);
      if (!operation) return res.status(409).json({ success: false, error: 'Restaurez d’abord l’opération parente.' });
      if ((operation.offers || []).some((offer) => offer.id === payload.id)) {
        return res.status(409).json({ success: false, error: 'Une offre portant déjà cet identifiant existe.' });
      }
      operation.offers = [...(operation.offers || []), payload as InvestmentOffer];
      await writeJson(OPERATIONS_FILE, operations);
      restored = true;
      break;
    }
    case 'product':
      restored = isRecordWithId(payload) && await restoreJsonItem(PRODUCTS_FILE, payload);
      break;
    case 'course':
      restored = isRecordWithId(payload) && await restoreJsonItem(COURSES_FILE, payload);
      break;
    case 'course-category':
      restored = isRecordWithId(payload) && await restoreJsonItem(COURSE_CATEGORIES_FILE, payload, DEFAULT_COURSE_CATEGORIES);
      break;
    case 'activity':
      restored = isRecordWithId(payload) && await restoreJsonItem(ACTIVITIES_FILE, payload);
      break;
    case 'document':
      restored = isRecordWithId(payload) && await restoreJsonItem(DOCUMENTS_FILE, payload);
      break;
    case 'subscription': {
      if (!isRecordWithId(payload)) break;
      const subscription = payload as ShareSubscription;
      if (subscription.status !== 'rejected' && subscription.operationId) {
        if (!await reserveOperationShares(subscription.operationId, subscription.shares)) {
          return res.status(409).json({ success: false, error: 'Le quota de parts de cette opération est désormais insuffisant.' });
        }
      }
      restored = await restoreJsonItem(SUBSCRIPTIONS_FILE, subscription);
      if (!restored && subscription.status !== 'rejected' && subscription.operationId) {
        await releaseOperationShares(subscription.operationId, subscription.shares);
      }
      break;
    }
    case 'audit-log':
      restored = isRecordWithId(payload) && await restoreJsonItem(AUDIT_LOGS_FILE, payload);
      break;
    case 'audit-log-batch': {
      if (!Array.isArray(payload) || !payload.every(isRecordWithId)) break;
      const logs = await readJson<AuditAction[]>(AUDIT_LOGS_FILE, []);
      const existingIds = new Set(logs.map((log) => log.id));
      if (payload.some((log) => existingIds.has(log.id))) {
        return res.status(409).json({ success: false, error: 'Certaines entrées du lot existent déjà.' });
      }
      await writeJson(AUDIT_LOGS_FILE, [...payload as AuditAction[], ...logs]);
      restored = true;
      break;
    }
    case 'investor':
      if (typeof payload === 'object' && payload !== null && (payload as StoredUser).role === 'investor') {
        await createInvestor(payload as ServerInvestorUser);
        broadcastDataChanged('investors');
        restored = true;
      }
      break;
    case 'admin-user':
      if (
        typeof payload === 'object' &&
        payload !== null &&
        ['admin_principal', 'admin_secondaire'].includes((payload as StoredUser).role)
      ) {
        await createUser(payload as ServerAdminUser);
        broadcastDataChanged('admins');
        restored = true;
      }
      break;
    default:
      return res.status(400).json({ success: false, error: 'Ce type d’élément ne peut pas être restauré.' });
  }

  if (!restored) {
    return res.status(500).json({ success: false, error: 'La restauration a échoué. L’archive a été conservée.' });
  }
  await deleteArchiveRecord(record.id);
  broadcastDataChanged('archives');
  return res.json({ success: true, message: `${record.label} restauré avec succès.` });
}));

app.get('/api/health', asyncRoute(async (_req: Request, res: Response) => {
  applyNoCacheHeaders(res);
  await checkUserStoreConnection();
  const products = await readJson<unknown[]>(PRODUCTS_FILE, []);
  const admins = await listAdmins<ServerAdminUser>();
  res.json({
    success: true,
    storage: isMemoryStoreActive() ? 'memory' : 'postgresql',
    productsCount: Array.isArray(products) ? products.length : 0,
    hasPrincipalAdmin: admins.some((a) => a.role === 'admin_principal'),
    envStatus: {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL?.trim()),
      hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      hasSupabaseBucket: Boolean(process.env.SUPABASE_STORAGE_BUCKET?.trim()),
      hasInvestorCredentialKey: Boolean(process.env.INVESTOR_CREDENTIAL_KEY?.trim()),
      hasAdminInitialEmail: Boolean(process.env.ADMIN_INITIAL_EMAIL?.trim()),
      hasAdminInitialPassword: Boolean(process.env.ADMIN_INITIAL_PASSWORD?.trim()),
      hasAdminMasterPassword: Boolean(process.env.ADMIN_MASTER_PASSWORD?.trim())
    }
  });
}));

app.get('/api/admin/config', asyncRoute(async (_req: Request, res: Response) => {
  applyNoCacheHeaders(res);
  const config = await loadConfig();
  const security = await getAdminSecuritySettings();
  const admins = await listAdmins<ServerAdminUser>();
  const hasPrincipalAdmin = admins.some((admin) => admin.role === 'admin_principal');
  const hasEnvMaster = Boolean(process.env.ADMIN_MASTER_PASSWORD?.trim());
  const hasEnvInitial = Boolean(process.env.ADMIN_INITIAL_EMAIL?.trim() && process.env.ADMIN_INITIAL_PASSWORD?.trim());
  res.json({
    customAdminUrl: security?.customAdminUrl || config.customAdminUrl,
    heroVideoUrl: config.heroVideoUrl || '/assets/videos/electromen-hero.mp4',
    formationsVideoUrl: config.formationsVideoUrl || '/assets/videos/electromen-hero.mp4',
    isMaintenanceMode: Boolean(config.isMaintenanceMode),
    isInvestorChatOpen: config.isInvestorChatOpen !== false,
    hasMasterPassword: Boolean(security?.masterPasswordHash || hasEnvMaster),
    hasPrincipalAdmin,
    needsAdminSetup: !hasPrincipalAdmin && !security?.masterPasswordHash && !hasEnvMaster && !hasEnvInitial,
    secondaryAdminsCount: admins.filter((admin) => admin.role === 'admin_secondaire').length
  });
}));

app.post('/api/auth/setup-admin', authRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  applyNoCacheHeaders(res);
  const existingPrincipal = await findAdminByRole<ServerAdminUser>('admin_principal');
  const security = await getAdminSecuritySettings();
  const hasEnvMaster = Boolean(process.env.ADMIN_MASTER_PASSWORD?.trim());
  const hasEnvInitial = Boolean(process.env.ADMIN_INITIAL_EMAIL?.trim() && process.env.ADMIN_INITIAL_PASSWORD?.trim());

  if (existingPrincipal || security?.masterPasswordHash || hasEnvMaster || hasEnvInitial) {
    return res.status(403).json({
      success: false,
      error: 'La configuration initiale administrateur est déjà verrouillée. Connectez-vous avec vos identifiants.'
    });
  }

  const cleanEmail = validateEmailInput(req.body?.email);
  const rawPassword = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
  const cleanName = sanitizePlainText(req.body?.name, { minLength: 2, maxLength: 80 }) || 'Administrateur principal';
  const cleanPhone = typeof req.body?.phone === 'string' && req.body.phone.trim()
    ? (validatePhoneInput(req.body.phone) || '+22656283526')
    : (process.env.ADMIN_INITIAL_PHONE?.trim() || '+22656283526');

  if (!cleanEmail || rawPassword.length < 8 || rawPassword.length > 128) {
    return res.status(400).json({
      success: false,
      error: 'Veuillez saisir un email valide et un mot de passe administrateur de 8 à 128 caractères.'
    });
  }

  const { hash, salt } = hashPasswordSecure(rawPassword);
  const principalAdmin: ServerAdminUser = {
    id: crypto.randomUUID(),
    name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    role: 'admin_principal',
    permissions: [...ALL_ADMIN_PERMISSIONS],
    passwordHash: hash,
    passwordSalt: salt,
    passwordAlgorithm: 'pbkdf2-sha512',
    isProtected: true,
    addedDate: new Date().toLocaleDateString('fr-FR')
  };

  await createUser(principalAdmin);
  if (security && !security.masterPasswordHash) {
    const masterCreds = hashInvestorPassword(rawPassword);
    await updateAdminSecuritySettings({
      ...security,
      masterPasswordHash: masterCreds.hash,
      masterPasswordSalt: masterCreds.salt
    });
  }
  const customAdminUrl = security?.customAdminUrl || (await loadConfig()).customAdminUrl;
  const token = await establishUserSession(principalAdmin, req, res, ADMIN_SESSION_COOKIE, 24 * 60 * 60 * 1000);
  await addServerAuditLog(principalAdmin.name, 'setup_initial_admin', `Configuration initiale du compte administrateur principal (${cleanEmail}).`, 'system', principalAdmin.id);
  broadcastDataChanged('admins');
  broadcastDataChanged('config');

  return res.status(201).json({
    success: true,
    user: {
      id: principalAdmin.id,
      name: principalAdmin.name,
      email: principalAdmin.email,
      phone: principalAdmin.phone,
      role: principalAdmin.role,
      permissions: getAdminEffectivePermissions(principalAdmin)
    },
    token,
    customAdminUrl
  });
}));

app.post('/api/auth/login', authRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  applyNoCacheHeaders(res);
  const { email, password, masterPin } = req.body || {};
  const security = await getAdminSecuritySettings();
  const customAdminUrl = security?.customAdminUrl || (await loadConfig()).customAdminUrl;
  const ipKey = `admin-ip:${getClientIp(req)}`;
  const ipRateLimit = checkRateLimit(ipKey);
  if (!ipRateLimit.allowed) {
    res.setHeader('Retry-After', String(ipRateLimit.remainingSeconds ?? 60));
    return res.status(429).json({
      success: false,
      error: `Trop de tentatives de connexion administrateur. Réessayez dans ${ipRateLimit.remainingSeconds} secondes.`
    });
  }

  const ensurePrincipalAdmin = async (seedPassword: string): Promise<ServerAdminUser> => {
    const existingPrincipal = await findAdminByRole<ServerAdminUser>('admin_principal');
    if (existingPrincipal) return existingPrincipal;
    const fallbackEmail = process.env.ADMIN_INITIAL_EMAIL?.trim().toLowerCase() || 'admin@electromen.bf';
    const existingByEmail = await findUserByEmail<ServerAdminUser>(fallbackEmail);
    if (existingByEmail && (existingByEmail.role === 'admin_principal' || existingByEmail.role === 'admin_secondaire')) {
      return existingByEmail;
    }
    const { hash, salt } = hashPasswordSecure(seedPassword);
    const created: ServerAdminUser = {
      id: crypto.randomUUID(),
      name: process.env.ADMIN_INITIAL_NAME?.trim() || 'Administrateur principal',
      email: fallbackEmail,
      phone: process.env.ADMIN_INITIAL_PHONE?.trim() || '+22656283526',
      role: 'admin_principal',
      permissions: [...ALL_ADMIN_PERMISSIONS],
      passwordHash: hash,
      passwordSalt: salt,
      passwordAlgorithm: 'pbkdf2-sha512',
      isProtected: true,
      addedDate: new Date().toLocaleDateString('fr-FR')
    };
    await createUser(created);
    return created;
  };

  if (masterPin !== undefined) {
    if (typeof masterPin !== 'string' || !masterPin.trim() || masterPin.length > 128) {
      recordFailedAttempt(ipKey);
      return res.status(400).json({ success: false, error: 'Format du code secret invalide.' });
    }
    const validDbPin = Boolean(security && verifyMasterCode(masterPin, security));
    const validEnvPin = verifyEnvSecretMatch(masterPin, process.env.ADMIN_MASTER_PASSWORD);

    if (validDbPin || validEnvPin) {
      const principal = await ensurePrincipalAdmin(masterPin.trim());
      recordSuccessfulAttempt(ipKey);
      const token = await establishUserSession(principal, req, res, ADMIN_SESSION_COOKIE, 24 * 60 * 60 * 1000);
      return res.json({
        success: true,
        user: {
          id: principal.id,
          name: principal.name,
          email: principal.email,
          role: principal.role,
          permissions: getAdminEffectivePermissions(principal)
        },
        token,
        customAdminUrl
      });
    }

    recordFailedAttempt(ipKey);
    return res.status(401).json({
      success: false,
      error: 'Code secret Super-Administrateur incorrect.'
    });
  }

  if (email !== undefined || password !== undefined) {
    const cleanEmail = validateEmailInput(email);
    if (!cleanEmail || typeof password !== 'string' || !password.trim() || password.length > 128) {
      recordFailedAttempt(ipKey);
      return res.status(400).json({ success: false, error: 'Adresse e-mail et mot de passe valides requis.' });
    }
    const emailAttemptKey = `admin:${cleanEmail}`;
    const emailRateLimit = checkRateLimit(emailAttemptKey);
    if (!emailRateLimit.allowed) {
      res.setHeader('Retry-After', String(emailRateLimit.remainingSeconds ?? 60));
      return res.status(429).json({
        success: false,
        error: `Compte administrateur temporairement verrouillé. Réessayez dans ${emailRateLimit.remainingSeconds} secondes.`
      });
    }

    const cleanPass = password.trim();
    const envInitialEmail = process.env.ADMIN_INITIAL_EMAIL?.trim().toLowerCase();
    const matchesEnvInitial = Boolean(
      envInitialEmail &&
      cleanEmail === envInitialEmail &&
      verifyEnvSecretMatch(cleanPass, process.env.ADMIN_INITIAL_PASSWORD)
    );
    const matchesEnvMasterWithInitialEmail = Boolean(
      envInitialEmail &&
      cleanEmail === envInitialEmail &&
      verifyEnvSecretMatch(cleanPass, process.env.ADMIN_MASTER_PASSWORD)
    );
    let admin = await findUserByEmail<ServerAdminUser>(cleanEmail);

    if (!admin && (matchesEnvInitial || matchesEnvMasterWithInitialEmail)) {
      admin = await ensurePrincipalAdmin(cleanPass);
    }

    if (admin && (admin.role === 'admin_principal' || admin.role === 'admin_secondaire')) {
      const storedMatch = admin.passwordAlgorithm === 'pbkdf2-sha512' && admin.passwordSalt
        ? verifyPasswordSecure(cleanPass, admin.passwordHash, admin.passwordSalt)
        : admin.passwordHash === legacyHash(cleanPass) || cleanPass === admin.assignedPasswordPlainText;
      const principalMasterMatch = admin.role === 'admin_principal' && (
        Boolean(security && verifyMasterCode(cleanPass, security)) ||
        verifyEnvSecretMatch(cleanPass, process.env.ADMIN_MASTER_PASSWORD)
      );
      const isMatch = storedMatch || matchesEnvInitial || principalMasterMatch;

      if (isMatch) {
        recordSuccessfulAttempt(ipKey);
        recordSuccessfulAttempt(emailAttemptKey);
        if (matchesEnvInitial || admin.assignedPasswordPlainText || !admin.passwordSalt || admin.passwordAlgorithm !== 'pbkdf2-sha512') {
          const { assignedPasswordPlainText: _legacyPassword, ...withoutLegacyPassword } = admin;
          admin = {
            ...withoutLegacyPassword,
            ...hashPasswordSecure(cleanPass),
            passwordAlgorithm: 'pbkdf2-sha512'
          };
          await updateUser(admin.id, admin);
        }
        const token = await establishUserSession(admin, req, res, ADMIN_SESSION_COOKIE, 24 * 60 * 60 * 1000);

        return res.json({
          success: true,
          user: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            phone: admin.phone,
            role: admin.role,
            permissions: getAdminEffectivePermissions(admin)
          },
          token,
          customAdminUrl
        });
      }
    }

    recordFailedAttempt(ipKey);
    recordFailedAttempt(emailAttemptKey);
    return res.status(401).json({
      success: false,
      error: 'Adresse email ou mot de passe incorrect.'
    });
  }

  return res.status(400).json({
    success: false,
    error: 'Veuillez renseigner votre email et mot de passe, ou le code maître.'
  });
}));

app.post('/api/auth/logout', asyncRoute(async (req: Request, res: Response) => {
  const token = getAdminSessionToken(req);
  if (token) await deleteInvestorSession(crypto.createHash('sha256').update(token).digest('hex'));
  clearHttpOnlySessionCookie(req, res, ADMIN_SESSION_COOKIE);
  return res.json({ success: true });
}));

app.post('/api/auth/verify', asyncRoute(async (req: Request, res: Response) => {
  applyNoCacheHeaders(res);
  const token = typeof req.body?.token === 'string' ? req.body.token : getAdminSessionToken(req);
  if (!token) return res.json({ valid: false });
  const user = await findUserBySession<ServerAdminUser>(crypto.createHash('sha256').update(token).digest('hex'));
  if (user && (user.role === 'admin_principal' || user.role === 'admin_secondaire')) {
    return res.json({
      valid: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: getAdminEffectivePermissions(user)
      },
      customAdminUrl: (await getAdminSecuritySettings())?.customAdminUrl || (await loadConfig()).customAdminUrl
    });
  }

  return res.json({ valid: false });
}));

app.get('/api/admin/users', asyncRoute(async (req: Request, res: Response) => {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return res.status(401).json({ success: false, error: 'Authentification administrateur requise.' });
  const admins = await listAdmins<ServerAdminUser>();
  const sanitized = admins.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    role: a.role,
    permissions: getAdminEffectivePermissions(a),
    isProtected: a.isProtected,
    addedDate: a.addedDate
  }));

  res.json(sanitized);
}));

app.post('/api/admin/users', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Seul l’administrateur principal peut gérer les comptes administrateurs.' });
  }
  const actor = await getAuthenticatedAdmin(req);
  const { email, name, phone, role, password, permissions } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Email invalide.' });
  }
  if (role !== 'admin_secondaire') {
    return res.status(400).json({ success: false, error: 'Seul un rôle administrateur secondaire peut être attribué ici.' });
  }
  if (typeof password !== 'string' || password.trim().length < 8 || password.trim().length > 128) {
    return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter entre 8 et 128 caractères.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (await findUserByEmail<StoredUser>(cleanEmail)) {
    return res.status(409).json({ success: false, error: 'Un compte existe déjà avec cette adresse e-mail.' });
  }
  const resolvedPermissions = permissions !== undefined
    ? (sanitizeAdminPermissions(permissions) ?? [])
    : [];
  const { hash, salt } = hashPasswordSecure(password);
  const assignedName = name ? name.trim() : cleanEmail.split('@')[0];
  const newAdmin: ServerAdminUser = {
    id: crypto.randomUUID(),
    name: assignedName,
    email: cleanEmail,
    phone: typeof phone === 'string' ? phone.trim() : '',
    role,
    permissions: resolvedPermissions,
    passwordHash: hash,
    passwordSalt: salt,
    passwordAlgorithm: 'pbkdf2-sha512',
    isProtected: false,
    addedDate: new Date().toLocaleDateString('fr-FR')
  };
  await createUser(newAdmin);
  await addServerAuditLog(actor?.name || 'Admin Principal', 'create_secondary_admin', `Création administrateur secondaire ${cleanEmail} (${resolvedPermissions.length} droit(s))`, 'system', newAdmin.id);
  broadcastDataChanged('admins');
  return res.status(201).json({
    success: true,
    message: `Administrateur ${cleanEmail} autorisé avec succès.`,
    admin: {
      id: newAdmin.id,
      name: newAdmin.name,
      email: newAdmin.email,
      phone: newAdmin.phone,
      role: newAdmin.role,
      permissions: resolvedPermissions,
      isProtected: false,
      addedDate: newAdmin.addedDate
    }
  });
}));

app.patch('/api/admin/users/:id/permissions', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Seul l’administrateur principal peut attribuer ou retirer des droits.' });
  }
  const actor = await getAuthenticatedAdmin(req);
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const target = await findUserById<ServerAdminUser>(id);
  if (!target || target.role !== 'admin_secondaire') {
    return res.status(404).json({ success: false, error: 'Administrateur secondaire introuvable.' });
  }
  const sanitized = sanitizeAdminPermissions(req.body?.permissions);
  if (sanitized === undefined) {
    return res.status(400).json({ success: false, error: 'Liste des permissions invalide (tableau attendu).' });
  }
  await updateUser(id, {
    ...target,
    permissions: sanitized
  });
  await addServerAuditLog(
    actor?.name || 'Admin Principal',
    'update_admin_permissions',
    `Droits de ${target.email} mis à jour (${sanitized.length} permission(s) active(s)).`,
    'system',
    id
  );
  broadcastDataChanged('admins');
  return res.json({ success: true, permissions: sanitized });
}));

app.patch('/api/admin/users/:id/password', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Seul l’administrateur principal peut modifier un mot de passe administrateur.' });
  }
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const { password } = req.body || {};
  if (typeof password !== 'string' || password.trim().length < 8 || password.trim().length > 128) {
    return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter entre 8 et 128 caractères.' });
  }
  const target = await findUserById<ServerAdminUser>(id);
  if (!target || target.role !== 'admin_secondaire') {
    return res.status(404).json({ success: false, error: 'Administrateur secondaire introuvable.' });
  }
  const { hash, salt } = hashPasswordSecure(password);
  const { assignedPasswordPlainText: _legacyPassword, ...withoutLegacyPassword } = target;
  await updateUser(id, {
    ...withoutLegacyPassword,
    passwordHash: hash,
    passwordSalt: salt,
    passwordAlgorithm: 'pbkdf2-sha512'
  });
  broadcastDataChanged('admins');
  return res.json({ success: true });
}));

app.delete('/api/admin/users/:id', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Seul l’administrateur principal peut supprimer un compte administrateur.' });
  }
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const target = await findUserById<ServerAdminUser>(id);
  if (!target) return res.status(404).json({ success: false, error: 'Administrateur introuvable.' });
  if (target.isProtected) return res.status(403).json({ success: false, error: 'Impossible de supprimer le compte propriétaire protégé.' });

  const archiveId = await archiveItem('admin-user', target.id, target.name, target);
  await deleteUser(id);
  broadcastDataChanged('admins');
  res.json({ success: true, message: `Administrateur ${target.name} déplacé dans la corbeille.`, archiveId });
}));

app.post('/api/admin/change-master-password', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Une session Super-Administrateur est requise.' });
  }
  const { newPassword } = req.body || {};
  const cleanNewPassword = typeof newPassword === 'string' ? newPassword.trim() : '';
  if (cleanNewPassword.length < 8 || cleanNewPassword.length > 128) {
    return res.status(400).json({ success: false, error: 'Le code maître doit comporter entre 8 et 128 caractères.' });
  }
  const current = await getAdminSecuritySettings();
  if (!current) return res.status(500).json({ success: false, error: 'Configuration de sécurité introuvable.' });
  const { hash, salt } = hashInvestorPassword(cleanNewPassword);
  await updateAdminSecuritySettings({ ...current, masterPasswordHash: hash, masterPasswordSalt: salt });
  broadcastDataChanged('config');
  return res.json({ success: true, message: 'Le code maître a été modifié.' });
}));

app.post('/api/admin/change-url', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Une session Super-Administrateur est requise.' });
  }
  const { newUrl } = req.body || {};
  if (typeof newUrl !== 'string') return res.status(400).json({ success: false, error: 'URL invalide.' });

  let formatted = newUrl.trim();
  if (!formatted.startsWith('/')) formatted = `/${formatted}`;
  if (!/^\/[a-zA-Z0-9][a-zA-Z0-9/_-]{2,63}$/.test(formatted) || formatted.includes('//') || formatted.split('/').includes('..')) {
    return res.status(400).json({ success: false, error: 'Utilisez un chemin simple de 3 à 64 caractères (lettres, chiffres, tirets ou barres obliques).' });
  }
  if (formatted === '/api' || formatted.startsWith('/api/')) {
    return res.status(400).json({ success: false, error: 'Ce chemin est réservé aux routes de l’API.' });
  }

  const current = await getAdminSecuritySettings();
  if (!current) return res.status(500).json({ success: false, error: 'Configuration de sécurité introuvable.' });
  const previousAdminUrls = formatted === current.customAdminUrl
    ? current.previousAdminUrls
    : Array.from(new Set([...current.previousAdminUrls, current.customAdminUrl])).filter((url) => url !== formatted);
  const updated = { ...current, customAdminUrl: formatted, previousAdminUrls };
  await updateAdminSecuritySettings(updated);
  broadcastDataChanged('config');
  res.json({ success: true, customAdminUrl: formatted });
}));

app.post('/api/admin/hero-video', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_content');
  if (!admin) return;
  const cleanUrl = validateSafeUrlOrPath(req.body?.videoUrl, 2048);
  if (!cleanUrl) return res.status(400).json({ success: false, error: 'URL vidéo invalide.' });

  const config = await loadConfig();
  config.heroVideoUrl = cleanUrl;
  await saveConfig(config);
  res.json({ success: true, heroVideoUrl: config.heroVideoUrl });
}));

app.post('/api/admin/formations-video', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_content');
  if (!admin) return;
  const cleanUrl = validateSafeUrlOrPath(req.body?.videoUrl, 2048);
  if (!cleanUrl) return res.status(400).json({ success: false, error: 'URL vidéo invalide.' });

  const config = await loadConfig();
  config.formationsVideoUrl = cleanUrl;
  await saveConfig(config);
  res.json({ success: true, formationsVideoUrl: config.formationsVideoUrl });
}));

app.post('/api/admin/maintenance', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Seul l’administrateur principal peut modifier le mode maintenance.' });
  }
  const { isMaintenanceMode } = req.body;
  const config = await loadConfig();
  config.isMaintenanceMode = Boolean(isMaintenanceMode);
  await saveConfig(config);
  res.json({ success: true, isMaintenanceMode: config.isMaintenanceMode });
}));

app.post('/api/upload', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminAnyPermission(req, res, ['manage_products', 'manage_courses', 'manage_content']);
  if (!admin) return;

  const { fileBase64, mimeType } = req.body || {};
  let parsedUpload;
  try {
    parsedUpload = parseBase64MediaUpload(fileBase64, mimeType);
  } catch (err) {
    if (err instanceof InvalidMediaUploadError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    throw err;
  }

  let storage = null;
  try {
    storage = getSupabaseStorage();
  } catch (error) {
    if (error instanceof MediaStorageConfigurationError) {
      return res.status(503).json({ success: false, error: error.message });
    }
    throw error;
  }

  const filename = `media-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${parsedUpload.extension}`;
  if (!storage) {
    if (process.env.VERCEL) {
      return res.status(503).json({
        success: false,
        error: 'Stockage média Supabase requis en environnement serverless (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).'
      });
    }
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
    const destination = path.resolve(UPLOADS_DIR, filename);
    if (!destination.startsWith(UPLOADS_DIR + path.sep)) {
      return res.status(400).json({ success: false, error: 'Chemin de fichier média invalide.' });
    }
    await fs.promises.writeFile(destination, parsedUpload.buffer);
    return res.json({
      success: true,
      url: `/uploads/${filename}`,
      size: parsedUpload.buffer.length,
      filename,
      storage: 'local'
    });
  }

  const folder = parsedUpload.contentType.startsWith('video/') ? 'videos' : 'uploads';
  const objectKey = createMediaObjectKey(folder, filename);
  const { error } = await storage.client.storage.from(storage.bucket).upload(objectKey, parsedUpload.buffer, {
    cacheControl: '3600',
    contentType: parsedUpload.contentType,
    upsert: false
  });
  if (error) {
    console.error('Supabase media upload failed:', error.message);
    return res.status(502).json({ success: false, error: 'Échec de l’envoi du fichier vers Supabase Storage.' });
  }

  const { data } = storage.client.storage.from(storage.bucket).getPublicUrl(objectKey);
  return res.json({
    success: true,
    url: data.publicUrl,
    size: parsedUpload.buffer.length,
    filename,
    storage: 'supabase'
  });
}));

app.post('/api/upload/signed-url', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminAnyPermission(req, res, ['manage_products', 'manage_courses', 'manage_content']);
  if (!admin) return;

  const { mimeType } = req.body || {};
  let uploadSpec;
  try {
    uploadSpec = resolveAllowedMediaUpload(mimeType);
  } catch (err) {
    if (err instanceof InvalidMediaUploadError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    throw err;
  }

  let storage = null;
  try {
    storage = getSupabaseStorage();
  } catch (error) {
    if (error instanceof MediaStorageConfigurationError) {
      return res.status(503).json({ success: false, error: error.message });
    }
    throw error;
  }
  if (!storage) {
    return res.status(503).json({
      success: false,
      error: 'Supabase Storage non configuré pour le téléversement direct.'
    });
  }

  const filename = `media-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${uploadSpec.extension}`;
  const folder = uploadSpec.contentType.startsWith('video/') ? 'videos' : 'uploads';
  const objectKey = createMediaObjectKey(folder, filename);
  const { data, error } = await storage.client.storage.from(storage.bucket).createSignedUploadUrl(objectKey);
  if (error || !data?.signedUrl) {
    console.error('Supabase signed upload URL failed:', error?.message);
    return res.status(502).json({ success: false, error: 'Impossible de préparer le téléversement vers Supabase Storage.' });
  }
  const { data: publicUrlData } = storage.client.storage.from(storage.bucket).getPublicUrl(objectKey);
  return res.json({
    success: true,
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl: publicUrlData.publicUrl,
    contentType: uploadSpec.contentType,
    filename,
    storage: 'supabase'
  });
}));

// =========================================================================
// INVESTOR & ADMIN MESSAGING + WHATSAPP-STYLE VOICE NOTES
// =========================================================================

app.get('/api/messages', asyncRoute(async (req: Request, res: Response) => {
  const [admin, investor, config] = await Promise.all([
    getAuthenticatedAdmin(req),
    getAuthenticatedInvestor(req),
    loadConfig()
  ]);
  if (!admin && !investor) {
    return res.status(401).json({ success: false, error: 'Connexion requise pour consulter la messagerie.' });
  }
  const messages = await readJson<ServerInvestorMessage[]>(MESSAGES_FILE, []);
  return res.json({
    success: true,
    messages,
    isInvestorChatOpen: config.isInvestorChatOpen !== false
  });
}));

app.post('/api/messages/voice', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  const [admin, investor, config] = await Promise.all([
    getAuthenticatedAdmin(req),
    getAuthenticatedInvestor(req),
    loadConfig()
  ]);
  if (!admin && !investor) {
    return res.status(401).json({ success: false, error: 'Connexion requise pour envoyer un message vocal.' });
  }
  if (admin && !hasAdminPermission(admin, 'manage_content') && !investor) {
    return res.status(403).json({ success: false, error: 'Droit Messagerie requis pour envoyer un message vocal administrateur.' });
  }
  if (!admin && investor) {
    if (investor.status === 'bloque' || investor.status === 'suspendu') {
      return res.status(403).json({ success: false, error: 'Votre compte est suspendu.' });
    }
    if (config.isInvestorChatOpen === false) {
      return res.status(403).json({ success: false, error: 'La messagerie des investisseurs est actuellement suspendue par l’administrateur.' });
    }
  }

  const { fileBase64, mimeType } = req.body || {};
  let parsedVoice;
  try {
    parsedVoice = parseBase64VoiceUpload(fileBase64, mimeType);
  } catch (err) {
    if (err instanceof InvalidMediaUploadError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    throw err;
  }

  let storage = null;
  try {
    storage = getSupabaseStorage();
  } catch (error) {
    if (error instanceof MediaStorageConfigurationError) {
      return res.status(503).json({ success: false, error: error.message });
    }
    throw error;
  }

  const filename = `voice-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${parsedVoice.extension}`;
  if (!storage) {
    if (process.env.VERCEL) {
      return res.status(503).json({
        success: false,
        error: 'Stockage audio Supabase requis en environnement serverless (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).'
      });
    }
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
    const destination = path.resolve(UPLOADS_DIR, filename);
    if (!destination.startsWith(UPLOADS_DIR + path.sep)) {
      return res.status(400).json({ success: false, error: 'Chemin de fichier audio invalide.' });
    }
    await fs.promises.writeFile(destination, parsedVoice.buffer);
    return res.json({
      success: true,
      url: `/uploads/${filename}`,
      size: parsedVoice.buffer.length,
      filename
    });
  }

  const objectKey = createMediaObjectKey('voice', filename);
  const { error } = await storage.client.storage.from(storage.bucket).upload(objectKey, parsedVoice.buffer, {
    cacheControl: '3600',
    contentType: parsedVoice.contentType,
    upsert: false
  });
  if (error) {
    console.error('Supabase voice upload failed:', error.message);
    return res.status(502).json({ success: false, error: 'Échec de l’envoi du message vocal vers Supabase Storage.' });
  }
  const { data } = storage.client.storage.from(storage.bucket).getPublicUrl(objectKey);
  return res.json({
    success: true,
    url: data.publicUrl,
    size: parsedVoice.buffer.length,
    filename
  });
}));

app.post('/api/messages', asyncRoute(async (req: Request, res: Response) => {
  const [admin, investor, config] = await Promise.all([
    getAuthenticatedAdmin(req),
    getAuthenticatedInvestor(req),
    loadConfig()
  ]);
  if (!admin && !investor) {
    return res.status(401).json({ success: false, error: 'Connexion requise pour publier un message.' });
  }
  if (admin && !hasAdminPermission(admin, 'manage_content') && !investor) {
    return res.status(403).json({ success: false, error: 'Droit Messagerie requis pour publier en tant qu’administrateur.' });
  }
  if (!admin && investor) {
    if (investor.status === 'bloque' || investor.status === 'suspendu') {
      return res.status(403).json({ success: false, error: 'Votre compte est suspendu.' });
    }
    if (config.isInvestorChatOpen === false) {
      return res.status(403).json({ success: false, error: 'La messagerie des investisseurs est actuellement suspendue par l’administrateur.' });
    }
  }

  const { text, audioUrl, audioDuration, messageType } = req.body || {};
  const isVoice = messageType === 'voice' || Boolean(audioUrl);
  let cleanAudioUrl: string | undefined;
  let cleanDuration: number | undefined;
  let cleanText = '';

  if (isVoice) {
    const validatedAudioUrl = validateSafeUrlOrPath(audioUrl, 2048);
    if (!validatedAudioUrl) {
      return res.status(400).json({ success: false, error: 'Lien audio vocal invalide.' });
    }
    cleanAudioUrl = validatedAudioUrl;
    if (audioDuration !== undefined) {
      const parsedDur = validateSafeNonNegativeInt(audioDuration, { max: 600 });
      if (parsedDur !== null) cleanDuration = parsedDur;
    }
    cleanText = sanitizePlainText(text, { maxLength: 300 }) || 'Message vocal';
  } else {
    const validatedText = sanitizePlainText(text, { minLength: 1, maxLength: 1500, required: true, allowNewlines: true });
    if (!validatedText) {
      return res.status(400).json({ success: false, error: 'Veuillez saisir un message valide (1 500 caractères max).' });
    }
    cleanText = validatedText;
  }

  const now = new Date();
  const senderIsAdmin = Boolean(
    admin && hasAdminPermission(admin, 'manage_content') && !(req.body?.senderRole === 'investor' && investor)
  );
  const msg: ServerInvestorMessage = {
    id: `msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    senderId: senderIsAdmin ? admin!.id : investor!.id,
    senderName: senderIsAdmin
      ? `${admin!.name} (${admin!.role === 'admin_principal' ? 'Super-Admin' : 'Admin'})`
      : investor!.name,
    senderEmail: senderIsAdmin ? admin!.email : investor!.email,
    senderRole: senderIsAdmin ? 'admin' : 'investor',
    messageType: isVoice ? 'voice' : 'text',
    text: cleanText,
    ...(cleanAudioUrl ? { audioUrl: cleanAudioUrl } : {}),
    ...(cleanDuration !== undefined ? { audioDuration: cleanDuration } : {}),
    time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    createdAt: now.toISOString()
  };

  const messages = await readJson<ServerInvestorMessage[]>(MESSAGES_FILE, []);
  messages.push(msg);
  await writeJson(MESSAGES_FILE, messages);
  broadcastDataChanged('messages');

  return res.status(201).json({ success: true, message: msg });
}));

app.patch('/api/admin/messages/status', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_content');
  if (!admin) return;
  const isInvestorChatOpen = Boolean(req.body?.isInvestorChatOpen);
  const config = await loadConfig();
  config.isInvestorChatOpen = isInvestorChatOpen;
  await saveConfig(config);
  await addServerAuditLog(
    admin.name,
    'toggle_investor_chat',
    `Messagerie investisseurs ${isInvestorChatOpen ? 'activée' : 'suspendue'}`,
    'system'
  );
  broadcastDataChanged('messages');
  return res.json({ success: true, isInvestorChatOpen });
}));

app.delete('/api/admin/messages/:id', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_content');
  if (!admin) return;
  const id = validateSafeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
  const messages = await readJson<ServerInvestorMessage[]>(MESSAGES_FILE, []);
  if (!messages.some((m) => m.id === id)) {
    return res.status(404).json({ success: false, error: 'Message introuvable.' });
  }
  await writeJson(MESSAGES_FILE, messages.filter((m) => m.id !== id));
  await addServerAuditLog(admin.name, 'delete_message', `Suppression du message ${id}`, 'system', id);
  broadcastDataChanged('messages');
  return res.json({ success: true });
}));

app.delete('/api/admin/messages', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'manage_content');
  if (!admin) return;
  await writeJson(MESSAGES_FILE, []);
  await addServerAuditLog(admin.name, 'clear_messages', 'Suppression de tout le fil de discussion investisseurs', 'system');
  broadcastDataChanged('messages');
  return res.json({ success: true });
}));

// Dedicated streaming route for videos with HTTP Range support
app.get('/assets/videos/:filename', asyncRoute(async (req: Request, res: Response) => {
  let storage;
  try {
    storage = getSupabaseStorage();
  } catch (error) {
    if (error instanceof MediaStorageConfigurationError) {
      return res.status(503).json({ error: error.message });
    }
    throw error;
  }
  if (storage) {
    const objectKey = createMediaObjectKey('videos', req.params.filename);
    const { data } = storage.client.storage.from(storage.bucket).getPublicUrl(objectKey);
    return res.redirect(302, data.publicUrl);
  }

  const filename = path.basename(req.params.filename);
  const publicVideo = path.resolve('public/assets/videos', filename);
  const distVideo = path.resolve('dist/assets/videos', filename);
  const target = fs.existsSync(publicVideo) ? publicVideo : fs.existsSync(distVideo) ? distVideo : null;
  if (target) {
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    return res.sendFile(target);
  }
  return res.status(404).json({ error: 'Fichier vidéo introuvable.' });
}));




// =========================================================================
// REAL-TIME USER PRESENCE TRACKING & STREAMING (ACTIVE SESSIONS)
// =========================================================================

export interface ActiveUserSession {
  sessionId: string;
  userId?: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  userRole: 'admin' | 'investor' | 'client' | 'visitor';
  investorStatus?: string;
  currentTab: string;
  pageTitle: string;
  ip: string;
  deviceType: 'Mobile' | 'Tablette' | 'Ordinateur';
  browser: string;
  connectedAt: number;
  lastSeen: number;
}

const activeSessions = new Map<string, ActiveUserSession>();
const sseClients = new Set<Response>();

function cleanStaleSessions(): boolean {
  const now = Date.now();
  let changed = false;
  for (const [sid, session] of activeSessions.entries()) {
    if (now - session.lastSeen > 35000) {
      activeSessions.delete(sid);
      changed = true;
    }
  }
  return changed;
}

if (!process.env.VERCEL) {
  const presenceTimer = setInterval(() => {
    if (cleanStaleSessions()) {
      broadcastPresenceUpdate();
    }
  }, 5000);
  presenceTimer.unref?.();
}

function getPresenceSnapshot() {
  const now = Date.now();
  cleanStaleSessions();
  const sessions = Array.from(activeSessions.values())
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .map((s) => ({
      ...s,
      secondsAgo: Math.max(0, Math.round((now - s.lastSeen) / 1000)),
      durationMinutes: Math.max(1, Math.round((now - s.connectedAt) / 60000))
    }));

  const breakdown = {
    total: sessions.length,
    admins: sessions.filter((s) => s.userRole === 'admin').length,
    investors: sessions.filter((s) => s.userRole === 'investor').length,
    clients: sessions.filter((s) => s.userRole === 'client').length,
    visitors: sessions.filter((s) => s.userRole === 'visitor').length
  };

  return { sessions, breakdown, timestamp: now };
}

function broadcastPresenceUpdate() {
  if (sseClients.size === 0) return;
  const payload = `data: ${JSON.stringify(getPresenceSnapshot())}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function parseDeviceFromUserAgent(ua?: string): { deviceType: 'Mobile' | 'Tablette' | 'Ordinateur'; browser: string } {
  if (!ua) return { deviceType: 'Ordinateur', browser: 'Navigateur Web' };
  const lower = ua.toLowerCase();
  let deviceType: 'Mobile' | 'Tablette' | 'Ordinateur' = 'Ordinateur';
  if (/ipad|tablet|(android(?!.*mobile))/i.test(lower)) {
    deviceType = 'Tablette';
  } else if (/iphone|android.*mobile|mobile|blackberry|phone/i.test(lower)) {
    deviceType = 'Mobile';
  }

  let browser = 'Navigateur Web';
  if (lower.includes('chrome') && !lower.includes('edg')) browser = 'Google Chrome';
  else if (lower.includes('safari') && !lower.includes('chrome')) browser = 'Safari';
  else if (lower.includes('firefox')) browser = 'Firefox';
  else if (lower.includes('edg')) browser = 'Microsoft Edge';
  else if (lower.includes('opera') || lower.includes('opr')) browser = 'Opera';

  return { deviceType, browser };
}

// Endpoint: Heartbeat ping from clients
app.post('/api/presence/heartbeat', heartbeatRateLimiter, (req: Request, res: Response) => {
  const { sessionId, userId, userName, userEmail, userPhone, userRole, investorStatus, currentTab, pageTitle } = req.body || {};
  const cleanSessionId = validateSafeId(sessionId, 80);
  if (!cleanSessionId) {
    return res.status(400).json({ success: false, error: 'Session ID valide requis' });
  }

  const clientIp = getClientIp(req);
  const ua = req.headers['user-agent'] || '';
  const { deviceType, browser } = parseDeviceFromUserAgent(ua);
  const now = Date.now();

  const existing = activeSessions.get(cleanSessionId);
  const connectedAt = existing ? existing.connectedAt : now;

  const allowedRoles = new Set(['admin', 'investor', 'client', 'visitor']);
  const cleanRole = typeof userRole === 'string' && allowedRoles.has(userRole)
    ? (userRole as ActiveUserSession['userRole'])
    : (existing?.userRole || 'visitor');

  const session: ActiveUserSession = {
    sessionId: cleanSessionId,
    userId: (typeof userId === 'string' && validateSafeId(userId)) || existing?.userId,
    userName: sanitizePlainText(userName, { maxLength: 100 }) || existing?.userName || 'Visiteur En Ligne',
    userEmail: (userEmail !== undefined ? validateEmailInput(userEmail) : undefined) || existing?.userEmail,
    userPhone: (userPhone !== undefined ? validatePhoneInput(userPhone) : undefined) || existing?.userPhone,
    userRole: cleanRole,
    investorStatus: sanitizePlainText(investorStatus, { maxLength: 40 }) || existing?.investorStatus,
    currentTab: sanitizePlainText(currentTab, { maxLength: 50 }) || existing?.currentTab || 'accueil',
    pageTitle: sanitizePlainText(pageTitle, { maxLength: 150 }) || existing?.pageTitle || 'Portail ELECTRO-MEN',
    ip: clientIp,
    deviceType,
    browser,
    connectedAt,
    lastSeen: now
  };

  activeSessions.set(cleanSessionId, session);
  broadcastPresenceUpdate();

  res.json({
    success: true,
    activeCount: activeSessions.size
  });
});

// Endpoint: Explicit leave
app.post('/api/presence/leave', (req: Request, res: Response) => {
  const cleanSessionId = validateSafeId(req.body?.sessionId, 80);
  if (cleanSessionId && activeSessions.has(cleanSessionId)) {
    activeSessions.delete(cleanSessionId);
    broadcastPresenceUpdate();
  }
  res.json({ success: true });
});

// Endpoint: Get online users snapshot (Admin with view_realtime)
app.get('/api/presence/online-users', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'view_realtime');
  if (!admin) return;
  res.json(getPresenceSnapshot());
}));

// Endpoint: Server-Sent Events stream for instant real-time updates (Admin with view_realtime)
app.get('/api/presence/stream', asyncRoute(async (req: Request, res: Response) => {
  const admin = await requireAdminPermission(req, res, 'view_realtime');
  if (!admin) return;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', process.env.VERCEL ? 'close' : 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  if (process.env.VERCEL) {
    res.write(`retry: 5000\ndata: ${JSON.stringify(getPresenceSnapshot())}\n\n`);
    res.end();
    return;
  }

  sseClients.add(res);

  // Send initial snapshot immediately
  res.write(`data: ${JSON.stringify(getPresenceSnapshot())}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
}));

// Endpoint: Admin disconnects a session
app.post('/api/admin/disconnect-session', sensitiveActionRateLimiter, asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Une session Super-Administrateur est requise.' });
  }
  const admin = await getAuthenticatedAdmin(req);
  const sessionId = validateSafeId(req.body?.sessionId, 80);
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'Session ID valide requis.' });
  }
  const target = activeSessions.get(sessionId);
  activeSessions.delete(sessionId);
  broadcastPresenceUpdate();
  if (target) {
    await addServerAuditLog(admin?.name || 'Admin Principal', 'disconnect_session', `Déconnexion forcée de la session de ${target.userName} (${target.ip})`, 'system', sessionId);
  }
  return res.json({ success: true, message: 'Session déconnectée.' });
}));

// =========================================================================
// SERVER START & VITE SPA INTEGRATION
// =========================================================================

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route API introuvable.' });
});

export function formatTechnicalErrorMessage(error: unknown): { code: string; message: string } {
  const chain: Array<{ message?: string; code?: string; detail?: string }> = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === 'object') {
      const record = current as { message?: unknown; code?: unknown; detail?: unknown; cause?: unknown };
      chain.push({
        message: typeof record.message === 'string' ? redactPostgresCredentials(record.message) : undefined,
        code: typeof record.code === 'string' ? record.code : undefined,
        detail: typeof record.detail === 'string' ? redactPostgresCredentials(record.detail) : undefined
      });
      current = record.cause;
    } else {
      chain.push({ message: redactPostgresCredentials(String(current)) });
      break;
    }
  }

  const codes = Array.from(new Set(chain.map((item) => item.code).filter((c): c is string => Boolean(c))));
  const codeSet = new Set(codes);
  const rawPgCode = codes[codes.length - 1] || codes[0];
  const pgMessage = [...chain].reverse().find((item) => item.message)?.message;
  const pgDetail = [...chain].reverse().find((item) => item.detail)?.detail;
  const combinedText = chain.map((item) => item.message || '').join(' | ').toLowerCase();
  const target = getSafePostgresTarget(process.env.DATABASE_URL);
  const targetHint = [
    target.host ? `hôte=${target.host}` : null,
    target.database ? `base=${target.database}` : null,
    target.user ? `user=${target.user}` : null
  ].filter(Boolean).join(', ');
  const detailSuffix = [
    rawPgCode ? `code=${rawPgCode}` : null,
    targetHint || null,
    pgDetail || pgMessage || null
  ].filter(Boolean).join(' | ');

  if (codeSet.has('28P01') || codeSet.has('28000') || combinedText.includes('password authentication failed')) {
    return {
      code: rawPgCode || 'PG_AUTH_FAILED',
      message: `Authentification PostgreSQL refusée (${detailSuffix || 'vérifiez DATABASE_URL'}).`
    };
  }
  if (
    codeSet.has('SELF_SIGNED_CERT_IN_CHAIN') ||
    codeSet.has('DEPTH_ZERO_SELF_SIGNED_CERT') ||
    codeSet.has('UNABLE_TO_VERIFY_LEAF_SIGNATURE') ||
    combinedText.includes('self-signed certificate') ||
    combinedText.includes('certificate')
  ) {
    return {
      code: rawPgCode || 'PG_SSL_ERROR',
      message: `Erreur SSL/TLS PostgreSQL (${detailSuffix || 'vérifiez la configuration SSL de DATABASE_URL'}).`
    };
  }
  if (
    codeSet.has('ENETUNREACH') ||
    codeSet.has('ECONNREFUSED') ||
    codeSet.has('ENOTFOUND') ||
    codeSet.has('EAI_AGAIN')
  ) {
    return {
      code: rawPgCode || 'PG_UNREACHABLE',
      message: `Serveur PostgreSQL injoignable (${detailSuffix || 'vérifiez hôte/port dans DATABASE_URL'}).`
    };
  }
  if (
    codeSet.has('ETIMEDOUT') ||
    combinedText.includes('timeout') ||
    combinedText.includes('connection terminated')
  ) {
    return {
      code: rawPgCode || 'PG_TIMEOUT',
      message: `Délai de connexion PostgreSQL dépassé (${detailSuffix || 'vérifiez DATABASE_URL'}).`
    };
  }
  if (codeSet.has('23503')) {
    return {
      code: '23503',
      message: `Incohérence de référence en base (${detailSuffix || 'app_users.id / payload.id'}).`
    };
  }
  if (codeSet.has('42P01') || codeSet.has('42703')) {
    return {
      code: rawPgCode || 'PG_SCHEMA_ERROR',
      message: `Table ou colonne PostgreSQL manquante (${detailSuffix || 'schéma incomplet'}).`
    };
  }
  if (combinedText.includes('non initialisée')) {
    return {
      code: 'DB_NOT_INITIALIZED',
      message: 'La connexion à la base de données n’est pas initialisée (vérifiez DATABASE_URL).'
    };
  }
  return {
    code: rawPgCode || 'SERVER_ERROR',
    message: detailSuffix
      ? `Erreur technique serveur (${detailSuffix}).`
      : 'Une erreur technique serveur est survenue. Consultez les logs Vercel (/api/health).'
  };
}

const apiErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  logPostgresError(`API ${req.method} ${req.originalUrl || req.path}`, error, process.env.DATABASE_URL);
  if (res.headersSent) return next(error);
  const formatted = formatTechnicalErrorMessage(error);
  res.status(500).json({ success: false, code: formatted.code, error: formatted.message });
};
app.use(apiErrorHandler);

let initializationPromise: Promise<AdminConfig> | null = null;

export function ensureServerInitialized(): Promise<AdminConfig> {
  if (!initializationPromise) {
    initializationPromise = initializeServerState().catch((err) => {
      initializationPromise = null;
      throw err;
    });
  }
  return initializationPromise;
}

async function initializeServerState(): Promise<AdminConfig> {
  const legacyAdminConfig = readLegacyAdminConfig();
  const hasConfiguredAdminInJson = legacyAdminConfig.admins.length > 0;
  const initialEmail = process.env.ADMIN_INITIAL_EMAIL?.trim().toLowerCase();
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD?.trim();
  const initialName = process.env.ADMIN_INITIAL_NAME?.trim() || 'Administrateur principal';
  const initialPhone = process.env.ADMIN_INITIAL_PHONE?.trim() || '+22656283526';

  if (Boolean(initialEmail) !== Boolean(initialPassword)) {
    console.warn('[AI Studio] ADMIN_INITIAL_EMAIL et ADMIN_INITIAL_PASSWORD doivent être configurées ensemble pour initialiser le compte administrateur.');
  }
  if (initialPassword && (initialPassword.length < 4 || initialPassword.length > 128)) {
    console.warn('[AI Studio] ADMIN_INITIAL_PASSWORD ignoré : longueur invalide (4 à 128 caractères attendus).');
  }

  const shouldBootstrapAdmin =
    !hasConfiguredAdminInJson &&
    Boolean(initialEmail) &&
    Boolean(initialPassword) &&
    initialPassword!.length >= 4 &&
    initialPassword!.length <= 128;

  const bootstrapAdmin: ServerAdminUser | undefined = shouldBootstrapAdmin && initialEmail && initialPassword
    ? (() => {
        const { hash, salt } = hashPasswordSecure(initialPassword);
        return {
          id: crypto.randomUUID(),
          name: initialName,
          email: initialEmail,
          phone: initialPhone,
          role: 'admin_principal',
          passwordHash: hash,
          passwordSalt: salt,
          passwordAlgorithm: 'pbkdf2-sha512',
          isProtected: true,
          addedDate: new Date().toLocaleDateString('fr-FR')
        };
      })()
    : undefined;

  await initializeUserStore({
    legacyInvestorFile: INVESTORS_FILE,
    legacyClientFile: CLIENTS_FILE,
    legacyAdmins: () => legacyAdminConfig.admins.map((admin) => {
      if (!admin.assignedPasswordPlainText) return admin;
      const { assignedPasswordPlainText, ...legacyAdmin } = admin;
      return {
        ...legacyAdmin,
        ...hashPasswordSecure(assignedPasswordPlainText),
        passwordAlgorithm: 'pbkdf2-sha512'
      };
    }) as StoredUser[],
    bootstrapAdmin
  });
  await initializeApplicationStore(DATA_DIR, DEFAULT_CONFIG);
  const config = await loadConfig();
  const envMasterPassword = process.env.ADMIN_MASTER_PASSWORD?.trim();
  let initialMasterPassword = { hash: '', salt: '' };
  if (envMasterPassword) {
    if (envMasterPassword.length < 4 || envMasterPassword.length > 128) {
      console.warn('[AI Studio] ADMIN_MASTER_PASSWORD ignoré : longueur invalide (4 à 128 caractères attendus).');
    } else {
      initialMasterPassword = hashInvestorPassword(envMasterPassword);
    }
  }
  await initializeAdminSecurity({
    customAdminUrl: config.customAdminUrl || '/electromen-gestion',
    masterPasswordHash: initialMasterPassword.hash,
    masterPasswordSalt: initialMasterPassword.salt,
    previousAdminUrls: []
  });
  if (initialMasterPassword.hash) {
    const currentSecurity = await getAdminSecuritySettings();
    if (currentSecurity && !currentSecurity.masterPasswordHash) {
      await updateAdminSecuritySettings({
        ...currentSecurity,
        masterPasswordHash: initialMasterPassword.hash,
        masterPasswordSalt: initialMasterPassword.salt
      });
    }
  }

  const existingInvestors = await listInvestors<ServerInvestorUser>();
  for (const investor of existingInvestors) {
    if (investor.passwordHash && investor.passwordSalt) {
      if (investor.assignedPassword) {
        const { hash, salt } = hashInvestorPassword(investor.assignedPassword);
        const { assignedPassword: _legacyPassword, ...withoutLegacyPassword } = investor;
        await updateInvestor<ServerInvestorUser>(investor.id, (current) => ({
          ...withoutLegacyPassword,
          passwordHash: hash,
          passwordSalt: salt,
          passwordAlgorithm: 'pbkdf2-sha512-v2'
        }));
      }
      continue;
    }
    if (!investor.assignedPassword) {
      console.error(`[ELECTRO-MEN] Compte investisseur ${investor.id} sans mot de passe récupérable — ignoré au démarrage pour préserver l’accès administrateur.`);
      continue;
    }
    const { hash, salt } = hashInvestorPassword(investor.assignedPassword);
    const { assignedPassword: _legacyPassword, ...withoutLegacyPassword } = investor;
    await updateInvestor<ServerInvestorUser>(investor.id, (current) => ({
      ...withoutLegacyPassword,
      passwordHash: hash,
      passwordSalt: salt,
      passwordAlgorithm: 'pbkdf2-sha512-v2'
    }));
  }

  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const subscriptions = await readJson<ShareSubscription[]>(SUBSCRIPTIONS_FILE, []);
  const normalizedOperations = operations.map((operation) => {
    const sharePrice = Number(operation.sharePrice) || Number(operation.offers?.[0]?.sharePrice) || 0;
    const availableShares = Number.isSafeInteger(operation.availableShares) && (operation.availableShares || 0) > 0
      ? operation.availableShares as number
      : operation.offers?.reduce((total, offer) => total + (Number.isSafeInteger(offer.maxShares) ? offer.maxShares || 0 : 0), 0) ||
        (sharePrice > 0 && operation.targetAmount > 0 ? Math.floor(operation.targetAmount / sharePrice) : 0);
    const subscribedShares = subscriptions
      .filter((subscription) => subscription.operationId === operation.id && subscription.status !== 'rejected')
      .reduce((total, subscription) => total + subscription.shares, 0);
    return {
      ...operation,
      sharePrice: sharePrice > 0 ? sharePrice : operation.sharePrice,
      availableShares: Math.max(availableShares, subscribedShares),
      subscribedShares
    };
  });
  await initializeOperationInventory(normalizedOperations.map((operation): OperationInventory => ({
    operationId: operation.id,
    totalShares: operation.availableShares || 0,
    committedShares: operation.subscribedShares || 0
  })));
  if (JSON.stringify(operations) !== JSON.stringify(normalizedOperations)) {
    await writeJson(OPERATIONS_FILE, normalizedOperations);
  }
  await saveConfig({ ...config, admins: [], activeTokens: {}, masterPasswordHash: '', masterPasswordHint: '' });
  return config;
}

async function startServer() {
  const config = await ensureServerInitialized();
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve('dist');
  const publicDir = path.resolve('public');

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    void getAdminSecuritySettings()
      .then((settings) => {
        if (settings?.previousAdminUrls.includes(req.path) || (req.path === '/admin' && settings?.customAdminUrl !== '/admin')) {
          return res.status(404).send('Not Found');
        }
        next();
      })
      .catch(next);
  });

  if (isProd) {
    app.use(express.static(distDir));
    app.use(express.static(publicDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    app.use(express.static(publicDir));
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ELECTRO-MEN Full-Stack Server active on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
    console.log(`🔐 Admin URL : ${config.customAdminUrl}`);
  });
}

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
