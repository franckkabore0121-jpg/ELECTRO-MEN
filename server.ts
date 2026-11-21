import "dotenv/config";
import express, { Request, Response, type ErrorRequestHandler, type NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getServerPort } from './server/runtimeConfig.ts';
import {
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
  initializeApplicationStore,
  readApplicationData,
  readInvestorSubscriptions,
  saveApplicationBackup,
  writeApplicationData,
  type ApplicationDataKey
} from './server/applicationStore.ts';
import {
  INVESTOR_PASSWORD_ALGORITHM,
  hashInvestorPassword,
  verifyInvestorPassword,
  withInvestorPassword
} from './server/investorAuth.ts';
import {
  createMediaObjectKey,
  getSupabaseStorage,
  InvalidMediaUploadError,
  MediaStorageConfigurationError,
  parseBase64MediaUpload
} from './server/supabaseStorage.ts';

const app = express();

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
  | 'groups'
  | 'archives'
  | 'investors'
  | 'admins';

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

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.get('/api/events/stream', (req: Request, res: Response) => {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
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
  [PRODUCTS_FILE, 'products']
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
  [GROUPS_FILE, 'groups']
]);

app.get('/uploads/:filename', asyncRoute(async (req: Request, res: Response, next: NextFunction) => {
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

function verifyMasterCode(code: string, settings: AdminSecuritySettings): boolean {
  if (!settings.masterPasswordHash || !settings.masterPasswordSalt) return false;
  try {
    const submittedHash = crypto.pbkdf2Sync(code, settings.masterPasswordSalt, MASTER_CODE_PBKDF2_ITERATIONS, 64, 'sha512');
    const storedHash = Buffer.from(settings.masterPasswordHash, 'hex');
    return storedHash.length === submittedHash.length && crypto.timingSafeEqual(storedHash, submittedHash);
  } catch {
    return false;
  }
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

function setHttpOnlySessionCookie(res: Response, name: string, token: string, maxAgeSeconds: number): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${name}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secure}`);
}

function publicInvestor(investor: ServerInvestorUser) {
  const {
    passwordHash: _passwordHash,
    passwordSalt: _passwordSalt,
    assignedPassword: _assignedPassword,
    assignedPasswordPlainText: _assignedPasswordPlainText,
    ...safeInvestor
  } = investor;
  return safeInvestor;
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

async function establishInvestorSession(investor: ServerInvestorUser, res: Response): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVESTOR_SESSION_DURATION_MS);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await createInvestorSession(tokenHash, investor.id, expiresAt);
  setHttpOnlySessionCookie(res, INVESTOR_SESSION_COOKIE, token, Math.floor(INVESTOR_SESSION_DURATION_MS / 1000));
}

async function establishUserSession(user: StoredUser, res: Response, cookieName: string, durationMs: number): Promise<string> {
  const token = generateToken();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + durationMs);
  await createUserSession(tokenHash, user.id, expiresAt);
  setHttpOnlySessionCookie(res, cookieName, token, Math.floor(durationMs / 1000));
  return token;
}

function clearInvestorSessionCookie(res: Response): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${INVESTOR_SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
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

export interface ServerInvestorUser extends StoredUser {
  lastName: string;
  firstName: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  passwordSalt: string;
  passwordAlgorithm?: typeof INVESTOR_PASSWORD_ALGORITHM;
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
  role: 'investor';
}

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
  adminPasswordCode?: string;
  requestedAt: string;
  paymentMethod?: string;
}

export interface ServerAdminUser extends StoredUser {
  name: string;
  email: string;
  phone: string;
  role: 'admin_principal' | 'admin_secondaire';
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
  masterPasswordHash: string;
  masterPasswordHint: string;
  admins: ServerAdminUser[];
  activeTokens: Record<string, { email: string; role: string; expiresAt: number }>;
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
  masterPasswordHash: '',
  masterPasswordHint: '',
  admins: [],
  activeTokens: {}
};

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
}

// =========================================================================
// 1. OTP VERIFICATION ENDPOINTS (EMAIL / PHONE VALIDATION)
// =========================================================================

app.post('/api/auth/send-otp', asyncRoute(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Adresse e-mail requise.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await saveUserOtp(cleanEmail, code, new Date(Date.now() + 10 * 60 * 1000));

  console.log(`[ELECTRO-MEN SECURITY OTP] Code généré pour ${cleanEmail} : ${code}`);

  return res.json({
    success: true,
    message: `Code de vérification envoyé à ${cleanEmail}. Valable 10 minutes.`,
    devOtp: code // Available in response for preview/demo verification
  });
}));

app.post('/api/investor/change-password', asyncRoute(async (req: Request, res: Response) => {
  const investor = await getAuthenticatedInvestor(req);
  if (!investor) {
    return res.status(401).json({ success: false, error: 'Session expirée. Veuillez vous reconnecter.' });
  }

  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ success: false, error: 'Veuillez renseigner les mots de passe requis.' });
  }
  if (newPassword.length < 12 || newPassword.length > 128) {
    return res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit comporter entre 12 et 128 caractères.' });
  }
  if (!verifyInvestorPassword(currentPassword, investor)) {
    return res.status(400).json({ success: false, error: 'Le mot de passe actuel est incorrect.' });
  }

  const { hash, salt } = hashInvestorPassword(newPassword);
  const updatedInvestor = await updateInvestor<ServerInvestorUser>(investor.id, (current) => {
    const { assignedPassword: _assignedPassword, ...withoutLegacyPassword } = current;
    return {
      ...withoutLegacyPassword,
      passwordHash: hash,
      passwordSalt: salt,
      passwordAlgorithm: 'pbkdf2-sha512-v2'
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

app.post('/api/auth/verify-otp', asyncRoute(async (req: Request, res: Response) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, error: 'Email et code OTP requis.' });
  }

  const cleanEmail = email.trim().toLowerCase();
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

  if (entry.code !== code.trim()) {
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

app.post('/api/auth/register-client', asyncRoute(async (req: Request, res: Response) => {
  const { lastName, firstName, email, phone, city, accountType, password, termsAccepted } = req.body;

  if (!termsAccepted) {
    return res.status(400).json({ success: false, error: 'Vous devez accepter les Conditions d’Utilisation et la Politique de Confidentialité.' });
  }

  const identityCheck = validateRealIdentity(lastName, firstName, email, phone);
  if (!identityCheck.valid) {
    return res.status(400).json({ success: false, error: identityCheck.error });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter au moins 6 caractères.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (await findUserByEmail<StoredUser>(cleanEmail)) {
    return res.status(409).json({ success: false, error: 'Un compte utilisateur existe déjà avec cette adresse e-mail. Veuillez vous connecter.' });
  }

  const { hash, salt } = hashPasswordSecure(password);
  const fullName = `${lastName.trim().toUpperCase()} ${firstName.trim()}`;
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const newClient: ServerClientUser = {
    id: crypto.randomUUID(),
    lastName: lastName.trim(),
    firstName: firstName.trim(),
    name: fullName,
    email: cleanEmail,
    phone: phone.trim(),
    city: city?.trim() || 'Ouagadougou',
    accountType: accountType || 'Client Particulier',
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

app.post('/api/auth/login-client', asyncRoute(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const rateLimit = checkRateLimit(cleanEmail);
  if (!rateLimit.allowed) {
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
  const token = await establishUserSession(client, res, CLIENT_SESSION_COOKIE, INVESTOR_SESSION_DURATION_MS);

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

app.post('/api/investor/register', async (req: Request, res: Response) => {
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

  const cleanEmail = email.trim().toLowerCase();
  try {
    if (await findInvestorByEmail<ServerInvestorUser>(cleanEmail)) {
      return res.status(409).json({ success: false, error: 'Un compte investisseur existe déjà avec cette adresse e-mail.' });
    }

    const { hash, salt } = hashInvestorPassword(password);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const newInvestor: ServerInvestorUser = {
      id: crypto.randomUUID(),
      lastName: lastName.trim(),
      firstName: firstName.trim(),
      name: fullName,
      email: cleanEmail,
      phone: phone.trim(),
      passwordHash: hash,
      passwordSalt: salt,
      passwordAlgorithm: 'pbkdf2-sha512-v2',
      status: 'en_attente',
      statusReason: 'Demande soumise par l’utilisateur, en cours d’examen par l’administrateur.',
      statusUpdatedAt: new Date().toLocaleDateString('fr-FR'),
      isVerified: false,
      createdAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
      totalInvested: 0,
      sharesCount: 0,
      dividendsEarned: 0,
      role: 'investor'
    };

    await createInvestor(newInvestor);
    await establishInvestorSession(newInvestor, res);
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

app.post('/api/investor/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Veuillez renseigner une adresse e-mail et un mot de passe valides.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'L’adresse e-mail est invalide.' });
  }

  const attemptKey = `investor:${cleanEmail}`;
  const rateLimit = checkRateLimit(attemptKey);
  if (!rateLimit.allowed) {
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
        (current) => withInvestorPassword(current, password)
      );
      if (!upgradedInvestor) {
        return res.status(500).json({ success: false, error: 'La mise à jour sécurisée du compte a échoué.' });
      }
      authenticatedInvestor = upgradedInvestor;
    }

    await establishInvestorSession(authenticatedInvestor, res);
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
    clearInvestorSessionCookie(res);
    return res.json({ success: true });
  } catch (error) {
    console.error('Investor logout failed:', error);
    return res.status(500).json({ success: false, error: 'La déconnexion n’a pas pu être confirmée.' });
  }
});

// =========================================================================
// 4. STRICT SERVER-SIDE SHARE PURCHASE VALIDATION
// =========================================================================

app.post('/api/investor/subscribe-shares', asyncRoute(async (req: Request, res: Response) => {
  const { operationId, offerId, sharesCount } = req.body || {};
  const sessionInvestor = await getAuthenticatedInvestor(req);
  if (!sessionInvestor) {
    return res.status(401).json({ success: false, error: 'Vous devez vous connecter pour souscrire des parts.' });
  }
  const investor = await findInvestorByIdentifier<ServerInvestorUser>(sessionInvestor.id);

  if (!investor) {
    return res.status(404).json({
      success: false,
      error: 'Accès refusé : Aucun compte investisseur trouvé. Vous devez obligatoirement posséder un compte pour acheter des parts.'
    });
  }

  // 2. Mandatory check: investor status MUST BE 'approuve'
  if (investor.status !== 'approuve') {
    return res.status(403).json({
      success: false,
      error: `Accès refusé : Votre compte investisseur a le statut "${investor.status}". Seuls les comptes approuvés et validés par l’administrateur peuvent acheter des parts.`
    });
  }

  // 3. Mandatory check: operation exists, is published, is open
  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const operation = operations.find((op) => op.id === operationId);

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

  // 4. Offer check: find selected offer or fallback to primary open offer
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

  // 5. Quantity validation
  const count = parseInt(sharesCount, 10);
  if (!Number.isSafeInteger(count) || count < 1 || String(count) !== String(sharesCount).trim()) {
    return res.status(400).json({
      success: false,
      error: 'Le nombre de parts doit être supérieur à zéro.'
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
  const subId = `SUB-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

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
    status: 'pending_admin',
    requestedAt: `${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  };

  // Update investor portfolio totals
  const updatedInvestor = await updateInvestor<ServerInvestorUser>(investor.id, (current) => ({
    ...current,
    sharesCount: (current.sharesCount || 0) + count,
    totalInvested: (current.totalInvested || 0) + totalAmount
  }));
  if (!updatedInvestor) {
    await releaseOperationShares(operation.id, count);
    return res.status(404).json({ success: false, error: 'Compte investisseur introuvable.' });
  }

  // Update operation metrics
  operation.collectedAmount = (operation.collectedAmount || 0) + totalAmount;
  operation.investorsCount = (operation.investorsCount || 0) + 1;
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
    await updateInvestor<ServerInvestorUser>(investor.id, (current) => ({
      ...current,
      sharesCount: Math.max(0, (current.sharesCount || 0) - count),
      totalInvested: Math.max(0, (current.totalInvested || 0) - totalAmount)
    }));
    await releaseOperationShares(operation.id, count);
    return res.status(500).json({ success: false, error: 'La souscription n’a pas pu être enregistrée.' });
  }
  broadcastDataChanged('investors');

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

  res.status(201).json({
    success: true,
    message: 'Demande de souscription enregistrée avec succès. En attente de validation administrative.',
    subscription: newSub
  });
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
app.get('/api/admin/operations', asyncRoute(async (_req: Request, res: Response) => {
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
  const {
    id,
    ref,
    title,
    sector,
    category,
    objective,
    description,
    sharePrice,
    availableShares,
    targetAmount,
    duration,
    yieldStr,
    distribution,
    conditions,
    offerStatus,
    isPublished,
    offers
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: 'Titre de l’opération requis.' });
  }
  const firstOfferPrice = Array.isArray(offers) ? Number(offers[0]?.sharePrice) : 0;
  const price = Number(sharePrice) || firstOfferPrice;
  const shareLimit = Number(availableShares);
  if (!Number.isSafeInteger(price) || price <= 0) {
    return res.status(400).json({ success: false, error: 'Le prix unitaire de la part doit être un nombre positif.' });
  }
  if (!Number.isSafeInteger(shareLimit) || shareLimit < 1) {
    return res.status(400).json({ success: false, error: 'Le nombre de parts disponibles doit être un entier positif.' });
  }

  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const opId = typeof id === 'string' && id.trim() ? id.trim() : `op-${Date.now()}`;
  const published = isPublished !== undefined ? Boolean(isPublished) : offerStatus === 'Ouvert';
  const statusStr = offerStatus || (published ? 'Ouvert' : 'Brouillon');

  const defaultOffer: InvestmentOffer = {
    id: `off-${Date.now()}-std`,
    ref: `OFF-${Date.now().toString().slice(-4)}`,
    title: `Parts Ordinaires - ${title.trim()}`,
    category: sector || category || 'Souscription Ouverte',
    sharePrice: price,
    yield: yieldStr || '15% à 18%',
    yieldType: 'Dividendes directs annuels',
    duration: duration || '12 Mois renouvelable',
    risk: 'Faible (Garanti par stock actif)',
    description: `Acquisition de parts dans l'opération ${title.trim()}`,
    isOpen: statusStr === 'Ouvert',
    isPublished: published
  };

  const newOp: InvestmentOperation = {
    id: opId,
    ref: typeof ref === 'string' && ref.trim() ? ref.trim() : `OP-${Date.now().toString().slice(-4)}`,
    title: title.trim(),
    category: sector || category || 'Électronique',
    sector: sector || category || 'Électronique',
    objective: objective?.trim() || description?.trim() || '',
    yield: yieldStr || '15% à 18%',
    yieldType: 'Dividendes directs annuels',
    description: description?.trim() || objective?.trim() || `Opération de financement pour ${title.trim()}`,
    duration: duration || '12 Mois',
    risk: 'Faible',
    riskColor: 'emerald',
    targetAmount: Number(targetAmount) || 10000000,
    collectedAmount: 0,
    percent: 0,
    distribution: distribution || 'Trimestrielle',
    investorsCount: 0,
    cycleNumber: 1,
    status: published ? 'published' : 'draft',
    offerStatus: statusStr,
    isPublished: published,
    sharePrice: price,
    availableShares: shareLimit,
    openDate: new Date().toLocaleDateString('fr-FR'),
    offers: offers && Array.isArray(offers) && offers.length > 0
      ? offers.map((offer: InvestmentOffer) => ({ ...offer, sharePrice: price }))
      : [defaultOffer]
  };

  operations.unshift(newOp);
  await initializeOperationInventory([{ operationId: opId, totalShares: shareLimit, committedShares: 0 }]);
  await writeJson(OPERATIONS_FILE, operations);

  await addServerAuditLog('Admin Principal', 'create_operation', `Création et publication de l'opération "${newOp.title}" (${statusStr})`, 'operation', opId);
  res.status(201).json({ success: true, operation: newOp });
}));

