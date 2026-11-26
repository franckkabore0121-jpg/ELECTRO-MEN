import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { getDatabasePool, isMemoryStoreActive } from './investorStore.ts';

type CollectionKey =
  | 'operations'
  | 'subscriptions'
  | 'activities'
  | 'documents'
  | 'courses'
  | 'course-categories'
  | 'audit-logs'
  | 'products'
  | 'fund-requests'
  | 'wallet-transactions'
  | 'investor-messages'
  | 'profit-distributions';

export type ApplicationDataKey = CollectionKey | 'admin-config' | 'groups';

const collections: Record<CollectionKey, { table: string; filename: string }> = {
  operations: { table: 'app_operations', filename: 'operations.json' },
  subscriptions: { table: 'app_subscriptions', filename: 'subscriptions.json' },
  activities: { table: 'app_activities', filename: 'activities.json' },
  documents: { table: 'app_documents', filename: 'documents.json' },
  courses: { table: 'app_courses', filename: 'courses.json' },
  'course-categories': { table: 'app_course_categories', filename: 'course-categories.json' },
  'audit-logs': { table: 'app_audit_logs', filename: 'audit-logs.json' },
  products: { table: 'app_products', filename: 'products.json' },
  'fund-requests': { table: 'app_fund_requests', filename: 'fund-requests.json' },
  'wallet-transactions': { table: 'app_wallet_transactions', filename: 'wallet-transactions.json' },
  'investor-messages': { table: 'app_investor_messages', filename: 'investor-messages.json' },
  'profit-distributions': { table: 'app_profit_distributions', filename: 'profit-distributions.json' }
};

const documents = {
  'admin-config': { table: 'app_admin_config', filename: 'admin-config.json' },
  groups: { table: 'app_groups', filename: 'groups.json' }
} as const;

const isCollectionKey = (key: ApplicationDataKey): key is CollectionKey => key in collections;

// In-memory fallback stores when PostgreSQL is unavailable
const memCollections = new Map<CollectionKey, Array<{ id: string; payload: unknown }>>();
const memDocuments = new Map<'admin-config' | 'groups', unknown>();
const memSourcePresent = new Set<ApplicationDataKey>();
const memExplicitlyWritten = new Set<ApplicationDataKey>();
const memBackups = new Map<string, unknown>();

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Les données JSON héritées doivent être un objet ou un tableau selon la ressource.');
  }
}

function parseLegacyJson(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`Impossible de lire le fichier de migration ${path.basename(filePath)}.`, { cause: error });
  }
}

function migrationSource(dataDir: string, filename: string): { filePath: string; exists: boolean } {
  const filePath = path.join(dataDir, filename);
  return { filePath, exists: existsSync(filePath) };
}

async function getMigrationState(
  client: PoolClient,
  key: ApplicationDataKey
): Promise<{ sourcePresent: boolean; explicitlyWritten: boolean } | undefined> {
  const result = await client.query<{ source_present: boolean; explicitly_written: boolean }>(
    'SELECT source_present, explicitly_written FROM app_data_migrations WHERE resource_key = $1',
    [key]
  );
  if (result.rowCount === 0) return undefined;
  return {
    sourcePresent: Boolean(result.rows[0]?.source_present),
    explicitlyWritten: Boolean(result.rows[0]?.explicitly_written)
  };
}

async function markMigration(
  client: PoolClient,
  key: ApplicationDataKey,
  filename: string,
  sourcePresent: boolean,
  importedCount: number
): Promise<void> {
  await client.query(
    `INSERT INTO app_data_migrations
       (resource_key, source_file, source_present, imported_count, completed_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (resource_key) DO UPDATE
     SET source_file = EXCLUDED.source_file,
         source_present = EXCLUDED.source_present,
         imported_count = EXCLUDED.imported_count,
         completed_at = NOW()
     WHERE app_data_migrations.explicitly_written = FALSE
       AND app_data_migrations.source_present = FALSE`,
    [key, filename, sourcePresent, importedCount]
  );
}

