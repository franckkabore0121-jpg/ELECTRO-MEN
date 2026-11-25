import { describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { buildPostgresPoolConfig } from './investorStore.ts';

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

  it('configures Neon (*.neon.tech) URLs with ssl: { rejectUnauthorized: false } in local and Vercel modes', () => {
    const withQuery = buildPostgresPoolConfig(
      'postgresql://neondb_owner:pass@ep-cool-rain-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
      true
    );
    expect(withQuery.ssl).toEqual({ rejectUnauthorized: false });
    expect(withQuery.connectionString).toContain('channel_binding=require');
    expect(withQuery.connectionString).not.toContain('sslmode=require');
    expect(new Client(withQuery).ssl).toEqual({ rejectUnauthorized: false });

    const withoutQuery = buildPostgresPoolConfig(
      'postgresql://neondb_owner:pass@ep-cool-rain-123456.us-east-2.aws.neon.tech/neondb',
      false
    );
    expect(withoutQuery.ssl).toEqual({ rejectUnauthorized: false });
    expect(new Client(withoutQuery).ssl).toEqual({ rejectUnauthorized: false });
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