app.patch('/api/admin/operations/:id/status', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { offerStatus, isPublished } = req.body;
  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const idx = operations.findIndex((op) => op.id === id);

  if (idx < 0) {
    return res.status(404).json({ success: false, error: 'Opération introuvable.' });
  }

  if (offerStatus) operations[idx].offerStatus = offerStatus;
  if (isPublished !== undefined) operations[idx].isPublished = Boolean(isPublished);
  await writeJson(OPERATIONS_FILE, operations);

  await addServerAuditLog('Admin Principal', 'update_operation_status', `Statut de l'opération "${operations[idx].title}" -> ${offerStatus || operations[idx].offerStatus}`, 'operation', id);
  res.json({ success: true, operation: operations[idx] });
}));

app.put('/api/admin/operations/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  const operations = await readJson<InvestmentOperation[]>(OPERATIONS_FILE, []);
  const idx = operations.findIndex((op) => op.id === id);

  if (idx < 0) {
    return res.status(404).json({ success: false, error: 'Opération introuvable.' });
  }

  const current = operations[idx];
  const requestedPrice = updates.sharePrice === undefined ? current.sharePrice : Number(updates.sharePrice);
  const requestedLimit = updates.availableShares === undefined ? current.availableShares : Number(updates.availableShares);
  if (requestedPrice !== undefined && (!Number.isSafeInteger(requestedPrice) || requestedPrice <= 0)) {
    return res.status(400).json({ success: false, error: 'Le prix unitaire de la part doit être un nombre positif.' });
  }
  if (requestedLimit !== undefined && (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1)) {
    return res.status(400).json({ success: false, error: 'Le nombre de parts disponibles doit être un entier positif.' });
  }
  if (requestedLimit !== undefined && !(await updateOperationInventory(id, requestedLimit))) {
    return res.status(409).json({ success: false, error: 'Le nombre de parts disponibles ne peut pas être inférieur aux parts déjà souscrites.' });
  }
  operations[idx] = {
    ...current,
    ...updates,
    sharePrice: requestedPrice,
    availableShares: requestedLimit,
    offers: current.offers?.map((offer) => ({ ...offer, sharePrice: requestedPrice ?? offer.sharePrice }))
  };
  await writeJson(OPERATIONS_FILE, operations);

  await addServerAuditLog('Admin Principal', 'update_operation', `Mise à jour de l'opération "${operations[idx].title}"`, 'operation', id);
  res.json({ success: true, operation: operations[idx] });
}));

