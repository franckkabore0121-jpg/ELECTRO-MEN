import { existsSync, readFileSync, renameSync } from 'node:fs';
import { Pool, type PoolClient, type PoolConfig } from 'pg';

export interface InvestorIdentity {
  id: string;
  email: string;
  phone: string;
  walletBalance?: number;
}

export class InsufficientBalanceError extends Error {
  readonly availableBalance: number;
  readonly requestedDebit: number;

  constructor(availableBalance: number, requestedDebit: number) {
    super(`Solde insuffisant (${availableBalance.toLocaleString('fr-FR')} FCFA disponibles pour ${requestedDebit.toLocaleString('fr-FR')} FCFA demandés).`);
    this.name = 'InsufficientBalanceError';
    this.availableBalance = availableBalance;
    this.requestedDebit = requestedDebit;
  }
}

export type UserRole = 'client' | 'investor' | 'admin_principal' | 'admin_secondaire';

export interface StoredUser extends InvestorIdentity {
  role: UserRole;
}

export interface ArchivedRecord {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  parentId?: string;
  archivedAt: string;
  payload?: unknown;
}

export interface AdminSecuritySettings {
  customAdminUrl: string;
  masterPasswordHash: string;
  masterPasswordSalt: string;
  previousAdminUrls: string[];
}

export interface OperationInventory {
  operationId: string;
  totalShares: number;
  committedShares: number;
}

let pool: Pool | undefined;
let useMemoryStore = false;

// In-memory fallback stores (used when DATABASE_URL is missing or PostgreSQL is unreachable)
const memUsers = new Map<string, StoredUser>();
const memSessions = new Map<string, { userId: string; expiresAt: Date }>();
const memOtps = new Map<string, { code: string; expiresAt: Date; attempts: number }>();
const memArchives = new Map<string, ArchivedRecord & { archivedAtDate: Date }>();
const memOperationInventories = new Map<string, OperationInventory>();
let memAdminSecurity: AdminSecuritySettings | undefined;

export function isMemoryStoreActive(): boolean {
  return useMemoryStore;
}

function getPool(): Pool {
  if (!pool) {
    throw new Error('La base de données des investisseurs n’est pas initialisée.');
  }
  return pool;
}

export function getDatabasePool(): Pool {
  return getPool();
}

export async function checkUserStoreConnection(): Promise<void> {
  if (useMemoryStore) return;
  await getPool().query('SELECT 1');
}

