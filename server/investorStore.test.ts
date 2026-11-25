import { describe, expect, it } from 'vitest';
import { Client } from 'pg';
import {
  buildPostgresPoolConfig,
  getSafePostgresTarget,
  redactPostgresCredentials,
  sanitizeDatabaseUrlInput
} from './investorStore.ts';

describe('buildPostgresPoolConfig', () => {
  it('strips ?sslmode=require for Supabase URLs and applies rejectUnauthorized: false in pg.Client', () => {
    const config = buildPostgresPoolConfig(
      'postgresql://postgres.ref:MyP%40ssword@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true',
      true
    );

    expect(config.ssl).toEqual({ rejectUnauthorized: false });
    expect(config.connectionString).toContain('MyP%40ssword');
    expect(config.connectionString).toContain('pgbouncer=true');
    expect(config.connectionString).not.toContain('sslmode=require');

    const client = new Client(config);
    expect(client.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('configures Neon (*.neon.tech) URLs with ssl: { rejectUnauthorized: false } without altering credentials or query params', () => {
    const withQuery = buildPostgresPoolConfig(
      'postgresql://neondb_owner:npg_Sec%2Bret%401@ep-cool-rain-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
      true
    );
    expect(withQuery.ssl).toEqual({ rejectUnauthorized: false });
    expect(withQuery.connectionString).toBe(
      'postgresql://neondb_owner:npg_Sec%2Bret%401@ep-cool-rain-123456-pooler.us-east-2.aws.neon.tech/neondb?channel_binding=require'
    );
    expect(new Client(withQuery).ssl).toEqual({ rejectUnauthorized: false });

    const withoutQuery = buildPostgresPoolConfig(
      'postgresql://neondb_owner:pass@ep-cool-rain-123456.us-east-2.aws.neon.tech/neondb',
      false
    );
    expect(withoutQuery.ssl).toEqual({ rejectUnauthorized: false });
    expect(new Client(withoutQuery).ssl).toEqual({ rejectUnauthorized: false });
  });

  it('sanitizes accidental quotes or psql prefix and never leaks passwords in logs/targets', () => {
    const cleaned = sanitizeDatabaseUrlInput(`psql 'postgresql://neondb_owner:MySecret%4099@ep-test.neon.tech/neondb?sslmode=require'`);
    expect(cleaned).toBe('postgresql://neondb_owner:MySecret%4099@ep-test.neon.tech/neondb?sslmode=require');

    const target = getSafePostgresTarget(cleaned);
    expect(target).toEqual({
      host: 'ep-test.neon.tech',
      port: undefined,
      database: 'neondb',
      user: 'neondb_owner',
      sslMode: 'require'
    });
    expect(JSON.stringify(target)).not.toContain('MySecret');

    const redacted = redactPostgresCredentials('connect postgresql://neondb_owner:MySecret%4099@ep-test.neon.tech/neondb failed');
    expect(redacted).not.toContain('MySecret');
    expect(redacted).toContain('neondb_owner:***@ep-test.neon.tech');
  });

  it('keeps local development connections without forced SSL', () => {
    const config = buildPostgresPoolConfig('postgresql://postgres:secret@localhost:5432/electromen', false);
    expect(config.ssl).toBeUndefined();
  });

  it('respects explicit sslmode=disable and sslmode=verify-full', () => {
    const disabled = buildPostgresPoolConfig(
      'postgresql://postgres:secret@db.example.com:5432/app?sslmode=disable',
      true
    );
    expect(disabled.ssl).toBeUndefined();
    expect(disabled.connectionString).toContain('sslmode=disable');

    const verified = buildPostgresPoolConfig(
      'postgresql://postgres:secret@db.example.com:5432/app?sslmode=verify-full',
      true
    );
    expect(verified.ssl).toBeUndefined();
    expect(verified.connectionString).toContain('sslmode=verify-full');
  });
});