async function migrateCollection(
  client: PoolClient,
  dataDir: string,
  key: CollectionKey
): Promise<void> {
  const existingMigration = await getMigrationState(client, key);
  if (existingMigration && (existingMigration.sourcePresent || existingMigration.explicitlyWritten)) {
    return;
  }

  const { table, filename } = collections[key];
  const source = migrationSource(dataDir, filename);
  if (existingMigration && !source.exists) return;

  const count = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`);
  let importedCount = 0;

  if (count.rows[0]?.count === '0' && source.exists) {
    const parsed = parseLegacyJson(source.filePath);
    if (!Array.isArray(parsed)) {
      throw new Error(`Le fichier ${filename} doit contenir un tableau JSON.`);
    }

    for (const [position, value] of parsed.entries()) {
      assertRecord(value);
      if (typeof value.id !== 'string' || value.id.length === 0) {
        throw new Error(`Un élément du fichier ${filename} ne possède pas d’identifiant valide.`);
      }

      const result = await client.query(
        `INSERT INTO ${table} (id, position, payload)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [value.id, position, JSON.stringify(value)]
      );
      importedCount += result.rowCount ?? 0;
    }
  }

  await markMigration(client, key, filename, source.exists, importedCount);
}

async function migrateDocument(
  client: PoolClient,
  dataDir: string,
  key: 'admin-config' | 'groups',
  defaultValue: Record<string, unknown>
): Promise<void> {
  const existingMigration = await getMigrationState(client, key);
  if (existingMigration && (existingMigration.sourcePresent || existingMigration.explicitlyWritten)) {
    return;
  }

  const { table, filename } = documents[key];
  const source = migrationSource(dataDir, filename);
  if (existingMigration && !source.exists) return;

  const count = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`);
  let importedCount = 0;

  if (count.rows[0]?.count === '0') {
    let payload: Record<string, unknown> = defaultValue;
    if (source.exists) {
      const parsed = parseLegacyJson(source.filePath);
      assertRecord(parsed);
      payload = key === 'admin-config' ? sanitizeAdminConfig(parsed) : parsed;
    }

    const result = await client.query(
      `INSERT INTO ${table} (singleton_id, payload)
       VALUES (1, $1::jsonb)
       ON CONFLICT (singleton_id) DO NOTHING`,
      [JSON.stringify(payload)]
    );
    importedCount = source.exists ? result.rowCount ?? 0 : 0;
  }

  await markMigration(client, key, filename, source.exists, importedCount);
}

export function sanitizeAdminConfig(value: unknown): Record<string, unknown> {
  assertRecord(value);
  return {
    customAdminUrl: typeof value.customAdminUrl === 'string' ? value.customAdminUrl : '/electromen-gestion',
    heroVideoUrl: typeof value.heroVideoUrl === 'string' ? value.heroVideoUrl : '/assets/videos/electromen-hero.mp4',
    formationsVideoUrl: typeof value.formationsVideoUrl === 'string'
      ? value.formationsVideoUrl
      : '/assets/videos/electromen-hero.mp4',
    isMaintenanceMode: Boolean(value.isMaintenanceMode),
    isInvestorChatOpen: value.isInvestorChatOpen === undefined ? true : Boolean(value.isInvestorChatOpen),
    ...(Array.isArray(value.boutiques) ? { boutiques: cloneData(value.boutiques) } : {}),
    masterPasswordHash: '',
    masterPasswordHint: '',
    admins: [],
    activeTokens: {}
  };
}

function initializeMemoryApplicationStore(dataDir: string, defaultAdminConfig: unknown): void {
  memCollections.clear();
  memDocuments.clear();
  memSourcePresent.clear();
  memExplicitlyWritten.clear();
  memBackups.clear();

  for (const key of Object.keys(collections) as CollectionKey[]) {
    const { filename } = collections[key];
    const source = migrationSource(dataDir, filename);
    const rows: Array<{ id: string; payload: unknown }> = [];
    if (source.exists) {
      memSourcePresent.add(key);
      const parsed = parseLegacyJson(source.filePath);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'object' && item !== null && !Array.isArray(item) && typeof (item as { id?: unknown }).id === 'string') {
            rows.push({ id: (item as { id: string }).id, payload: cloneData(item) });
          }
        }
      }
    }
    memCollections.set(key, rows);
  }

  for (const key of ['admin-config', 'groups'] as const) {
    const { filename } = documents[key];
    const source = migrationSource(dataDir, filename);
    let payload: Record<string, unknown> = key === 'admin-config' ? sanitizeAdminConfig(defaultAdminConfig) : {};
    if (source.exists) {
      memSourcePresent.add(key);
      const parsed = parseLegacyJson(source.filePath);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        payload = key === 'admin-config' ? sanitizeAdminConfig(parsed) : (cloneData(parsed) as Record<string, unknown>);
      }
    }
    memDocuments.set(key, payload);
  }
}

export async function initializeApplicationStore(
  dataDir: string,
  defaultAdminConfig: unknown
): Promise<void> {
  if (isMemoryStoreActive()) {
    initializeMemoryApplicationStore(dataDir, defaultAdminConfig);
    return;
  }

  const pool = getDatabasePool();
  for (const { table } of Object.values(collections)) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS ${table}_position_idx ON ${table} (position)`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_admin_config (
      singleton_id SMALLINT PRIMARY KEY CHECK (singleton_id = 1),
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_groups (
      singleton_id SMALLINT PRIMARY KEY CHECK (singleton_id = 1),
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_backups (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('electromen-application-data-migration'))`);

    for (const key of Object.keys(collections) as CollectionKey[]) {
      await migrateCollection(client, dataDir, key);
    }
    await migrateDocument(client, dataDir, 'admin-config', sanitizeAdminConfig(defaultAdminConfig));
    await migrateDocument(client, dataDir, 'groups', {});

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error('Initialisation/migration des données applicatives vers PostgreSQL échouée.', { cause: error });
  } finally {
    client.release();
  }
}

export async function readApplicationData<T>(key: ApplicationDataKey, defaultValue: T): Promise<T> {
  if (isMemoryStoreActive()) {
    if (isCollectionKey(key)) {
      const rows = memCollections.get(key) ?? [];
      if (rows.length > 0) return rows.map((row) => cloneData(row.payload)) as T;
      return memSourcePresent.has(key) || memExplicitlyWritten.has(key) ? ([] as T) : defaultValue;
    }
    const doc = memDocuments.get(key);
    return doc !== undefined ? (cloneData(doc) as T) : defaultValue;
  }

  const pool = getDatabasePool();
  if (isCollectionKey(key)) {
    const { table } = collections[key];
    const result = await pool.query<{ id: string; payload: T }>(
      `SELECT id, payload FROM ${table} ORDER BY position ASC, id ASC`
    );
    if (result.rows.length > 0) {
      return result.rows.map((row) => {
        if (typeof row.payload === 'object' && row.payload !== null && !Array.isArray(row.payload)) {
          const obj = row.payload as Record<string, unknown>;
          return (obj.id ? obj : { ...obj, id: row.id }) as T;
        }
        return row.payload;
      }) as T;
    }

    const migration = await pool.query<{ source_present: boolean; explicitly_written: boolean }>(
      'SELECT source_present, explicitly_written FROM app_data_migrations WHERE resource_key = $1',
      [key]
    );
    const state = migration.rows[0];
    return state?.source_present || state?.explicitly_written ? ([] as T) : defaultValue;
  }

  const table = documents[key].table;
  const result = await pool.query<{ payload: T }>(
    `SELECT payload FROM ${table} WHERE singleton_id = 1`
  );
  return result.rows[0]?.payload ?? defaultValue;
}

export async function readInvestorSubscriptions<T>(
  identity: { id: string; email: string; legacyIds?: readonly string[] }
): Promise<T[]> {
  const investorIds = [...new Set([identity.id, ...(identity.legacyIds ?? [])]
    .filter((id) => typeof id === 'string' && id.trim().length > 0))];
  const email = identity.email.trim().toLowerCase();

  if (isMemoryStoreActive()) {
    const idSet = new Set(investorIds);
    const rows = memCollections.get('subscriptions') ?? [];
    const readTrimmed = (record: Record<string, unknown>, field: string): string | null => {
      const raw = record[field];
      if (typeof raw !== 'string') return null;
      const trimmed = raw.trim();
      return trimmed.length > 0 ? trimmed : null;
    };
    return rows
      .map((row) => row.payload as Record<string, unknown>)
      .filter((payload) => {
        const investorId = readTrimmed(payload, 'investorId');
        const legacyInvestorId = readTrimmed(payload, 'investor_id');
        const userId = readTrimmed(payload, 'userId');
        const legacyUserId = readTrimmed(payload, 'user_id');
        if (investorId !== null && !idSet.has(investorId)) return false;
        if (legacyInvestorId !== null && !idSet.has(legacyInvestorId)) return false;
        if (userId !== null && !idSet.has(userId)) return false;
        if (legacyUserId !== null && !idSet.has(legacyUserId)) return false;
        if (
          (investorId && idSet.has(investorId)) ||
          (legacyInvestorId && idSet.has(legacyInvestorId)) ||
          (userId && idSet.has(userId)) ||
          (legacyUserId && idSet.has(legacyUserId))
        ) {
          return true;
        }
        const payloadEmail = (readTrimmed(payload, 'investorEmail') ?? readTrimmed(payload, 'investor_email') ?? '').toLowerCase();
        return payloadEmail === email;
      })
      .map((payload) => cloneData(payload) as T);
  }

  const { rows } = await getDatabasePool().query<{ payload: T }>(
    `WITH investor_subscriptions AS (
       SELECT id, position, payload,
         NULLIF(btrim(payload->>'investorId'), '') AS investor_id,
         NULLIF(btrim(payload->>'investor_id'), '') AS legacy_investor_id,
         NULLIF(btrim(payload->>'userId'), '') AS user_id,
         NULLIF(btrim(payload->>'user_id'), '') AS legacy_user_id
       FROM app_subscriptions
     )
     SELECT payload
     FROM investor_subscriptions
     WHERE (investor_id IS NULL OR investor_id = ANY($1::text[]))
       AND (legacy_investor_id IS NULL OR legacy_investor_id = ANY($1::text[]))
       AND (user_id IS NULL OR user_id = ANY($1::text[]))
       AND (legacy_user_id IS NULL OR legacy_user_id = ANY($1::text[]))
       AND (
         investor_id = ANY($1::text[])
         OR legacy_investor_id = ANY($1::text[])
         OR user_id = ANY($1::text[])
         OR legacy_user_id = ANY($1::text[])
         OR (
           investor_id IS NULL
           AND legacy_investor_id IS NULL
           AND user_id IS NULL
           AND legacy_user_id IS NULL
           AND (
             lower(btrim(payload->>'investorEmail')) = $2
             OR lower(btrim(payload->>'investor_email')) = $2
           )
         )
       )
     ORDER BY position ASC, id ASC`,
    [investorIds, email]
  );
  return rows.map((row) => row.payload);
}

export async function writeApplicationData<T>(key: ApplicationDataKey, value: T): Promise<void> {
  if (isMemoryStoreActive()) {
    if (isCollectionKey(key)) {
      if (!Array.isArray(value)) throw new Error(`La ressource ${key} doit être un tableau.`);
      const items = value as unknown[];
      for (const item of items) {
        assertRecord(item);
        if (typeof item.id !== 'string' || item.id.length === 0) {
          throw new Error(`Chaque élément de ${key} doit avoir un identifiant valide.`);
        }
      }
      memCollections.set(
        key,
        items.map((item) => ({ id: (item as { id: string }).id, payload: cloneData(item) }))
      );
      memExplicitlyWritten.add(key);
      return;
    }
    const payload = key === 'admin-config' ? sanitizeAdminConfig(value) : cloneData(value);
    memDocuments.set(key, payload);
    memExplicitlyWritten.add(key);
    return;
  }

  const pool = getDatabasePool();
  if (isCollectionKey(key)) {
    if (!Array.isArray(value)) throw new Error(`La ressource ${key} doit être un tableau.`);
    const items = value as unknown[];
    for (const item of items) {
      assertRecord(item);
      if (typeof item.id !== 'string' || item.id.length === 0) {
        throw new Error(`Chaque élément de ${key} doit avoir un identifiant valide.`);
      }
    }

    const { table } = collections[key];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`electromen-data-${key}`]);
      await client.query(`DELETE FROM ${table}`);
      for (const [position, item] of items.entries()) {
        await client.query(
          `INSERT INTO ${table} (id, position, payload)
           VALUES ($1, $2, $3::jsonb)`,
          [(item as { id: string }).id, position, JSON.stringify(item)]
        );
      }
      await client.query(
        'UPDATE app_data_migrations SET explicitly_written = TRUE WHERE resource_key = $1',
        [key]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return;
  }

  const table = documents[key].table;
  const payload = key === 'admin-config' ? sanitizeAdminConfig(value) : value;
  await pool.query(
    `INSERT INTO ${table} (singleton_id, payload)
     VALUES (1, $1::jsonb)
     ON CONFLICT (singleton_id) DO UPDATE
     SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [JSON.stringify(payload)]
  );
  await pool.query(
    'UPDATE app_data_migrations SET explicitly_written = TRUE WHERE resource_key = $1',
    [key]
  );
}

export async function appendApplicationRecord<T extends { id: string }>(
  key: CollectionKey,
  value: T
): Promise<void> {
  if (isMemoryStoreActive()) {
    const rows = memCollections.get(key) ?? [];
    if (rows.some((row) => row.id === value.id)) {
      throw new Error(`L’enregistrement ${value.id} existe déjà dans ${key}.`);
    }
    rows.unshift({ id: value.id, payload: cloneData(value) });
    memCollections.set(key, rows);
    memExplicitlyWritten.add(key);
    return;
  }

  const pool = getDatabasePool();
  const { table } = collections[key];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`electromen-data-${key}`]);
    const result = await client.query(
      `INSERT INTO ${table} (id, position, payload)
       SELECT $1, COALESCE(MIN(position), 0) - 1, $2::jsonb FROM ${table}
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [value.id, JSON.stringify(value)]
    );
    if (result.rowCount !== 1) throw new Error(`L’enregistrement ${value.id} existe déjà dans ${key}.`);
    await client.query(
      'UPDATE app_data_migrations SET explicitly_written = TRUE WHERE resource_key = $1',
      [key]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateApplicationRecord<T extends { id: string }>(
  key: CollectionKey,
  id: string,
  update: (record: T) => T
): Promise<T | undefined> {
  if (isMemoryStoreActive()) {
    const rows = memCollections.get(key) ?? [];
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) return undefined;
    const updated = update(cloneData(rows[index].payload) as T);
    if (updated.id !== id) {
      throw new Error(`L’identifiant d’un enregistrement de ${key} ne peut pas être modifié.`);
    }
    rows[index] = { id, payload: cloneData(updated) };
    memExplicitlyWritten.add(key);
    return updated;
  }

  const pool = getDatabasePool();
  const { table } = collections[key];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`electromen-data-${key}`]);
    const result = await client.query<{ payload: T }>(
      `SELECT payload FROM ${table} WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!result.rows[0]) {
      await client.query('COMMIT');
      return undefined;
    }
    const updated = update(result.rows[0].payload);
    if (updated.id !== id) {
      throw new Error(`L’identifiant d’un enregistrement de ${key} ne peut pas être modifié.`);
    }
    await client.query(
      `UPDATE ${table} SET payload = $2::jsonb WHERE id = $1`,
      [id, JSON.stringify(updated)]
    );
    await client.query(
      'UPDATE app_data_migrations SET explicitly_written = TRUE WHERE resource_key = $1',
      [key]
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

export async function deleteApplicationRecord(key: CollectionKey, id: string): Promise<boolean> {
  if (isMemoryStoreActive()) {
    const rows = memCollections.get(key) ?? [];
    const next = rows.filter((row) => row.id !== id);
    if (next.length === rows.length) return false;
    memCollections.set(key, next);
    memExplicitlyWritten.add(key);
    return true;
  }

  const pool = getDatabasePool();
  const { table } = collections[key];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`electromen-data-${key}`]);
    const result = await client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    await client.query(
      'UPDATE app_data_migrations SET explicitly_written = TRUE WHERE resource_key = $1',
      [key]
    );
    await client.query('COMMIT');
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function saveApplicationBackup(id: string, value: unknown): Promise<void> {
  if (isMemoryStoreActive()) {
    memBackups.set(id, cloneData(value));
    return;
  }
  await getDatabasePool().query(
    'INSERT INTO app_backups (id, payload) VALUES ($1, $2::jsonb)',
    [id, JSON.stringify(value)]
  );
}

