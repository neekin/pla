import { readdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const MIGRATIONS_DIR = resolve(process.cwd(), 'database', 'migrations');

async function run() {
  const pairs = loadMigrationPairs();

  if (pairs.length === 0) {
    throw new Error('No migration files found in database/migrations');
  }

  for (const pair of pairs) {
    if (!pair.upSql.trim() || !pair.downSql.trim()) {
      throw new Error(`Migration SQL cannot be empty: ${pair.id}`);
    }
  }

  const client = new Client(buildDbConfig());
  await client.connect();

  const schemaName = `migration_drill_${Date.now()}_${randomUUID().slice(0, 8)}`;

  try {
    await client.query(`CREATE SCHEMA ${schemaName}`);
    await client.query(`SET search_path TO ${schemaName}`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(128) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const migration of pairs) {
      await executeWithinTx(client, async () => {
        await client.query(migration.upSql);
        await client.query('INSERT INTO schema_migrations(id) VALUES($1)', [migration.id]);
      });
    }

    for (const migration of [...pairs].reverse()) {
      await executeWithinTx(client, async () => {
        await client.query(migration.downSql);
        await client.query('DELETE FROM schema_migrations WHERE id = $1', [migration.id]);
      });
    }

    console.log('✅ Migration gate passed: up/down rollback drill succeeded.');
  } finally {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await client.end();
  }
}

function buildDbConfig() {
  return {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'gigpayday',
    ssl: (process.env.DB_SSL ?? 'false') === 'true' ? { rejectUnauthorized: false } : undefined,
  };
}

function loadMigrationPairs() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const map = new Map();

  for (const fileName of files) {
    const match = fileName.match(/^(\d+_[a-z0-9_]+)\.(up|down)\.sql$/i);

    if (!match) {
      continue;
    }

    const id = match[1];
    const direction = match[2];
    const value = map.get(id) ?? { id, upFile: null, downFile: null };

    if (direction === 'up') {
      value.upFile = fileName;
    } else {
      value.downFile = fileName;
    }

    map.set(id, value);
  }

  const pairs = Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));

  for (const pair of pairs) {
    if (!pair.upFile || !pair.downFile) {
      throw new Error(`Migration pair missing up/down file: ${pair.id}`);
    }
  }

  return pairs.map((pair) => ({
    id: pair.id,
    upSql: readFileSync(resolve(MIGRATIONS_DIR, pair.upFile), 'utf8'),
    downSql: readFileSync(resolve(MIGRATIONS_DIR, pair.downFile), 'utf8'),
  }));
}

async function executeWithinTx(client, fn) {
  await client.query('BEGIN');
  try {
    await fn();
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

run().catch((error) => {
  console.error('❌ Migration gate failed.');
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
