import pg from 'pg';

const { Client } = pg;

async function run() {
  const dryRun = !process.argv.includes('--apply');
  const client = new Client({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'gigpayday',
  });

  await client.connect();

  try {
    const preview = await client.query(`
      SELECT id, status, retry_count, max_retry, last_error
      FROM tasks
      WHERE (status = 'failed' AND (last_error IS NULL OR last_error = ''))
         OR (status IN ('queued', 'running', 'retrying') AND retry_count > max_retry)
      ORDER BY updated_at DESC
      LIMIT 200
    `);

    console.log(`Found inconsistent rows: ${preview.rowCount}`);

    if (dryRun) {
      console.log('Dry run mode. Use --apply to execute data fix.');
      return;
    }

    await client.query('BEGIN');

    await client.query(`
      UPDATE tasks
      SET
        last_error = COALESCE(NULLIF(last_error, ''), 'DATA_REPAIRED_MISSING_ERROR'),
        updated_at = NOW()
      WHERE status = 'failed' AND (last_error IS NULL OR last_error = '')
    `);

    await client.query(`
      UPDATE tasks
      SET
        retry_count = GREATEST(0, LEAST(retry_count, max_retry)),
        status = CASE
          WHEN status = 'running' THEN 'retrying'
          ELSE status
        END,
        updated_at = NOW()
      WHERE status IN ('queued', 'running', 'retrying') AND retry_count > max_retry
    `);

    await client.query('COMMIT');
    console.log('✅ Data fix applied successfully.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('❌ Data fix failed.');
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