app.delete('/api/admin/operations/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
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

  await addServerAuditLog('Admin Principal', 'archive_operation', `Archivage de l'opération "${target.title}"`, 'operation', id);
  res.json({ success: true, message: `Opération "${target.title}" supprimée avec succès.` });
}));

// Offers inside Operation
app.post('/api/admin/operations/:opId/offers', asyncRoute(async (req: Request, res: Response) => {
  const { opId } = req.params;
  const { title, yieldStr, duration, risk, description, isOpen } = req.body;

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
    title: (title || 'Nouvelle Offre').trim(),
    category: 'Offre Spécifique',
    sharePrice: operationSharePrice,
    yield: yieldStr || '15% à 18%',
    yieldType: 'Dividendes directs annuels',
    duration: duration || '12 Mois',
    risk: risk || 'Faible',
    description: (description || '').trim(),
    isOpen: isOpen !== undefined ? Boolean(isOpen) : true,
    isPublished: true
  };

  if (!op.offers) op.offers = [];
  op.offers.push(newOffer);
  await writeJson(OPERATIONS_FILE, operations);

  await addServerAuditLog('Admin Principal', 'add_offer', `Ajout de l'offre "${newOffer.title}" dans l'opération "${op.title}"`, 'offer', newOffer.id);
  res.status(201).json({ success: true, offer: newOffer });
}));

