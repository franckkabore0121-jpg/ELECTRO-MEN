import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { getDatabasePool } from './investorStore.ts';

type CollectionKey =
  | 'operations'
  | 'subscriptions'
  | 'activities'
  | 'documents'
  | 'courses'
  | 'course-categories'
  | 'audit-logs'
  | 'products';

export type ApplicationDataKey = CollectionKey | 'admin-config' | 'groups';

const collections: Record<CollectionKey, { table: string; filename: string }> = {
  operations: { table: 'app_operations', filename: 'operations.json' },
  subscriptions: { table: 'app_subscriptions', filename: 'subscriptions.json' },
  activities: { table: 'app_activities', filename: 'activities.json' },
  documents: { table: 'app_documents', filename: 'documents.json' },
  courses: { table: 'app_courses', filename: 'courses.json' },
  'course-categories': { table: 'app_course_categories', filename: 'course-categories.json' },
  'audit-logs': { table: 'app_audit_logs', filename: 'audit-logs.json' },
  products: { table: 'app_products', filename: 'products.json' }
};

const documents = {
  'admin-config': { table: 'app_admin_config', filename: 'admin-config.json' },
  groups: { table: 'app_groups', filename: 'groups.json' }
} as const;

const isCollectionKey = (key: ApplicationDataKey): key is CollectionKey => key in collections;

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

async function hasMigration(client: PoolClient, key: ApplicationDataKey): Promise<boolean> {
  const result = await client.query(
    'SELECT 1 FROM app_data_migrations WHERE resource_key = $1',
    [key]
  );
  return result.rowCount !== 0;
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
     ON CONFLICT (resource_key) DO NOTHING`,
    [key, filename, sourcePresent, importedCount]
  );
}

async function migrateCollection(
  client: PoolClient,
  dataDir: string,
  key: CollectionKey
): Promise<void> {
  if (await hasMigration(client, key)) return;

  const { table, filename } = collections[key];
  const source = migrationSource(dataDir, filename);
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
  if (await hasMigration(client, key)) return;

  const { table, filename } = documents[key];
  const source = migrationSource(dataDir, filename);
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
    masterPasswordHash: '',
    masterPasswordHint: '',
    admins: [],
    activeTokens: {}
  };
}

export async function initializeApplicationStore(
  dataDir: string,
  defaultAdminConfig: unknown
): Promise<void> {
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
  const pool = getDatabasePool();
  if (isCollectionKey(key)) {
    const { table } = collections[key];
    const result = await pool.query<{ payload: T }>(
      `SELECT payload FROM ${table} ORDER BY position ASC, id ASC`
    );
    if (result.rows.length > 0) return result.rows.map((row) => row.payload) as T;

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

export async function saveApplicationBackup(id: string, value: unknown): Promise<void> {
  await getDatabasePool().query(
    'INSERT INTO app_backups (id, payload) VALUES ($1, $2::jsonb)',
    [id, JSON.stringify(value)]
  );
}
