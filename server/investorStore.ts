import { existsSync, readFileSync, renameSync } from 'node:fs';
import { Pool, type PoolClient } from 'pg';

export interface InvestorIdentity {
  id: string;
  email: string;
  phone: string;
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

function getPool(): Pool {
  if (!pool) {
    throw new Error('La base de données des investisseurs n’est pas initialisée.');
  }
  return pool;
}

export function normalizeInvestorEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeInvestorPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 8) return `226${digits}`;
  if (digits.length === 11 && digits.startsWith('226')) return digits;
  return digits;
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

function readLegacyUsers(filePath: string): StoredUser[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
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
    return [];
  }
}

export async function initializeUserStore(options: {
  legacyInvestorFile: string;
  legacyClientFile: string;
  legacyAdmins: StoredUser[];
  bootstrapAdmin?: StoredUser;
}): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL doit être configurée pour démarrer le serveur.');
  }

  pool = new Pool({ connectionString });
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
          for (const user of rows) await insertUser(client, { ...user.payload, role: 'investor' });
        }
      }

      const legacySets: Array<{ role: UserRole; users: StoredUser[] }> = [
        { role: 'client', users: readLegacyUsers(options.legacyClientFile).map((user) => ({ ...user, role: 'client' })) },
        { role: 'investor', users: readLegacyUsers(options.legacyInvestorFile).map((user) => ({ ...user, role: 'investor' })) },
        { role: 'admin_principal', users: options.legacyAdmins.filter((user) => user.role === 'admin_principal') },
        { role: 'admin_secondaire', users: options.legacyAdmins.filter((user) => user.role === 'admin_secondaire') }
      ];

      for (const { role, users } of legacySets) {
        const { rows } = await client.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM app_users WHERE role = $1',
          [role]
        );
        if (rows[0]?.count === '0') {
          for (const user of users) {
            try {
              await insertUser(client, user);
            } catch (error) {
              if ((error as { code?: string }).code !== '23505' || (error as { constraint?: string }).constraint !== 'app_users_pkey') {
                throw error;
              }
            }
          }
        }
      }

      if (options.bootstrapAdmin) {
        const { rows } = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM app_users WHERE role = 'admin_principal'`
        );
        if (rows[0]?.count === '0') await insertUser(client, options.bootstrapAdmin);
      }

      const { rows: principals } = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM app_users WHERE role = 'admin_principal'`
      );
      if (principals[0]?.count === '0') {
        throw new Error('Aucun administrateur principal en base. Configurez ADMIN_INITIAL_EMAIL et ADMIN_INITIAL_PASSWORD.');
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
    for (const legacyPath of [options.legacyInvestorFile, options.legacyClientFile]) {
      if (existsSync(legacyPath)) renameSync(legacyPath, `${legacyPath}.migrated`);
    }
  } catch (error) {
    await pool.end();
    pool = undefined;
    throw error;
  }
}

