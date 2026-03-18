import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const MIGRATIONS_DIR = resolve(process.cwd(), 'database', 'migrations');

const command = process.argv[2] ?? 'status';
const countArg = Number(process.argv[3] ?? '1');
const jsonOutput = process.argv.includes('--json');

const client = new Client(buildDbConfig());

try {
  await client.connect();
  await ensureMigrationsTable(client);

  const migrationPairs = loadMigrationPairs();
  const applied = await getAppliedMigrations(client);

  if (command === 'status') {
    const payload = buildStatusPayload(migrationPairs, applied);
    printPayload(payload, jsonOutput);
    process.exit(0);
  }

  if (command === 'up') {
    const pending = migrationPairs.filter((item) => !applied.has(item.id));

    for (const migration of pending) {
      await applyMigration(client, migration);
    }

    const payload = {
      ok: true,
      action: 'up',
      applied: pending.map((item) => item.id),
      count: pending.length,
    };
    printPayload(payload, jsonOutput);
    process.exit(0);
  }

  if (command === 'down') {
    const appliedList = migrationPairs.filter((item) => applied.has(item.id));
    const target = appliedList.slice(-Math.max(1, countArg)).reverse();

    for (const migration of target) {
      await revertMigration(client, migration);
    }

    const payload = {
      ok: true,
      action: 'down',
      reverted: target.map((item) => item.id),
      count: target.length,
    };
    printPayload(payload, jsonOutput);
    process.exit(0);
  }

  console.error(`Unsupported command: ${command}`);
  process.exit(1);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonOutput) {
    console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  } else {
    console.error(`❌ Migration command failed: ${message}`);
  }
  process.exit(1);
} finally {
  await client.end();
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

async function ensureMigrationsTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(128) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
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
    const previous = map.get(id) ?? { id, upFile: null, downFile: null };

    if (direction === 'up') {
      previous.upFile = fileName;
    } else {
      previous.downFile = fileName;
    }

    map.set(id, previous);
  }

  const migrations = Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));

  for (const migration of migrations) {
    if (!migration.upFile || !migration.downFile) {
      throw new Error(`Migration pair incomplete: ${migration.id}`);
    }
  }

  return migrations.map((migration) => ({
    ...migration,
    upSql: readSql(migration.upFile),
    downSql: readSql(migration.downFile),
  }));
}

function readSql(fileName) {
  return readFileSync(resolve(MIGRATIONS_DIR, fileName), 'utf8');
}

async function getAppliedMigrations(db) {
  const result = await db.query('SELECT id FROM schema_migrations ORDER BY id ASC');
  return new Set(result.rows.map((row) => row.id));
}

async function applyMigration(db, migration) {
  await db.query('BEGIN');
  try {
    await db.query(migration.upSql);
    await db.query('INSERT INTO schema_migrations(id) VALUES($1)', [migration.id]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function revertMigration(db, migration) {
  await db.query('BEGIN');
  try {
    await db.query(migration.downSql);
    await db.query('DELETE FROM schema_migrations WHERE id = $1', [migration.id]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

function buildStatusPayload(migrations, applied) {
  return {
    ok: true,
    total: migrations.length,
    applied: migrations.filter((item) => applied.has(item.id)).map((item) => item.id),
    pending: migrations.filter((item) => !applied.has(item.id)).map((item) => item.id),
  };
}

function printPayload(payload, asJson) {
  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if ('pending' in payload) {
    console.log(`Total: ${payload.total}`);
    console.log(`Applied: ${payload.applied.length}`);
    console.log(`Pending: ${payload.pending.length}`);
    for (const item of payload.pending) {
      console.log(`- ${item}`);
    }
    return;
  }

  if ('applied' in payload) {
    console.log(`Applied migrations: ${payload.count}`);
    for (const item of payload.applied) {
      console.log(`- ${item}`);
    }
    return;
  }

  if ('reverted' in payload) {
    console.log(`Reverted migrations: ${payload.count}`);
    for (const item of payload.reverted) {
      console.log(`- ${item}`);
    }
  }
}