export interface AtomicFundRequestRecord {
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

export class FundRequestRuleError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'FundRequestRuleError';
    this.statusCode = statusCode;
  }
}

const memFundQueue = new Map<string, Promise<unknown>>();

export async function createFundRequestAtomic<T extends AtomicFundRequestRecord>(params: {
  investorId: string;
  investorEmail: string;
  idempotencyKey?: string;
  todayDateKey: string;
  maxDailyWithdrawal: number;
  maxPendingWithdrawals: number;
  buildRequest: (realBalance: number) => T;
}): Promise<{ request: T; duplicate: boolean }> {
  const emailNorm = params.investorEmail.trim().toLowerCase();
  const matchesInvestor = (r: AtomicFundRequestRecord) =>
    (typeof r.investorId === 'string' && r.investorId.trim() === params.investorId) ||
    (typeof r.investorEmail === 'string' && r.investorEmail.trim().toLowerCase() === emailNorm);

  const validateAndBuild = (
    realBalance: number,
    existingRequests: AtomicFundRequestRecord[]
  ): { request: T; duplicate: boolean } => {
    const mine = existingRequests.filter(matchesInvestor);
    if (params.idempotencyKey) {
      const existingDup = mine.find((r) => r.idempotencyKey === params.idempotencyKey);
      if (existingDup) {
        return { request: cloneData(existingDup as T), duplicate: true };
      }
    }

    const candidate = params.buildRequest(realBalance);
    if (candidate.type === 'retrait') {
      if (candidate.amount > realBalance) {
        throw new FundRequestRuleError(
          `Solde insuffisant : votre solde réel vérifié est de ${realBalance.toLocaleString('fr-FR')} FCFA.`,
          400
        );
      }

      const pendingWithdrawals = mine.filter(
        (r) => r.type === 'retrait' && (r.status === 'En attente' || r.status === 'En cours de traitement')
      );
      if (pendingWithdrawals.length >= params.maxPendingWithdrawals) {
        throw new FundRequestRuleError(
          `Vous avez déjà ${pendingWithdrawals.length} demandes de retrait en attente. Veuillez attendre leur traitement avant d’en soumettre une nouvelle.`,
          429
        );
      }

      const pendingTotal = pendingWithdrawals.reduce(
        (sum, r) => sum + (Number.isSafeInteger(r.amount) && r.amount > 0 ? r.amount : 0),
        0
      );
      if (pendingTotal + candidate.amount > realBalance) {
        const remainingAvailable = Math.max(0, realBalance - pendingTotal);
        throw new FundRequestRuleError(
          `Solde disponible insuffisant : ${pendingTotal.toLocaleString('fr-FR')} FCFA sont déjà réservés par vos retraits en attente (disponible : ${remainingAvailable.toLocaleString('fr-FR')} FCFA).`,
          400
        );
      }

      const todayTotal = mine
        .filter((r) => r.type === 'retrait' && r.status !== 'Refusé' && r.requestedDateKey === params.todayDateKey)
        .reduce((sum, r) => sum + (Number.isSafeInteger(r.amount) && r.amount > 0 ? r.amount : 0), 0);
      if (todayTotal + candidate.amount > params.maxDailyWithdrawal) {
        throw new FundRequestRuleError(
          `Plafond journalier de retrait dépassé : maximum ${params.maxDailyWithdrawal.toLocaleString('fr-FR')} FCFA par jour.`,
          400
        );
      }
    }

    return { request: candidate, duplicate: false };
  };

  if (isMemoryStoreActive()) {
    const prevLock = memFundQueue.get(params.investorId) ?? Promise.resolve();
    const runTask = prevLock.then(async () => {
      const { findInvestorByIdentifier } = await import('./investorStore.ts');
      const investor = await findInvestorByIdentifier<{ id: string; email: string; phone: string; walletBalance?: number }>(
        params.investorId
      );
      if (!investor) {
        throw new FundRequestRuleError('Compte investisseur introuvable.', 404);
      }
      const rawBalance = investor.walletBalance;
      const realBalance = Number.isSafeInteger(rawBalance) && (rawBalance as number) >= 0 ? (rawBalance as number) : 0;
      const rows = memCollections.get('fund-requests') ?? [];
      const existing = rows.map((row) => row.payload as AtomicFundRequestRecord);
      const outcome = validateAndBuild(realBalance, existing);
      if (outcome.duplicate) return outcome;
      rows.unshift({ id: outcome.request.id, payload: cloneData(outcome.request) });
      memCollections.set('fund-requests', rows);
      memExplicitlyWritten.add('fund-requests');
      return outcome;
    });
    const tail = runTask.catch(() => {});
    memFundQueue.set(params.investorId, tail);
    try {
      return await runTask;
    } finally {
      if (memFundQueue.get(params.investorId) === tail) {
        memFundQueue.delete(params.investorId);
      }
    }
  }

  const pool = getDatabasePool();
  const { table } = collections['fund-requests'];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`electromen-fund-${params.investorId}`]);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['electromen-data-fund-requests']);

    const { rows: investorRows } = await client.query<{ payload: { walletBalance?: number } }>(
      `SELECT payload FROM app_users WHERE id = $1 AND role = 'investor' FOR UPDATE`,
      [params.investorId]
    );
    if (!investorRows[0]) {
      throw new FundRequestRuleError('Compte investisseur introuvable.', 404);
    }
    const rawBalance = investorRows[0].payload.walletBalance;
    const realBalance = Number.isSafeInteger(rawBalance) && (rawBalance as number) >= 0 ? (rawBalance as number) : 0;

    const { rows: reqRows } = await client.query<{ payload: AtomicFundRequestRecord }>(
      `SELECT payload FROM ${table} ORDER BY position ASC, id ASC`
    );
    const existing = reqRows.map((row) => row.payload);
    const outcome = validateAndBuild(realBalance, existing);
    if (outcome.duplicate) {
      await client.query('COMMIT');
      return outcome;
    }

    await client.query(
      `INSERT INTO ${table} (id, position, payload)
       SELECT $1, COALESCE(MIN(position), 0) - 1, $2::jsonb FROM ${table}`,
      [outcome.request.id, JSON.stringify(outcome.request)]
    );
    await client.query(
      'UPDATE app_data_migrations SET explicitly_written = TRUE WHERE resource_key = $1',
      ['fund-requests']
    );
    await client.query('COMMIT');
    return outcome;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
