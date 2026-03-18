const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();
const dbSynchronize = (process.env.DB_SYNCHRONIZE ?? 'true').toLowerCase() === 'true';

if (nodeEnv === 'production' && dbSynchronize) {
  console.error('❌ DB gate failed: DB_SYNCHRONIZE must be false in production.');
  process.exit(1);
}

console.log('✅ DB gate passed.');