app.delete('/api/admin/operations/:opId/offers/:offerId', asyncRoute(async (req: Request, res: Response) => {
  const { opId, offerId } = req.params;
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

  await addServerAuditLog('Admin Principal', 'delete_offer', `Suppression de l'offre "${offer?.title || offerId}"`, 'offer', offerId);
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

app.get('/api/products', asyncRoute(async (_req: Request, res: Response) => {
  const products = await readJson<any[]>(PRODUCTS_FILE, []);
  res.json({ success: true, products });
}));

app.post('/api/admin/products', asyncRoute(async (req: Request, res: Response) => {
  const prod = req.body;
  if (!prod || !prod.name) {
    return res.status(400).json({ success: false, error: 'Nom de produit requis.' });
  }

  const products = await readJson<any[]>(PRODUCTS_FILE, []);
  const newProd = {
    ...prod,
    id: prod.id || `prod-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    ref: prod.ref || `ELM-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString()
  };

  products.unshift(newProd);
  await writeJson(PRODUCTS_FILE, products);
  await addServerAuditLog('Admin Principal', 'create_product', `Ajout du produit "${newProd.name}" (${newProd.ref})`, 'product', newProd.id);
  res.status(201).json({ success: true, product: newProd });
}));

app.put('/api/admin/products/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;
  const products = await readJson<any[]>(PRODUCTS_FILE, []);
  const idx = products.findIndex((p) => p.id === id);

  if (idx === -1) {
    const newProd = { ...updateData, id };
    products.push(newProd);
    await writeJson(PRODUCTS_FILE, products);
    return res.json({ success: true, product: newProd });
  }

  products[idx] = { ...products[idx], ...updateData, id };
  await writeJson(PRODUCTS_FILE, products);
  await addServerAuditLog('Admin Principal', 'update_product', `Modification du produit "${products[idx].name}" (${products[idx].ref})`, 'product', id);
  res.json({ success: true, product: products[idx] });
}));

app.delete('/api/admin/products/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
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
  await addServerAuditLog('Admin Principal', 'archive_product', `Archivage du produit "${target.name}" (${target.ref})`, 'product', id);
  res.json({ success: true, message: 'Produit déplacé dans la corbeille.' });
}));

app.get('/api/courses', asyncRoute(async (_req: Request, res: Response) => {
  const courses = await readJson<any[]>(COURSES_FILE, []);
  res.json({ success: true, courses });
}));