export function normalizeInvestorEmail(email: string): string {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

export function normalizeInvestorPhone(phone: string): string | null {
  if (typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 8) return `226${digits}`;
  if (digits.length === 11 && digits.startsWith('226')) return digits;
  return digits;
}

function cloneUser<T extends StoredUser>(user: T): T {
  return JSON.parse(JSON.stringify(user)) as T;
}

function createConflictError(constraint: string): Error & { code: string; constraint: string } {
  const err = new Error(`Contrainte d'unicité violée (${constraint})`) as Error & {
    code: string;
    constraint: string;
  };
  err.code = '23505';
  err.constraint = constraint;
  return err;
}

function assertUniqueMemUser(user: StoredUser, excludeId?: string): void {
  const targetEmail = normalizeInvestorEmail(user.email);
  const targetPhone = normalizeInvestorPhone(user.phone);
  for (const existing of memUsers.values()) {
    if (excludeId && existing.id === excludeId) continue;
    if (normalizeInvestorEmail(existing.email) === targetEmail) {
      throw createConflictError('app_users_email_normalized_key');
    }
    if (
      targetPhone &&
      (user.role === 'client' || user.role === 'investor') &&
      (existing.role === 'client' || existing.role === 'investor') &&
      normalizeInvestorPhone(existing.phone) === targetPhone
    ) {
      throw createConflictError('app_users_phone_unique_idx');
    }
  }
}

function insertMemLegacyUser(user: StoredUser): void {
  const email = normalizeInvestorEmail(user.email);
  const existing = Array.from(memUsers.values()).find(
    (candidate) => normalizeInvestorEmail(candidate.email) === email
  );
  if (!existing) {
    memUsers.set(user.id, cloneUser(user));
    return;
  }
  if (existing.role === 'investor' && (user.role === 'admin_principal' || user.role === 'admin_secondaire')) {
    const cleaned = { ...existing } as StoredUser & Record<string, unknown>;
    delete cleaned.assignedPassword;
    delete cleaned.assignedPasswordPlainText;
    memUsers.set(existing.id, { ...cleaned, ...cloneUser(user), id: existing.id });
  }
}

function insertMemBootstrapAdmin(user: StoredUser): void {
  const email = normalizeInvestorEmail(user.email);
  const existing = Array.from(memUsers.values()).find(
    (candidate) => normalizeInvestorEmail(candidate.email) === email
  );
  if (!existing) {
    memUsers.set(user.id, cloneUser(user));
    return;
  }
  if (existing.role === 'investor' || existing.role === 'admin_secondaire') {
    const cleaned = { ...existing } as StoredUser & Record<string, unknown>;
    delete cleaned.assignedPassword;
    delete cleaned.assignedPasswordPlainText;
    memUsers.set(existing.id, { ...cleaned, ...cloneUser(user), role: 'admin_principal', id: existing.id });
  }
}

async function insertInvestor(client: Pick<PoolClient, 'query'>, investor: InvestorIdentity): Promise<void> {
  await insertUser(client, { ...investor, role: 'investor' } as StoredUser);
}

async function insertUser(client: Pick<PoolClient, 'query'>, user: StoredUser): Promise<void> {
  await client.query(
    `INSERT INTO app_users (id, email_normalized, phone_normalized, role, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      user.id,
      normalizeInvestorEmail(user.email),
      normalizeInvestorPhone(user.phone),
      user.role,
      JSON.stringify(user)
    ]
  );
}

async function insertLegacyUser(client: Pick<PoolClient, 'query'>, user: StoredUser): Promise<void> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO app_users (id, email_normalized, phone_normalized, role, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (email_normalized) DO UPDATE
     SET phone_normalized = EXCLUDED.phone_normalized,
         role = EXCLUDED.role,
         payload = (app_users.payload - 'assignedPassword' - 'assignedPasswordPlainText')
           || EXCLUDED.payload
           || jsonb_build_object('id', app_users.id)
     WHERE app_users.role = 'investor'
       AND EXCLUDED.role IN ('admin_principal', 'admin_secondaire')
     RETURNING id`,
    [
      user.id,
      normalizeInvestorEmail(user.email),
      normalizeInvestorPhone(user.phone),
      user.role,
      JSON.stringify(user)
    ]
  );
  if (rows.length > 0) return;

  const { rows: existingUsers } = await client.query<{ role: UserRole }>(
    'SELECT role FROM app_users WHERE email_normalized = $1',
    [normalizeInvestorEmail(user.email)]
  );
  const existingRole = existingUsers[0]?.role;
  if (
    (existingRole === 'admin_principal' || existingRole === 'admin_secondaire') &&
    (user.role === 'client' || user.role === 'investor')
  ) {
    return;
  }
  throw new Error(
    'Plusieurs comptes hérités de rôles incompatibles utilisent la même adresse e-mail ; corrigez ces doublons avant la migration.'
  );
}

async function insertBootstrapAdmin(client: Pick<PoolClient, 'query'>, user: StoredUser): Promise<void> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO app_users (id, email_normalized, phone_normalized, role, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (email_normalized) DO UPDATE
     SET phone_normalized = EXCLUDED.phone_normalized,
         role = 'admin_principal',
         payload = (app_users.payload - 'assignedPassword' - 'assignedPasswordPlainText')
           || EXCLUDED.payload
           || jsonb_build_object('id', app_users.id)
     WHERE app_users.role IN ('client', 'investor', 'admin_secondaire')
     RETURNING id`,
    [
      user.id,
      normalizeInvestorEmail(user.email),
      normalizeInvestorPhone(user.phone),
      user.role,
      JSON.stringify(user)
    ]
  );
  if (rows.length > 0) return;

  const { rows: existingUsers } = await client.query<{ role: UserRole }>(
    'SELECT role FROM app_users WHERE email_normalized = $1',
    [normalizeInvestorEmail(user.email)]
  );
  if (existingUsers[0]?.role !== 'admin_principal') {
    throw new Error(
      'Impossible de créer l’administrateur principal : l’adresse configurée est déjà utilisée par un autre compte.'
    );
  }
}

function readLegacyUsers(filePath: string): StoredUser[] {
  for (const candidate of [filePath, `${filePath}.migrated`]) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(candidate, 'utf8'));
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (user): user is StoredUser =>
          typeof user === 'object' &&
          user !== null &&
          typeof (user as StoredUser).id === 'string' &&
          typeof (user as StoredUser).email === 'string' &&
          typeof (user as StoredUser).phone === 'string'
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return [];
}

function initializeMemoryUserStore(options: {
  legacyInvestorFile: string;
  legacyClientFile: string;
  legacyAdmins: () => StoredUser[];
  bootstrapAdmin?: StoredUser;
}): void {
  useMemoryStore = true;
  memUsers.clear();
  memSessions.clear();
  memOtps.clear();
  memArchives.clear();
  memOperationInventories.clear();
  memAdminSecurity = undefined;

  for (const user of readLegacyUsers(options.legacyClientFile)) {
    insertMemLegacyUser({ ...user, role: 'client' });
  }
  for (const user of readLegacyUsers(options.legacyInvestorFile)) {
    insertMemLegacyUser({ ...user, role: 'investor' });
  }
  for (const admin of options.legacyAdmins()) {
    if (admin.role === 'admin_principal' || admin.role === 'admin_secondaire') {
      insertMemLegacyUser(admin);
    }
  }
  if (options.bootstrapAdmin) {
    insertMemBootstrapAdmin(options.bootstrapAdmin);
  }

  const hasPrincipal = Array.from(memUsers.values()).some((u) => u.role === 'admin_principal');
  if (!hasPrincipal) {
    console.warn('[AI Studio] Mode mémoire actif sans administrateur principal configuré (ADMIN_INITIAL_EMAIL / ADMIN_INITIAL_PASSWORD).');
  }
}

export function buildPostgresPoolConfig(connectionString: string, isVercel: boolean): PoolConfig {
  const base: PoolConfig = {
    connectionString,
    max: isVercel ? 3 : 10,
    idleTimeoutMillis: isVercel ? 10000 : 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: isVercel
  };

  try {
    const parsed = new URL(connectionString);
    const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase();
    const hasRootCert = parsed.searchParams.has('sslrootcert');
    const hostname = parsed.hostname.toLowerCase();
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    const isNeonHost = hostname.endsWith('.neon.tech') || hostname.endsWith('.neon.build');
    const isSupabaseHost = hostname.endsWith('.supabase.co') || hostname.endsWith('.supabase.com');

    if (sslMode === 'disable' || sslMode === 'verify-full' || hasRootCert) {
      return base;
    }

    if (
      sslMode === 'require' ||
      sslMode === 'prefer' ||
      sslMode === 'verify-ca' ||
      sslMode === 'no-verify' ||
      isNeonHost ||
      isSupabaseHost ||
      (isVercel && !isLocalHost)
    ) {
      // pg-connection-string >= 2.x treats sslmode=require/prefer/verify-ca as verify-full
      // and overwrites Pool's ssl option inside pg.Client unless sslmode is stripped.
      parsed.searchParams.delete('sslmode');
      return {
        ...base,
        connectionString: parsed.toString(),
        ssl: { rejectUnauthorized: false }
      };
    }
  } catch {
    if (isVercel) {
      return {
        ...base,
        ssl: { rejectUnauthorized: false }
      };
    }
  }

  return base;
}

export async function initializeUserStore(options: {
  legacyInvestorFile: string;
  legacyClientFile: string;
  legacyAdmins: () => StoredUser[];
  bootstrapAdmin?: StoredUser;
}): Promise<void> {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.warn('[AI Studio] DATABASE_URL non configurée — utilisation du stockage en mémoire.');
    initializeMemoryUserStore(options);
    return;
  }

  useMemoryStore = false;
  const isVercel = Boolean(process.env.VERCEL);
  pool = new Pool(buildPostgresPoolConfig(connectionString, isVercel));
  pool.on('error', (poolErr) => {
    console.error('[PostgreSQL Pool Error]', poolErr.message);
  });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      email_normalized TEXT NOT NULL,
      phone_normalized TEXT,
      role TEXT NOT NULL CHECK (role IN ('client', 'investor', 'admin_principal', 'admin_secondaire')),
      payload JSONB NOT NULL,
      CONSTRAINT app_users_email_normalized_key UNIQUE (email_normalized)
      )
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS app_users_phone_unique_idx
      ON app_users (phone_normalized)
      WHERE phone_normalized IS NOT NULL AND role IN ('client', 'investor')
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON app_sessions (expires_at)');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_otps (
        email_normalized TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_archives (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        label TEXT NOT NULL,
        parent_id TEXT,
        payload JSONB NOT NULL,
        archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS app_archives_archived_at_idx ON app_archives (archived_at DESC)');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_admin_security (
        singleton_id SMALLINT PRIMARY KEY CHECK (singleton_id = 1),
        custom_admin_url TEXT NOT NULL,
        master_password_hash TEXT NOT NULL,
        master_password_salt TEXT NOT NULL,
        previous_admin_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_operation_inventory (
        operation_id TEXT PRIMARY KEY,
        total_shares INTEGER NOT NULL CHECK (total_shares >= 0),
        committed_shares INTEGER NOT NULL DEFAULT 0 CHECK (committed_shares >= 0)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_data_migrations (
        resource_key TEXT PRIMARY KEY,
        source_file TEXT NOT NULL,
        source_present BOOLEAN NOT NULL,
        imported_count INTEGER NOT NULL DEFAULT 0,
        explicitly_written BOOLEAN NOT NULL DEFAULT FALSE,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('electromen-user-store-migration'))`);
      const { rows: legacyTable } = await client.query<{ exists: boolean }>(
        `SELECT to_regclass('public.investors') IS NOT NULL AS exists`
      );
      if (legacyTable[0]?.exists) {
        const { rows } = await client.query<{ payload: StoredUser }>('SELECT payload FROM investors');
        const count = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM app_users WHERE role = 'investor'`
        );
        if (count.rows[0]?.count === '0') {
          for (const user of rows) await insertLegacyUser(client, { ...user.payload, role: 'investor' });
        }
      }

      const legacySets: Array<{ role: UserRole; filePath: string }> = [
        { role: 'client', filePath: options.legacyClientFile },
        { role: 'investor', filePath: options.legacyInvestorFile }
      ];

      for (const { role, filePath } of legacySets) {
        const migrationKey = `legacy-${role}`;
        const { rows: migration } = await client.query(
          'SELECT 1 FROM app_data_migrations WHERE resource_key = $1',
          [migrationKey]
        );
        if (migration.length > 0) continue;

        const { rows } = await client.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM app_users WHERE role = $1',
          [role]
        );
        const users = rows[0]?.count === '0'
          ? readLegacyUsers(filePath).map((user) => ({ ...user, role }))
          : [];
        if (rows[0]?.count === '0') {
          for (const user of users) {
            try {
              await insertLegacyUser(client, user);
            } catch (error) {
              if ((error as { code?: string }).code !== '23505' || (error as { constraint?: string }).constraint !== 'app_users_pkey') {
                throw error;
              }
            }
          }
        }
        await client.query(
          `INSERT INTO app_data_migrations (resource_key, source_file, source_present, imported_count)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (resource_key) DO NOTHING`,
          [migrationKey, filePath, existsSync(filePath) || existsSync(`${filePath}.migrated`), users.length]
        );
      }

      const { rows: adminMigration } = await client.query(
        'SELECT 1 FROM app_data_migrations WHERE resource_key = $1',
        ['legacy-admins']
      );
      if (adminMigration.length === 0) {
        let legacyAdmins: StoredUser[] | undefined;
        for (const role of ['admin_principal', 'admin_secondaire'] as const) {
          const { rows } = await client.query<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM app_users WHERE role = $1',
            [role]
          );
          if (rows[0]?.count !== '0') continue;

          legacyAdmins ??= options.legacyAdmins();
          for (const user of legacyAdmins.filter((candidate) => candidate.role === role)) {
            await insertLegacyUser(client, user);
          }
        }
        await client.query(
          `INSERT INTO app_data_migrations (resource_key, source_file, source_present, imported_count)
           VALUES ('legacy-admins', 'admin-config.json', $1, $2)
           ON CONFLICT (resource_key) DO NOTHING`,
          [Boolean(legacyAdmins?.length), legacyAdmins?.length ?? 0]
        );
      }

      if (options.bootstrapAdmin) {
        const { rows: principals } = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM app_users WHERE role = 'admin_principal'`
        );
        const { rows: matchingUsers } = await client.query<{ role: UserRole }>(
          'SELECT role FROM app_users WHERE email_normalized = $1',
          [normalizeInvestorEmail(options.bootstrapAdmin.email)]
        );
        if (
          matchingUsers[0]?.role
            ? matchingUsers[0].role !== 'admin_principal'
            : principals[0]?.count === '0'
        ) {
          await insertBootstrapAdmin(client, options.bootstrapAdmin);
        }
      }

      const { rows: principals } = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM app_users WHERE role = 'admin_principal'`
      );
      if (principals[0]?.count === '0') {
        console.warn('[AI Studio] Aucun administrateur principal en base. Configurez ADMIN_INITIAL_EMAIL et ADMIN_INITIAL_PASSWORD pour initialiser le compte principal.');
      }

      const { rows: sessionTable } = await client.query<{ exists: boolean }>(
        `SELECT to_regclass('public.investor_sessions') IS NOT NULL AS exists`
      );
      if (sessionTable[0]?.exists) {
        await client.query(`
          INSERT INTO app_sessions (token_hash, user_id, expires_at)
          SELECT s.token_hash, s.investor_id, s.expires_at
          FROM investor_sessions s
          JOIN app_users u ON u.id = s.investor_id AND u.role = 'investor'
          ON CONFLICT (token_hash) DO NOTHING
        `);
        await client.query('DROP TABLE investor_sessions');
      }
      if (legacyTable[0]?.exists) await client.query('DROP TABLE investors');

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error('Initialisation/migration des comptes vers PostgreSQL échouée.', { cause: error });
    } finally {
      client.release();
    }
    if (!process.env.VERCEL) {
      for (const legacyPath of [options.legacyInvestorFile, options.legacyClientFile]) {
        if (existsSync(legacyPath)) {
          try {
            renameSync(legacyPath, `${legacyPath}.migrated`);
          } catch (renameErr) {
            console.warn('[AI Studio] Impossible de renommer le fichier hérité:', (renameErr as Error).message);
          }
        }
      }
    }
  } catch (error) {
    await pool.end().catch(() => {});
    pool = undefined;
    if (process.env.VERCEL) {
      throw error;
    }
    console.warn('[AI Studio] PostgreSQL indisponible — basculement vers le stockage en mémoire:', (error as Error).message);
    initializeMemoryUserStore(options);
  }
}

export async function initializeAdminSecurity(settings: AdminSecuritySettings): Promise<void> {
  if (useMemoryStore) {
    if (!memAdminSecurity) {
      memAdminSecurity = { ...settings, previousAdminUrls: [...settings.previousAdminUrls] };
    }
    return;
  }
  await getPool().query(
    `INSERT INTO app_admin_security
       (singleton_id, custom_admin_url, master_password_hash, master_password_salt, previous_admin_urls)
     VALUES (1, $1, $2, $3, $4::jsonb)
     ON CONFLICT (singleton_id) DO NOTHING`,
    [
      settings.customAdminUrl,
      settings.masterPasswordHash,
      settings.masterPasswordSalt,
      JSON.stringify(settings.previousAdminUrls)
    ]
  );
}

export async function getAdminSecuritySettings(): Promise<AdminSecuritySettings | undefined> {
  if (useMemoryStore) {
    return memAdminSecurity
      ? { ...memAdminSecurity, previousAdminUrls: [...memAdminSecurity.previousAdminUrls] }
      : undefined;
  }
  const { rows } = await getPool().query<{
    custom_admin_url: string;
    master_password_hash: string;
    master_password_salt: string;
    previous_admin_urls: string[];
  }>(
    `SELECT custom_admin_url, master_password_hash, master_password_salt, previous_admin_urls
     FROM app_admin_security WHERE singleton_id = 1`
  );
  const settings = rows[0];
  return settings
    ? {
        customAdminUrl: settings.custom_admin_url,
        masterPasswordHash: settings.master_password_hash,
        masterPasswordSalt: settings.master_password_salt,
        previousAdminUrls: settings.previous_admin_urls || []
      }
    : undefined;
}

export async function updateAdminSecuritySettings(settings: AdminSecuritySettings): Promise<void> {
  if (useMemoryStore) {
    memAdminSecurity = { ...settings, previousAdminUrls: [...settings.previousAdminUrls] };
    return;
  }
  await getPool().query(
    `UPDATE app_admin_security
     SET custom_admin_url = $1, master_password_hash = $2, master_password_salt = $3,
         previous_admin_urls = $4::jsonb, updated_at = NOW()
     WHERE singleton_id = 1`,
    [
      settings.customAdminUrl,
      settings.masterPasswordHash,
      settings.masterPasswordSalt,
      JSON.stringify(settings.previousAdminUrls)
    ]
  );
}

export async function createArchiveRecord(record: ArchivedRecord & { payload: unknown }): Promise<void> {
  if (useMemoryStore) {
    const now = record.archivedAt ? new Date(record.archivedAt) : new Date();
    memArchives.set(record.id, {
      ...record,
      archivedAt: now.toISOString(),
      archivedAtDate: now
    });
    return;
  }
  await getPool().query(
    `INSERT INTO app_archives (id, entity_type, entity_id, label, parent_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [record.id, record.entityType, record.entityId, record.label, record.parentId || null, JSON.stringify(record.payload)]
  );
}