export async function initializeAdminSecurity(settings: AdminSecuritySettings): Promise<void> {
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
  await getPool().query(
    `INSERT INTO app_archives (id, entity_type, entity_id, label, parent_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [record.id, record.entityType, record.entityId, record.label, record.parentId || null, JSON.stringify(record.payload)]
  );
}

export async function listArchiveRecords(): Promise<ArchivedRecord[]> {
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
  await getPool().query('DELETE FROM app_archives WHERE id = $1', [id]);
}

export async function initializeOperationInventory(inventories: OperationInventory[]): Promise<void> {
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
  const result = await getPool().query(
    `UPDATE app_operation_inventory
     SET total_shares = $2
     WHERE operation_id = $1 AND committed_shares <= $2`,
    [operationId, totalShares]
  );
  return result.rowCount === 1;
}

export async function listOperationInventories(): Promise<OperationInventory[]> {
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
  const result = await getPool().query(
    `UPDATE app_operation_inventory
     SET committed_shares = committed_shares + $2
     WHERE operation_id = $1 AND committed_shares + $2 <= total_shares`,
    [operationId, count]
  );
  return result.rowCount === 1;
}

export async function releaseOperationShares(operationId: string, count: number): Promise<void> {
  await getPool().query(
    `UPDATE app_operation_inventory
     SET committed_shares = GREATEST(0, committed_shares - $2)
     WHERE operation_id = $1`,
    [operationId, count]
  );
}

export async function listInvestors<T extends InvestorIdentity>(): Promise<T[]> {
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    `SELECT payload, role FROM app_users WHERE role = 'investor'`
  );
  return rows.map((row) => ({ ...row.payload, role: row.role }));
}

export async function findInvestorByIdentifier<T extends InvestorIdentity>(identifier: string): Promise<T | undefined> {
  const normalizedEmail = normalizeInvestorEmail(identifier);
  const normalizedPhone = normalizeInvestorPhone(identifier);
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
  await insertInvestor(getPool(), investor);
}

export async function updateInvestor<T extends InvestorIdentity>(
  id: string,
  update: (investor: T) => T
): Promise<T | undefined> {
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
    await client.query('COMMIT');
    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteInvestor(id: string): Promise<boolean> {
  const result = await getPool().query(`DELETE FROM app_users WHERE id = $1 AND role = 'investor'`, [id]);
  return result.rowCount === 1;
}

export async function replaceInvestors<T extends InvestorIdentity>(investors: T[]): Promise<void> {
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
  await getPool().query(
    'INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [tokenHash, investorId, expiresAt]
  );
}

export async function findInvestorBySession<T extends InvestorIdentity>(tokenHash: string): Promise<T | undefined> {
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
  await getPool().query('DELETE FROM app_sessions WHERE token_hash = $1', [tokenHash]);
}

export async function deleteOtherInvestorSessions(investorId: string, currentTokenHash: string): Promise<void> {
  await getPool().query(
    'DELETE FROM app_sessions WHERE user_id = $1 AND token_hash <> $2',
    [investorId, currentTokenHash]
  );
}

export async function createUser<T extends StoredUser>(user: T): Promise<void> {
  await insertUser(getPool(), user);
}

export async function createUserWithOtp<T extends StoredUser>(
  user: T,
  code: string,
  expiresAt: Date
): Promise<void> {
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
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    'SELECT payload, role FROM app_users WHERE email_normalized = $1 LIMIT 1',
    [normalizeInvestorEmail(email)]
  );
  return rows[0] ? { ...rows[0].payload, role: rows[0].role } : undefined;
}

export async function findUserById<T extends StoredUser>(id: string): Promise<T | undefined> {
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    'SELECT payload, role FROM app_users WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] ? { ...rows[0].payload, role: rows[0].role } : undefined;
}

export async function findAdminByRole<T extends StoredUser>(role: 'admin_principal' | 'admin_secondaire'): Promise<T | undefined> {
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    'SELECT payload, role FROM app_users WHERE role = $1 ORDER BY id LIMIT 1',
    [role]
  );
  return rows[0] ? { ...rows[0].payload, role: rows[0].role } : undefined;
}

export async function listAdmins<T extends StoredUser>(): Promise<T[]> {
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    `SELECT payload, role FROM app_users WHERE role IN ('admin_principal', 'admin_secondaire')`
  );
  return rows.map((row) => ({ ...row.payload, role: row.role }));
}

export async function listUsersByRole<T extends StoredUser>(role: UserRole): Promise<T[]> {
  const { rows } = await getPool().query<{ payload: T; role: UserRole }>(
    'SELECT payload, role FROM app_users WHERE role = $1',
    [role]
  );
  return rows.map((row) => ({ ...row.payload, role: row.role }));
}

export async function updateUser<T extends StoredUser>(id: string, user: T): Promise<void> {
  await getPool().query(
    `UPDATE app_users
     SET email_normalized = $2, phone_normalized = $3, role = $4, payload = $5::jsonb
     WHERE id = $1`,
    [id, normalizeInvestorEmail(user.email), normalizeInvestorPhone(user.phone), user.role, JSON.stringify(user)]
  );
}

export async function deleteUser(id: string): Promise<void> {
  await getPool().query('DELETE FROM app_users WHERE id = $1', [id]);
}

export async function createUserSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
  await getPool().query(
    'INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [tokenHash, userId, expiresAt]
  );
}

export async function findUserBySession<T extends StoredUser>(tokenHash: string): Promise<T | undefined> {
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
  await getPool().query(
    `INSERT INTO user_otps (email_normalized, code, expires_at, attempts)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (email_normalized)
     DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, attempts = 0`,
    [normalizeInvestorEmail(email), code, expiresAt]
  );
}

export async function findUserOtp(email: string): Promise<{ code: string; expiresAt: Date; attempts: number } | undefined> {
  const { rows } = await getPool().query<{ code: string; expires_at: Date; attempts: number }>(
    'SELECT code, expires_at, attempts FROM user_otps WHERE email_normalized = $1',
    [normalizeInvestorEmail(email)]
  );
  const otp = rows[0];
  return otp ? { code: otp.code, expiresAt: otp.expires_at, attempts: otp.attempts } : undefined;
}

export async function incrementUserOtpAttempts(email: string): Promise<number> {
  const { rows } = await getPool().query<{ attempts: number }>(
    `UPDATE user_otps SET attempts = attempts + 1
     WHERE email_normalized = $1 RETURNING attempts`,
    [normalizeInvestorEmail(email)]
  );
  return rows[0]?.attempts ?? 0;
}

export async function deleteUserOtp(email: string): Promise<void> {
  await getPool().query('DELETE FROM user_otps WHERE email_normalized = $1', [normalizeInvestorEmail(email)]);
}

export async function clearUserOtps(): Promise<void> {
  await getPool().query('DELETE FROM user_otps');
}

export async function closeInvestorStore(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}