app.post('/api/admin/courses', asyncRoute(async (req: Request, res: Response) => {
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
  } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ success: false, error: 'Titre de formation obligatoire.' });
  }
  if (!domain || !['electronique', 'electrotechnique', 'informatique'].includes(domain)) {
    return res.status(400).json({ success: false, error: 'Domaine pédagogique invalide (electronique, electrotechnique ou informatique).' });
  }

  const courses = await readJson<any[]>(COURSES_FILE, []);
  const initialStatus = status === 'draft' || status === 'suspended' ? status : 'published';

  const newCourse = {
    id: `course-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    title: title.trim(),
    domain,
    category: category ? String(category).trim() : 'Programme Général',
    description: description ? String(description).trim() : '',
    imageUrl: imageUrl ? String(imageUrl).trim() : '',
    videoUrl: videoUrl ? String(videoUrl).trim() : '',
    duration: duration ? String(duration).trim() : '',
    level: level ? String(level).trim() : '',
    pedagogicalObjectives: Array.isArray(pedagogicalObjectives) ? pedagogicalObjectives.filter(Boolean) : [],
    features: Array.isArray(features) ? features.filter(Boolean) : [],
    price: Number(price) || 0,
    isFree: Boolean(isFree || Number(price) === 0),
    status: initialStatus,
    isPublished: initialStatus === 'published',
    dateAdded: new Date().toLocaleDateString('fr-FR'),
    syllabus: []
  };

  courses.unshift(newCourse);
  await writeJson(COURSES_FILE, courses);

  await addServerAuditLog('Admin Principal', 'create_course', `Création de la formation "${newCourse.title}" (${newCourse.domain})`, 'course', newCourse.id);
  res.json({ success: true, course: newCourse });
}));

app.put('/api/admin/courses/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
  const courses = await readJson<any[]>(COURSES_FILE, []);
  const idx = courses.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Formation introuvable.' });

  const updated = {
    ...courses[idx],
    ...req.body,
    id, // preserve id
    isPublished: req.body.status ? req.body.status === 'published' : courses[idx].isPublished
  };

  courses[idx] = updated;
  await writeJson(COURSES_FILE, courses);

  await addServerAuditLog('Admin Principal', 'update_course', `Modification de la formation "${updated.title}"`, 'course', id);
  res.json({ success: true, course: updated });
}));

app.patch('/api/admin/courses/:id/status', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['published', 'draft', 'suspended'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Statut invalide.' });
  }

  const courses = await readJson<any[]>(COURSES_FILE, []);
  const idx = courses.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Formation introuvable.' });

  courses[idx].status = status;
  courses[idx].isPublished = status === 'published';
  await writeJson(COURSES_FILE, courses);

  await addServerAuditLog('Admin Principal', 'update_course_status', `Statut de la formation "${courses[idx].title}" changé en ${status}`, 'course', id);
  res.json({ success: true, course: courses[idx] });
}));

app.delete('/api/admin/courses/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
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

  await addServerAuditLog('Admin Principal', 'archive_course', `Archivage de la formation "${target.title}"`, 'course', id);
  res.json({ success: true, message: 'Formation supprimée avec succès.' });
}));

// Category Management API
app.get('/api/course-categories', asyncRoute(async (_req: Request, res: Response) => {
  const categories = await readJson<any[]>(COURSE_CATEGORIES_FILE, DEFAULT_COURSE_CATEGORIES);
  res.json({ categories });
}));

app.post('/api/admin/course-categories', asyncRoute(async (req: Request, res: Response) => {
  const { label, domain } = req.body;
  if (!label || typeof label !== 'string' || !label.trim()) {
    return res.status(400).json({ success: false, error: 'Libellé de catégorie obligatoire.' });
  }
  if (!['electronique', 'electrotechnique', 'informatique'].includes(domain)) {
    return res.status(400).json({ success: false, error: 'Domaine invalide.' });
  }

  const categories = await readJson<any[]>(COURSE_CATEGORIES_FILE, DEFAULT_COURSE_CATEGORIES);
  const newCat = {
    id: `cat-${domain.slice(0, 4)}-${Date.now()}`,
    label: label.trim(),
    domain,
    isActive: true
  };

  categories.push(newCat);
  await writeJson(COURSE_CATEGORIES_FILE, categories);

  await addServerAuditLog('Admin Principal', 'create_course_category', `Ajout de la catégorie de cours "${newCat.label}" (${domain})`, 'category', newCat.id);
  res.json({ success: true, category: newCat });
}));

app.put('/api/admin/course-categories/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { label, domain, isActive } = req.body;
  const categories = await readJson<any[]>(COURSE_CATEGORIES_FILE, DEFAULT_COURSE_CATEGORIES);
  const idx = categories.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Catégorie introuvable.' });

  if (label) categories[idx].label = label.trim();
  if (domain && ['electronique', 'electrotechnique', 'informatique'].includes(domain)) categories[idx].domain = domain;
  if (typeof isActive === 'boolean') categories[idx].isActive = isActive;

  await writeJson(COURSE_CATEGORIES_FILE, categories);
  await addServerAuditLog('Admin Principal', 'update_course_category', `Mise à jour de la catégorie de cours "${categories[idx].label}"`, 'category', id);
  res.json({ success: true, category: categories[idx] });
}));

app.delete('/api/admin/course-categories/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
  const categories = await readJson<any[]>(COURSE_CATEGORIES_FILE, DEFAULT_COURSE_CATEGORIES);
  const target = categories.find((c) => c.id === id);
  if (!target) return res.status(404).json({ success: false, error: 'Catégorie introuvable.' });

  const archiveId = await archiveItem('course-category', target.id, target.label, target);
  const filtered = categories.filter((c) => c.id !== id);
  try {
    await writeJson(COURSE_CATEGORIES_FILE, filtered);
  } catch (error) {
    await deleteArchiveRecord(archiveId);
    throw error;
  }
  await addServerAuditLog('Admin Principal', 'archive_course_category', `Archivage de la catégorie de cours "${target.label}"`, 'category', id);
  res.json({ success: true, message: 'Catégorie supprimée avec succès.' });
}));

// Investor Status & Admin Management
app.get('/api/admin/investors', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasAdminSession(req)) return res.status(401).json({ success: false, error: 'Authentification administrateur requise.' });
  const investors = await listInvestors<ServerInvestorUser>();
  res.json({ investors: investors.map(publicInvestor) });
}));

app.post('/api/admin/investors', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Seul l’administrateur principal peut activer un accès investisseur.' });
  }
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Veuillez renseigner l’adresse e-mail et le mot de passe.' });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'L’adresse e-mail est invalide.' });
  }
  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter entre 12 et 128 caractères.' });
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
    (current) => withInvestorPassword(current, password)
  );
  if (!updatedInvestor) {
    return res.status(404).json({ success: false, error: 'Le compte investisseur n’existe plus.' });
  }
  await deleteInvestorSessions(updatedInvestor.id);

  await addServerAuditLog(
    'Admin Principal',
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

app.get('/api/investor/status/:idOrEmail', asyncRoute(async (req: Request, res: Response) => {
  const sessionInvestor = await getAuthenticatedInvestor(req);
  if (!sessionInvestor) return res.status(401).json({ success: false, error: 'Session expirée. Veuillez vous reconnecter.' });
  if (req.params.idOrEmail.toLowerCase() !== sessionInvestor.id.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Accès refusé à ce compte investisseur.' });
  }
  return res.json({ success: true, investor: publicInvestor(sessionInvestor) });
}));

const handleUpdateInvestorStatus = async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Une session Super-Administrateur est requise pour modifier un statut.' });
  }
  const { id } = req.params;
  const { status, reason } = req.body || {};

  const validStatuses: InvestorStatus[] = ['demande_non_soumise', 'en_attente', 'approuve', 'refuse', 'suspendu', 'bloque'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Statut investisseur invalide.' });
  }

  const inv = await findInvestorByIdentifier<ServerInvestorUser>(id);
  if (!inv) {
    return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });
  }

  const oldStatus = inv.status;
  const updatedInvestor = await updateInvestor<ServerInvestorUser>(inv.id, (current) => ({
    ...current,
    status,
    statusReason: reason || (status === 'approuve' ? 'Compte formellement approuvé et validé par l’administrateur.' : `Statut mis à jour en "${status}" par l'administrateur.`),
    statusUpdatedAt: new Date().toLocaleDateString('fr-FR')
  }));
  if (!updatedInvestor) return res.status(404).json({ success: false, error: 'Investisseur introuvable.' });

  await addServerAuditLog('Admin Principal', 'update_investor_status', `Statut de ${inv.name} modifié : "${oldStatus}" -> "${status}"`, 'investor', inv.id);

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

  await addServerAuditLog('Admin Principal', 'archive_investor', `Archivage du compte investisseur de ${target.name}`, 'investor', id);
  broadcastDataChanged('investors');
  res.json({ success: true, message: `Compte investisseur de ${target.name} placé dans la corbeille.` });
}));