export async function listArchiveRecords(): Promise<ArchivedRecord[]> {
  if (useMemoryStore) {
    return Array.from(memArchives.values())
      .sort((a, b) => b.archivedAtDate.getTime() - a.archivedAtDate.getTime())
      .map(({ payload: _payload, archivedAtDate: _date, ...record }) => record);
  }
  const { rows } = await getPool().query<{
    id: string;
    entity_type: string;
    entity_id: string;
    label: string;
    parent_id: string | null;
    archived_at: Date;
  }>(
    `SELECT id, entity_type, entity_id, label, parent_id, archived_at
     FROM app_archives ORDER BY archived_at DESC`
  );
  return rows.map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    label: row.label,
    parentId: row.parent_id || undefined,
    archivedAt: row.archived_at.toISOString()
  }));
}

export async function findArchiveRecord(id: string): Promise<ArchivedRecord | undefined> {
  if (useMemoryStore) {
    const record = memArchives.get(id);
    if (!record) return undefined;
    const { archivedAtDate: _date, ...rest } = record;
    return rest;
  }
  const { rows } = await getPool().query<{
    id: string;
    entity_type: string;
    entity_id: string;
    label: string;
    parent_id: string | null;
    payload: unknown;
    archived_at: Date;
  }>(
    `SELECT id, entity_type, entity_id, label, parent_id, payload, archived_at
     FROM app_archives WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  return row
    ? {
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        label: row.label,
        parentId: row.parent_id || undefined,
        payload: row.payload,
        archivedAt: row.archived_at.toISOString()
      }
    : undefined;
}

export async function deleteArchiveRecord(id: string): Promise<void> {
  if (useMemoryStore) {
    memArchives.delete(id);
    return;
  }
  await getPool().query('DELETE FROM app_archives WHERE id = $1', [id]);
}

export async function initializeOperationInventory(inventories: OperationInventory[]): Promise<void> {
  if (useMemoryStore) {
    for (const inventory of inventories) {
      const existing = memOperationInventories.get(inventory.operationId);
      if (existing) {
        existing.totalShares = Math.max(inventory.totalShares, existing.committedShares);
      } else {
        memOperationInventories.set(inventory.operationId, { ...inventory });
      }
    }
    return;
  }
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (const inventory of inventories) {
      await client.query(
        `INSERT INTO app_operation_inventory (operation_id, total_shares, committed_shares)
         VALUES ($1, $2, $3)
         ON CONFLICT (operation_id) DO UPDATE
         SET total_shares = GREATEST(EXCLUDED.total_shares, app_operation_inventory.committed_shares)`,
        [inventory.operationId, inventory.totalShares, inventory.committedShares]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOperationInventory(operationId: string, totalShares: number): Promise<boolean> {
  if (useMemoryStore) {
    const existing = memOperationInventories.get(operationId);
    if (!existing || existing.committedShares > totalShares) return false;
    existing.totalShares = totalShares;
    return true;
  }
  const result = await getPool().query(
    `UPDATE app_operation_inventory
     SET total_shares = $2
     WHERE operation_id = $1 AND committed_shares <= $2`,
    [operationId, totalShares]
  );
  return result.rowCount === 1;
}

export async function listOperationInventories(): Promise<OperationInventory[]> {
  if (useMemoryStore) {
    return Array.from(memOperationInventories.values()).map((item) => ({ ...item }));
  }
  const { rows } = await getPool().query<{
    operation_id: string;
    total_shares: number;
    committed_shares: number;
  }>(
    `SELECT operation_id, total_shares, committed_shares FROM app_operation_inventory`
  );
  return rows.map((row) => ({
    operationId: row.operation_id,
    totalShares: row.total_shares,
    committedShares: row.committed_shares
  }));
}

export async function reserveOperationShares(operationId: string, count: number): Promise<boolean> {
  if (typeof operationId !== 'string' || !operationId.trim() || !Number.isSafeInteger(count) || count < 1) {
    return false;
  }
  if (useMemoryStore) {
    const existing = memOperationInventories.get(operationId);
    if (!existing || existing.committedShares + count > existing.totalShares) return false;
    existing.committedShares += count;
    return true;
  }
  const result = await getPool().query(
    `UPDATE app_operation_inventory
     SET committed_shares = committed_shares + $2
     WHERE operation_id = $1 AND committed_shares + $2 <= total_shares`,
    [operationId, count]
  );
  return result.rowCount === 1;
}

export async function releaseOperationShares(operationId: string, count: number): Promise<void> {
  if (typeof operationId !== 'string' || !operationId.trim() || !Number.isSafeInteger(count) || count < 1) {
    return;
  }
  if (useMemoryStore) {
    const existing = memOperationInventories.get(operationId);
    if (existing) existing.committedShares = Math.max(0, existing.committedShares - count);
    return;
  }
  await getPool().query(
    `UPDATE app_operation_inventory
     SET committed_shares = GREATEST(0, committed_shares - $2)
     WHERE operation_id = $1`,
    [operationId, count]
  );
}

export async function listInvestors<T extends InvestorIdentity>(): Promise<T[]> {
  if (useMemoryStore) {
    return Array.from(memUsers.values())
      .filter((user) => user.role === 'investor')
      .map((user) => cloneUser(user) as unknown as T);
  }
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    `SELECT payload, role FROM app_users WHERE role = 'investor'`
  );
  return rows.map((row) => ({ ...row.payload, role: row.role }));
}

export async function findInvestorByIdentifier<T extends InvestorIdentity>(identifier: string): Promise<T | undefined> {
  if (typeof identifier !== 'string' || !identifier.trim()) return undefined;
  const normalizedEmail = normalizeInvestorEmail(identifier);
  const normalizedPhone = normalizeInvestorPhone(identifier);
  if (useMemoryStore) {
    const normalizedId = identifier.trim().toLowerCase();
    for (const user of memUsers.values()) {
      if (user.role !== 'investor') continue;
      if (
        normalizeInvestorEmail(user.email) === normalizedEmail ||
        user.id.toLowerCase() === normalizedId ||
        (normalizedPhone !== null && normalizeInvestorPhone(user.phone) === normalizedPhone)
      ) {
        return cloneUser(user) as unknown as T;
      }
    }
    return undefined;
  }
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    `SELECT payload, role FROM app_users
     WHERE role = 'investor'
       AND (email_normalized = $1 OR lower(id) = $2 OR ($3::text IS NOT NULL AND phone_normalized = $3))
     LIMIT 1`,
    [normalizedEmail, identifier.trim().toLowerCase(), normalizedPhone]
  );
  return rows[0] ? { ...rows[0].payload, role: rows[0].role } : undefined;
}

export async function findInvestorByEmail<T extends InvestorIdentity>(email: string): Promise<T | undefined> {
  if (useMemoryStore) {
    const target = normalizeInvestorEmail(email);
    for (const user of memUsers.values()) {
      if (user.role === 'investor' && normalizeInvestorEmail(user.email) === target) {
        return cloneUser(user) as unknown as T;
      }
    }
    return undefined;
  }
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    `SELECT payload, role FROM app_users WHERE role = 'investor' AND email_normalized = $1 LIMIT 1`,
    [normalizeInvestorEmail(email)]
  );
  return rows[0] ? { ...rows[0].payload, role: rows[0].role } : undefined;
}

export async function findInvestorByPhoneAndEmail<T extends InvestorIdentity>(
  phone: string,
  email: string
): Promise<T | undefined> {
  if (useMemoryStore) {
    const targetPhone = normalizeInvestorPhone(phone);
    const targetEmail = normalizeInvestorEmail(email);
    for (const user of memUsers.values()) {
      if (
        user.role === 'investor' &&
        normalizeInvestorPhone(user.phone) === targetPhone &&
        normalizeInvestorEmail(user.email) === targetEmail
      ) {
        return cloneUser(user) as unknown as T;
      }
    }
    return undefined;
  }
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    `SELECT payload, role
     FROM app_users
     WHERE role = 'investor'
       AND phone_normalized = $1
       AND email_normalized = $2
     LIMIT 1`,
    [normalizeInvestorPhone(phone), normalizeInvestorEmail(email)]
  );
  return rows[0] ? { ...rows[0].payload, role: rows[0].role } : undefined;
}

export async function createInvestor<T extends InvestorIdentity>(investor: T): Promise<void> {
  if (useMemoryStore) {
    const stored = { ...investor, role: 'investor' } as StoredUser;
    assertUniqueMemUser(stored);
    memUsers.set(stored.id, cloneUser(stored));
    return;
  }
  await insertInvestor(getPool(), investor);
}

export async function updateInvestor<T extends InvestorIdentity>(
  id: string,
  update: (investor: T) => T
): Promise<T | undefined> {
  if (useMemoryStore) {
    const current = memUsers.get(id);
    if (!current || current.role !== 'investor') return undefined;
    const updated = update(cloneUser(current) as unknown as T);
    const nextUser = { ...updated, role: 'investor' } as StoredUser;
    assertUniqueMemUser(nextUser, id);
    memUsers.set(id, cloneUser(nextUser));
    return updated;
  }
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ payload: T }>(
      `SELECT payload FROM app_users WHERE id = $1 AND role = 'investor' FOR UPDATE`,
      [id]
    );
    if (!rows[0]) {
      await client.query('COMMIT');
      return undefined;
    }

    const updated = update(rows[0].payload);
    const previousEmail = normalizeInvestorEmail(rows[0].payload.email);
    const updatedEmail = normalizeInvestorEmail(updated.email);
    await client.query(
      `UPDATE app_users
       SET email_normalized = $2, phone_normalized = $3, payload = $4::jsonb
       WHERE id = $1`,
      [
        id,
        normalizeInvestorEmail(updated.email),
        normalizeInvestorPhone(updated.phone),
        JSON.stringify(updated)
      ]
    );
    if (previousEmail !== updatedEmail) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['electromen-data-subscriptions']);
      await client.query(
        `UPDATE app_subscriptions
         SET payload = jsonb_set(
           jsonb_set(payload, '{investorEmail}', to_jsonb($2::text), true),
           '{investor_email}', to_jsonb($2::text), true
         )
         WHERE NULLIF(btrim(payload->>'investorId'), '') IS NULL
           AND NULLIF(btrim(payload->>'investor_id'), '') IS NULL
           AND NULLIF(btrim(payload->>'userId'), '') IS NULL
           AND NULLIF(btrim(payload->>'user_id'), '') IS NULL
           AND (
             lower(btrim(payload->>'investorEmail')) = $1
             OR lower(btrim(payload->>'investor_email')) = $1
           )`,
        [previousEmail, updatedEmail]
      );
    }
    await client.query('COMMIT');
    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function adjustInvestorWalletBalance<T extends InvestorIdentity>(
  idOrEmail: string,
  delta: number
): Promise<{ investor: T; previousBalance: number; newBalance: number } | undefined> {
  if (!Number.isSafeInteger(delta)) {
    throw new Error('La variation du solde doit être un entier valide.');
  }

  const target = await findInvestorByIdentifier<T>(idOrEmail);
  if (!target) return undefined;

  if (useMemoryStore) {
    const current = memUsers.get(target.id);
    if (!current || current.role !== 'investor') return undefined;
    const rawBalance = (current as unknown as T).walletBalance;
    const previousBalance = Number.isSafeInteger(rawBalance) && (rawBalance as number) >= 0 ? (rawBalance as number) : 0;
    const newBalance = previousBalance + delta;
    if (newBalance < 0) {
      throw new InsufficientBalanceError(previousBalance, Math.abs(delta));
    }
    const updated = { ...cloneUser(current), walletBalance: newBalance } as unknown as T;
    memUsers.set(target.id, cloneUser(updated as unknown as StoredUser));
    return { investor: updated, previousBalance, newBalance };
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ payload: T }>(
      `SELECT payload FROM app_users WHERE id = $1 AND role = 'investor' FOR UPDATE`,
      [target.id]
    );
    if (!rows[0]) {
      await client.query('COMMIT');
      return undefined;
    }
    const rawBalance = rows[0].payload.walletBalance;
    const previousBalance = Number.isSafeInteger(rawBalance) && (rawBalance as number) >= 0 ? (rawBalance as number) : 0;
    const newBalance = previousBalance + delta;
    if (newBalance < 0) {
      throw new InsufficientBalanceError(previousBalance, Math.abs(delta));
    }
    const updated: T = { ...rows[0].payload, walletBalance: newBalance };
    await client.query(
      `UPDATE app_users SET payload = $2::jsonb WHERE id = $1`,
      [target.id, JSON.stringify(updated)]
    );
    await client.query('COMMIT');
    return { investor: updated, previousBalance, newBalance };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteInvestor(id: string): Promise<boolean> {
  if (useMemoryStore) {
    const existing = memUsers.get(id);
    if (!existing || existing.role !== 'investor') return false;
    memUsers.delete(id);
    for (const [token, session] of memSessions.entries()) {
      if (session.userId === id) memSessions.delete(token);
    }
    return true;
  }
  const result = await getPool().query(`DELETE FROM app_users WHERE id = $1 AND role = 'investor'`, [id]);
  return result.rowCount === 1;
}

export async function replaceInvestors<T extends InvestorIdentity>(investors: T[]): Promise<void> {
  if (useMemoryStore) {
    for (const [id, user] of memUsers.entries()) {
      if (user.role === 'investor') memUsers.delete(id);
    }
    for (const investor of investors) {
      const stored = { ...investor, role: 'investor' } as StoredUser;
      memUsers.set(stored.id, cloneUser(stored));
    }
    return;
  }
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM app_users WHERE role = 'investor'`);
    for (const investor of investors) {
      await insertInvestor(client, investor);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function replaceUsersByRole<T extends StoredUser>(role: UserRole, users: T[]): Promise<void> {
  if (useMemoryStore) {
    for (const [id, user] of memUsers.entries()) {
      if (user.role === role) memUsers.delete(id);
    }
    for (const user of users) {
      memUsers.set(user.id, cloneUser(user));
    }
    return;
  }
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM app_users WHERE role = $1', [role]);
    for (const user of users) await insertUser(client, user);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createInvestorSession(tokenHash: string, investorId: string, expiresAt: Date): Promise<void> {
  if (useMemoryStore) {
    memSessions.set(tokenHash, { userId: investorId, expiresAt });
    return;
  }
  await getPool().query(
    'INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [tokenHash, investorId, expiresAt]
  );
}

export async function findInvestorBySession<T extends InvestorIdentity>(tokenHash: string): Promise<T | undefined> {
  if (useMemoryStore) {
    const session = memSessions.get(tokenHash);
    if (!session || session.expiresAt.getTime() <= Date.now()) return undefined;
    const user = memUsers.get(session.userId);
    if (!user || user.role !== 'investor') return undefined;
    return cloneUser(user) as unknown as T;
  }
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    `SELECT i.payload, i.role
     FROM app_sessions s
     JOIN app_users i ON i.id = s.user_id AND i.role = 'investor'
     WHERE s.token_hash = $1 AND s.expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] ? { ...rows[0].payload, role: rows[0].role } : undefined;
}

export async function deleteInvestorSession(tokenHash: string): Promise<void> {
  if (useMemoryStore) {
    memSessions.delete(tokenHash);
    return;
  }
  await getPool().query('DELETE FROM app_sessions WHERE token_hash = $1', [tokenHash]);
}

export async function deleteOtherInvestorSessions(investorId: string, currentTokenHash: string): Promise<void> {
  if (useMemoryStore) {
    for (const [token, session] of memSessions.entries()) {
      if (session.userId === investorId && token !== currentTokenHash) memSessions.delete(token);
    }
    return;
  }
  await getPool().query(
    'DELETE FROM app_sessions WHERE user_id = $1 AND token_hash <> $2',
    [investorId, currentTokenHash]
  );
}

export async function deleteInvestorSessions(investorId: string): Promise<void> {
  if (useMemoryStore) {
    for (const [token, session] of memSessions.entries()) {
      if (session.userId === investorId) memSessions.delete(token);
    }
    return;
  }
  await getPool().query('DELETE FROM app_sessions WHERE user_id = $1', [investorId]);
}

export async function createUser<T extends StoredUser>(user: T): Promise<void> {
  if (useMemoryStore) {
    assertUniqueMemUser(user);
    memUsers.set(user.id, cloneUser(user));
    return;
  }
  await insertUser(getPool(), user);
}

export async function createUserWithOtp<T extends StoredUser>(
  user: T,
  code: string,
  expiresAt: Date
): Promise<void> {
  if (useMemoryStore) {
    assertUniqueMemUser(user);
    memUsers.set(user.id, cloneUser(user));
    memOtps.set(normalizeInvestorEmail(user.email), { code, expiresAt, attempts: 0 });
    return;
  }
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await insertUser(client, user);
    await client.query(
      `INSERT INTO user_otps (email_normalized, code, expires_at, attempts)
       VALUES ($1, $2, $3, 0)`,
      [normalizeInvestorEmail(user.email), code, expiresAt]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function findUserByEmail<T extends StoredUser>(email: string): Promise<T | undefined> {
  if (useMemoryStore) {
    const target = normalizeInvestorEmail(email);
    for (const user of memUsers.values()) {
      if (normalizeInvestorEmail(user.email) === target) return cloneUser(user) as T;
    }
    return undefined;
  }
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    'SELECT payload, role FROM app_users WHERE email_normalized = $1 LIMIT 1',
    [normalizeInvestorEmail(email)]
  );
  return rows[0] ? { ...rows[0].payload, role: rows[0].role } : undefined;
}

export async function findUserById<T extends StoredUser>(id: string): Promise<T | undefined> {
  if (useMemoryStore) {
    const user = memUsers.get(id);
    return user ? (cloneUser(user) as T) : undefined;
  }
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    'SELECT payload, role FROM app_users WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] ? { ...rows[0].payload, role: rows[0].role } : undefined;
}

export async function findAdminByRole<T extends StoredUser>(role: 'admin_principal' | 'admin_secondaire'): Promise<T | undefined> {
  if (useMemoryStore) {
    const matches = Array.from(memUsers.values())
      .filter((u) => u.role === role)
      .sort((a, b) => a.id.localeCompare(b.id));
    return matches[0] ? (cloneUser(matches[0]) as T) : undefined;
  }
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    'SELECT payload, role FROM app_users WHERE role = $1 ORDER BY id LIMIT 1',
    [role]
  );
  return rows[0] ? { ...rows[0].payload, role: rows[0].role } : undefined;
}

export async function listAdmins<T extends StoredUser>(): Promise<T[]> {
  if (useMemoryStore) {
    return Array.from(memUsers.values())
      .filter((u) => u.role === 'admin_principal' || u.role === 'admin_secondaire')
      .map((u) => cloneUser(u) as T);
  }
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    `SELECT payload, role FROM app_users WHERE role IN ('admin_principal', 'admin_secondaire')`
  );
  return rows.map((row) => ({ ...row.payload, role: row.role }));
}

export async function listUsersByRole<T extends StoredUser>(role: UserRole): Promise<T[]> {
  if (useMemoryStore) {
    return Array.from(memUsers.values())
      .filter((u) => u.role === role)
      .map((u) => cloneUser(u) as T);
  }
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    'SELECT payload, role FROM app_users WHERE role = $1',
    [role]
  );
  return rows.map((row) => ({ ...row.payload, role: row.role }));
}

export async function updateUser<T extends StoredUser>(id: string, user: T): Promise<void> {
  if (useMemoryStore) {
    assertUniqueMemUser(user, id);
    memUsers.set(id, cloneUser(user));
    return;
  }
  await getPool().query(
    `UPDATE app_users
     SET email_normalized = $2, phone_normalized = $3, role = $4, payload = $5::jsonb
     WHERE id = $1`,
    [id, normalizeInvestorEmail(user.email), normalizeInvestorPhone(user.phone), user.role, JSON.stringify(user)]
  );
}

export async function deleteUser(id: string): Promise<void> {
  if (useMemoryStore) {
    memUsers.delete(id);
    for (const [token, session] of memSessions.entries()) {
      if (session.userId === id) memSessions.delete(token);
    }
    return;
  }
  await getPool().query('DELETE FROM app_users WHERE id = $1', [id]);
}

export async function createUserSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
  if (useMemoryStore) {
    memSessions.set(tokenHash, { userId, expiresAt });
    return;
  }
  await getPool().query(
    'INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [tokenHash, userId, expiresAt]
  );
}

export async function findUserBySession<T extends StoredUser>(tokenHash: string): Promise<T | undefined> {
  if (useMemoryStore) {
    const session = memSessions.get(tokenHash);
    if (!session || session.expiresAt.getTime() <= Date.now()) return undefined;
    const user = memUsers.get(session.userId);
    return user ? (cloneUser(user) as T) : undefined;
  }
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    `SELECT u.payload, u.role
     FROM app_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] ? { ...rows[0].payload, role: rows[0].role } : undefined;
}

export async function saveUserOtp(email: string, code: string, expiresAt: Date): Promise<void> {
  if (useMemoryStore) {
    memOtps.set(normalizeInvestorEmail(email), { code, expiresAt, attempts: 0 });
    return;
  }
  await getPool().query(
    `INSERT INTO user_otps (email_normalized, code, expires_at, attempts)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (email_normalized)
     DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, attempts = 0`,
    [normalizeInvestorEmail(email), code, expiresAt]
  );
}

export async function findUserOtp(email: string): Promise<{ code: string; expiresAt: Date; attempts: number } | undefined> {
  if (useMemoryStore) {
    const entry = memOtps.get(normalizeInvestorEmail(email));
    return entry ? { ...entry } : undefined;
  }
  const { rows } = await getPool().query<{ code: string; expires_at: Date; attempts: number }>(
    'SELECT code, expires_at, attempts FROM user_otps WHERE email_normalized = $1',
    [normalizeInvestorEmail(email)]
  );
  const otp = rows[0];
  return otp ? { code: otp.code, expiresAt: otp.expires_at, attempts: otp.attempts } : undefined;
}

export async function incrementUserOtpAttempts(email: string): Promise<number> {
  if (useMemoryStore) {
    const entry = memOtps.get(normalizeInvestorEmail(email));
    if (!entry) return 0;
    entry.attempts += 1;
    return entry.attempts;
  }
  const { rows } = await getPool().query<{ attempts: number }>(
    `UPDATE user_otps SET attempts = attempts + 1
     WHERE email_normalized = $1 RETURNING attempts`,
    [normalizeInvestorEmail(email)]
  );
  return rows[0]?.attempts ?? 0;
}

export async function deleteUserOtp(email: string): Promise<void> {
  if (useMemoryStore) {
    memOtps.delete(normalizeInvestorEmail(email));
    return;
  }
  await getPool().query('DELETE FROM user_otps WHERE email_normalized = $1', [normalizeInvestorEmail(email)]);
}

export async function clearUserOtps(): Promise<void> {
  if (useMemoryStore) {
    memOtps.clear();
    return;
  }
  await getPool().query('DELETE FROM user_otps');
}

export async function closeInvestorStore(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}