// Audit Logs Management
app.get('/api/admin/audit-logs', asyncRoute(async (_req: Request, res: Response) => {
  const logs = await readJson<AuditAction[]>(AUDIT_LOGS_FILE, []);
  res.json({ auditLogs: logs });
}));

app.delete('/api/admin/audit-logs/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
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

app.delete('/api/admin/audit-logs', asyncRoute(async (_req: Request, res: Response) => {
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

app.delete('/api/admin/subscriptions/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
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
  broadcastDataChanged('subscriptions');
  res.json({ success: true, message: 'Souscription déplacée dans la corbeille.' });
}));

// Activities CRUD
app.post('/api/admin/activities', asyncRoute(async (req: Request, res: Response) => {
  const { title, description, badge, sector, photoUrl } = req.body;
  if (!title) return res.status(400).json({ success: false, error: 'Titre requis.' });

  const acts = await readJson<InvestorActivity[]>(ACTIVITIES_FILE, []);
  const newAct: InvestorActivity = {
    id: `act-${Date.now()}`,
    title: title.trim(),
    description: (description || '').trim(),
    badge: badge || 'Réalisation',
    sector: sector || 'Industrie',
    photoUrl: photoUrl || '',
    date: new Date().toLocaleDateString('fr-FR'),
    isPublished: true
  };
  acts.unshift(newAct);
  await writeJson(ACTIVITIES_FILE, acts);

  await addServerAuditLog('Admin Principal', 'add_activity', `Publication activité "${newAct.title}"`, 'activity', newAct.id);
  res.status(201).json({ success: true, activity: newAct });
}));

app.delete('/api/admin/activities/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
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
  res.json({ success: true, message: 'Activité déplacée dans la corbeille.' });
}));

// Documents CRUD
app.post('/api/admin/documents', asyncRoute(async (req: Request, res: Response) => {
  const { title, description, fileUrl, format, size } = req.body;
  if (!title) return res.status(400).json({ success: false, error: 'Titre requis.' });

  const docs = await readJson<InvestorDocument[]>(DOCUMENTS_FILE, []);
  const newDoc: InvestorDocument = {
    id: `doc-${Date.now()}`,
    title: title.trim(),
    description: (description || '').trim(),
    fileUrl: fileUrl || '/assets/aistudio/Note_Regle_f4d3053f.pdf',
    format: format || 'PDF',
    size: size || '1.2 Mo',
    date: new Date().toLocaleDateString('fr-FR'),
    isPublished: true
  };
  docs.unshift(newDoc);
  await writeJson(DOCUMENTS_FILE, docs);

  await addServerAuditLog('Admin Principal', 'add_document', `Publication document "${newDoc.title}"`, 'document', newDoc.id);
  res.status(201).json({ success: true, document: newDoc });
}));

app.delete('/api/admin/documents/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
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

app.get('/api/admin/backup', asyncRoute(async (_req: Request, res: Response) => {
  const backup = await buildFullBackup();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="backup-electromen-${Date.now()}.json"`);
  res.json(backup);
}));

app.post('/api/admin/total-reset', asyncRoute(async (req: Request, res: Response) => {
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

app.get('/api/admin/archives', asyncRoute(async (_req: Request, res: Response) => {
  res.json({ archives: await listArchiveRecords() });
}));

app.post('/api/admin/archives/:id/restore', asyncRoute(async (req: Request, res: Response) => {
  const record = await findArchiveRecord(req.params.id);
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
  await checkUserStoreConnection();
  res.json({ success: true });
}));

app.get('/api/admin/config', asyncRoute(async (_req: Request, res: Response) => {
  const config = await loadConfig();
  const security = await getAdminSecuritySettings();
  const admins = await listAdmins<ServerAdminUser>();
  res.json({
    customAdminUrl: security?.customAdminUrl || config.customAdminUrl,
    heroVideoUrl: config.heroVideoUrl || '/assets/videos/electromen-hero.mp4',
    formationsVideoUrl: config.formationsVideoUrl || '/assets/videos/electromen-hero.mp4',
    isMaintenanceMode: Boolean(config.isMaintenanceMode),
    hasMasterPassword: Boolean(security?.masterPasswordHash),
    secondaryAdminsCount: admins.filter((admin) => admin.role === 'admin_secondaire').length
  });
}));

app.post('/api/auth/login', asyncRoute(async (req: Request, res: Response) => {
  const { email, password, masterPin } = req.body;
  const security = await getAdminSecuritySettings();
  const customAdminUrl = security?.customAdminUrl || (await loadConfig()).customAdminUrl;

  if (masterPin && typeof masterPin === 'string') {
    const principal = await findAdminByRole<ServerAdminUser>('admin_principal');
    const validPin = Boolean(security && verifyMasterCode(masterPin, security));

    if (validPin && principal) {
      const token = await establishUserSession(principal, res, ADMIN_SESSION_COOKIE, 24 * 60 * 60 * 1000);
      return res.json({
        success: true,
        user: {
          id: principal.id,
          name: principal.name,
          email: principal.email,
          role: principal.role
        },
        token,
        customAdminUrl
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Code secret Super-Administrateur incorrect.'
    });
  }

  if (email && password) {
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPass = String(password);
    let admin = await findUserByEmail<ServerAdminUser>(cleanEmail);

    if (admin && (admin.role === 'admin_principal' || admin.role === 'admin_secondaire')) {
      const isMatch = admin.passwordAlgorithm === 'pbkdf2-sha512' && admin.passwordSalt
        ? verifyPasswordSecure(cleanPass, admin.passwordHash, admin.passwordSalt)
        : admin.passwordHash === legacyHash(cleanPass) || cleanPass === admin.assignedPasswordPlainText;
      if (isMatch) {
        if (admin.assignedPasswordPlainText || !admin.passwordSalt || admin.passwordAlgorithm !== 'pbkdf2-sha512') {
          const { assignedPasswordPlainText: _legacyPassword, ...withoutLegacyPassword } = admin;
          admin = {
            ...withoutLegacyPassword,
            ...hashPasswordSecure(cleanPass),
            passwordAlgorithm: 'pbkdf2-sha512'
          };
          await updateUser(admin.id, admin);
        }
        const token = await establishUserSession(admin, res, ADMIN_SESSION_COOKIE, 24 * 60 * 60 * 1000);

        return res.json({
          success: true,
          user: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            phone: admin.phone,
            role: admin.role
          },
          token,
          customAdminUrl
        });
      }
    }

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
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
  return res.json({ success: true });
}));

app.post('/api/auth/verify', asyncRoute(async (req: Request, res: Response) => {
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
        role: user.role
      },
      customAdminUrl: (await getAdminSecuritySettings())?.customAdminUrl || (await loadConfig()).customAdminUrl
    });
  }

  return res.json({ valid: false });
}));

app.get('/api/admin/users', asyncRoute(async (_req: Request, res: Response) => {
  const admins = await listAdmins<ServerAdminUser>();
  const sanitized = admins.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    role: a.role,
    isProtected: a.isProtected,
    addedDate: a.addedDate
  }));

  res.json(sanitized);
}));

app.post('/api/admin/users', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Seul l’administrateur principal peut gérer les comptes administrateurs.' });
  }
  const { email, name, phone, role, password } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Email invalide.' });
  }
  if (role !== 'admin_secondaire') {
    return res.status(400).json({ success: false, error: 'Seul un rôle administrateur secondaire peut être attribué ici.' });
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter entre 12 et 128 caractères.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (await findUserByEmail<StoredUser>(cleanEmail)) {
    return res.status(409).json({ success: false, error: 'Un compte existe déjà avec cette adresse e-mail.' });
  }
  const { hash, salt } = hashPasswordSecure(password);
  const assignedName = name ? name.trim() : cleanEmail.split('@')[0];
  const newAdmin: ServerAdminUser = {
    id: crypto.randomUUID(),
    name: assignedName,
    email: cleanEmail,
    phone: typeof phone === 'string' ? phone.trim() : '',
    role,
    passwordHash: hash,
    passwordSalt: salt,
    passwordAlgorithm: 'pbkdf2-sha512',
    isProtected: false,
    addedDate: new Date().toLocaleDateString('fr-FR')
  };
  await createUser(newAdmin);
  return res.status(201).json({
    success: true,
    message: `Administrateur ${cleanEmail} autorisé avec succès.`,
    admin: {
      id: newAdmin.id,
      name: newAdmin.name,
      email: newAdmin.email,
      phone: newAdmin.phone,
      role: newAdmin.role,
      isProtected: false,
      addedDate: newAdmin.addedDate
    }
  });
}));

app.patch('/api/admin/users/:id/password', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Seul l’administrateur principal peut modifier un mot de passe administrateur.' });
  }
  const { id } = req.params;
  const { password } = req.body || {};
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter entre 12 et 128 caractères.' });
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
  return res.json({ success: true });
}));

app.delete('/api/admin/users/:id', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Seul l’administrateur principal peut supprimer un compte administrateur.' });
  }
  const { id } = req.params;
  const target = await findUserById<ServerAdminUser>(id);
  if (!target) return res.status(404).json({ success: false, error: 'Administrateur introuvable.' });
  if (target.isProtected) return res.status(403).json({ success: false, error: 'Impossible de supprimer le compte propriétaire protégé.' });

  const archiveId = await archiveItem('admin-user', target.id, target.name, target);
  await deleteUser(id);
  res.json({ success: true, message: `Administrateur ${target.name} déplacé dans la corbeille.`, archiveId });
}));

app.post('/api/admin/change-master-password', asyncRoute(async (req: Request, res: Response) => {
  if (!await hasPrincipalAdminSession(req)) {
    return res.status(403).json({ success: false, error: 'Une session Super-Administrateur est requise.' });
  }
  const { newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128) {
    return res.status(400).json({ success: false, error: 'Le code maître doit comporter entre 12 et 128 caractères.' });
  }
  const current = await getAdminSecuritySettings();
  if (!current) return res.status(500).json({ success: false, error: 'Configuration de sécurité introuvable.' });
  const { hash, salt } = hashInvestorPassword(newPassword);
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
  const { videoUrl } = req.body;
  if (!videoUrl || typeof videoUrl !== 'string') return res.status(400).json({ success: false, error: 'URL invalide.' });

  const config = await loadConfig();
  config.heroVideoUrl = videoUrl.trim();
  await saveConfig(config);
  res.json({ success: true, heroVideoUrl: config.heroVideoUrl });
}));

app.post('/api/admin/formations-video', asyncRoute(async (req: Request, res: Response) => {
  const { videoUrl } = req.body;
  if (!videoUrl || typeof videoUrl !== 'string') return res.status(400).json({ success: false, error: 'URL invalide.' });

  const config = await loadConfig();
  config.formationsVideoUrl = videoUrl.trim();
  await saveConfig(config);
  res.json({ success: true, formationsVideoUrl: config.formationsVideoUrl });
}));

app.post('/api/admin/maintenance', asyncRoute(async (req: Request, res: Response) => {
  const { isMaintenanceMode } = req.body;
  const config = await loadConfig();
  config.isMaintenanceMode = Boolean(isMaintenanceMode);
  await saveConfig(config);
  res.json({ success: true, isMaintenanceMode: config.isMaintenanceMode });
}));

app.post('/api/upload', asyncRoute(async (req: Request, res: Response) => {
  if (!(await hasAdminSession(req))) {
    return res.status(401).json({ success: false, error: 'Authentification administrateur requise.' });
  }

  let storage;
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
      error: 'Le stockage média Supabase n’est pas configuré sur le serveur.'
    });
  }

  const { fileBase64, mimeType } = req.body;
  let parsedUpload;
  try {
    parsedUpload = parseBase64MediaUpload(fileBase64, mimeType);
  } catch (err) {
    if (err instanceof InvalidMediaUploadError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    throw err;
  }
  const filename = `media-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${parsedUpload.extension}`;
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
    filename
  });
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


// Categories CRUD
app.get('/api/course-categories', asyncRoute(async (_req: Request, res: Response) => {
  const categories = await readJson(COURSE_CATEGORIES_FILE, [
    { id: 'electronique', name: 'Électronique & IoT', domain: 'electronique', isActive: true },
    { id: 'electrotechnique', name: 'Électrotechnique Industrielle & Puissance', domain: 'electrotechnique', isActive: true },
    { id: 'informatique', name: 'Informatique, Réseaux & Maintenance', domain: 'informatique', isActive: true }
  ]);
  res.json({ success: true, categories });
}));

app.post('/api/admin/course-categories', asyncRoute(async (req: Request, res: Response) => {
  const { name, domain } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'Nom de catégorie requis.' });

  const categories = await readJson<any[]>(COURSE_CATEGORIES_FILE, []);
  const newCat = {
    id: `cat-${Date.now()}`,
    name: name.trim(),
    domain: domain || 'electronique',
    isActive: true
  };
  categories.push(newCat);
  await writeJson(COURSE_CATEGORIES_FILE, categories);
  res.status(201).json({ success: true, category: newCat });
}));

app.put('/api/admin/course-categories/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
  const categories = await readJson<any[]>(COURSE_CATEGORIES_FILE, []);
  const idx = categories.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Catégorie introuvable.' });

  categories[idx] = { ...categories[idx], ...req.body };
  await writeJson(COURSE_CATEGORIES_FILE, categories);
  res.json({ success: true, category: categories[idx] });
}));

app.delete('/api/admin/course-categories/:id', asyncRoute(async (req: Request, res: Response) => {
  const { id } = req.params;
  const categories = await readJson<any[]>(COURSE_CATEGORIES_FILE, []);
  const remaining = categories.filter((c) => c.id !== id);
  await writeJson(COURSE_CATEGORIES_FILE, remaining);
  res.json({ success: true, message: 'Catégorie supprimée.' });
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

setInterval(() => {
  if (cleanStaleSessions()) {
    broadcastPresenceUpdate();
  }
}, 5000);

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
app.post('/api/presence/heartbeat', (req: Request, res: Response) => {
  const { sessionId, userId, userName, userEmail, userPhone, userRole, investorStatus, currentTab, pageTitle } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'Session ID requis' });
  }

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || '';
  const { deviceType, browser } = parseDeviceFromUserAgent(ua);
  const now = Date.now();

  const existing = activeSessions.get(sessionId);
  const connectedAt = existing ? existing.connectedAt : now;

  const session: ActiveUserSession = {
    sessionId,
    userId: userId || existing?.userId,
    userName: userName || existing?.userName || 'Visiteur En Ligne',
    userEmail: userEmail || existing?.userEmail,
    userPhone: userPhone || existing?.userPhone,
    userRole: userRole || existing?.userRole || 'visitor',
    investorStatus: investorStatus || existing?.investorStatus,
    currentTab: currentTab || existing?.currentTab || 'accueil',
    pageTitle: pageTitle || existing?.pageTitle || 'Portail ELECTRO-MEN',
    ip: clientIp,
    deviceType,
    browser,
    connectedAt,
    lastSeen: now
  };

  activeSessions.set(sessionId, session);
  broadcastPresenceUpdate();

  res.json({
    success: true,
    activeCount: activeSessions.size
  });
});

// Endpoint: Explicit leave
app.post('/api/presence/leave', (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (sessionId && activeSessions.has(sessionId)) {
    activeSessions.delete(sessionId);
    broadcastPresenceUpdate();
  }
  res.json({ success: true });
});

// Endpoint: Get online users snapshot
app.get('/api/presence/online-users', (_req: Request, res: Response) => {
  res.json(getPresenceSnapshot());
});

// Endpoint: Server-Sent Events stream for instant real-time updates
app.get('/api/presence/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  sseClients.add(res);

  // Send initial snapshot immediately
  res.write(`data: ${JSON.stringify(getPresenceSnapshot())}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Endpoint: Admin disconnects a session
app.post('/api/admin/disconnect-session', asyncRoute(async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (sessionId) {
    const target = activeSessions.get(sessionId);
    activeSessions.delete(sessionId);
    broadcastPresenceUpdate();
    if (target) {
      await addServerAuditLog('Admin Principal', 'disconnect_session', `Déconnexion forcée de la session de ${target.userName} (${target.ip})`, 'system', sessionId);
    }
    return res.json({ success: true, message: 'Session déconnectée.' });
  }
  res.status(400).json({ success: false, error: 'Session ID requis' });
}));

// =========================================================================
// SERVER START & VITE SPA INTEGRATION
// =========================================================================

const apiErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  console.error('Unhandled API error:', error);
  if (res.headersSent) return next(error);
  res.status(500).json({ success: false, error: 'Une erreur serveur est survenue.' });
};
app.use(apiErrorHandler);

async function startServer() {
  const initialEmail = process.env.ADMIN_INITIAL_EMAIL?.trim().toLowerCase();
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (Boolean(initialEmail) !== Boolean(initialPassword)) {
    throw new Error('ADMIN_INITIAL_EMAIL et ADMIN_INITIAL_PASSWORD doivent être configurées ensemble.');
  }
  if (initialPassword && (initialPassword.length < 12 || initialPassword.length > 128)) {
    throw new Error('ADMIN_INITIAL_PASSWORD doit comporter entre 12 et 128 caractères.');
  }
  const bootstrapAdmin: ServerAdminUser | undefined = initialEmail && initialPassword
    ? (() => {
        const { hash, salt } = hashPasswordSecure(initialPassword);
        return {
          id: crypto.randomUUID(),
          name: process.env.ADMIN_INITIAL_NAME?.trim() || 'Administrateur principal',
          email: initialEmail,
          phone: process.env.ADMIN_INITIAL_PHONE?.trim() || '',
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
    legacyAdmins: () => readLegacyAdminConfig().admins.map((admin) => {
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
  if (process.env.ADMIN_MASTER_PASSWORD && process.env.ADMIN_MASTER_PASSWORD.length < 12) {
    throw new Error('ADMIN_MASTER_PASSWORD doit comporter au moins 12 caractères.');
  }
  const initialMasterPassword = process.env.ADMIN_MASTER_PASSWORD
    ? hashInvestorPassword(process.env.ADMIN_MASTER_PASSWORD)
    : { hash: '', salt: '' };
  await initializeAdminSecurity({
    customAdminUrl: config.customAdminUrl || '/electromen-gestion',
    masterPasswordHash: initialMasterPassword.hash,
    masterPasswordSalt: initialMasterPassword.salt,
    previousAdminUrls: []
  });

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
      throw new Error(`L’investisseur ${investor.id} ne possède aucun mot de passe récupérable. Corrigez ce compte avant le démarrage.`);
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

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'Route API introuvable.' });
  });

  if (isProd) {
    app.use(express.static(distDir));
    app.use(express.static(publicDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    app.use(express.static(publicDir));
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

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
