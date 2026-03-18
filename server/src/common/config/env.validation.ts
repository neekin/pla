import { z } from 'zod';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(12, 'JWT_SECRET 过短，至少 12 位').optional(),
  DB_TYPE: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.literal('postgres').default('postgres'),
  ),
  DB_SYNCHRONIZE: z.string().optional(),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SECURITY_ALERT_EMAIL: z.string().email().optional(),
});

const postgresSchema = baseSchema.extend({
  DB_TYPE: z.literal('postgres'),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
});

const schema = postgresSchema;

export function validateEnvOrThrow() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`环境变量校验失败: ${message}`);
  }

  if (result.data.NODE_ENV === 'production') {
    const jwtSecret = result.data.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('生产环境必须配置 JWT_SECRET');
    }

    if (jwtSecret === 'dev-secret-change-me') {
      throw new Error('生产环境禁止使用默认 JWT_SECRET');
    }
  }

  if (
    result.data.NODE_ENV === 'production'
    && (process.env.DB_SYNCHRONIZE ?? 'false') === 'true'
  ) {
    throw new Error('生产环境禁止 DB_SYNCHRONIZE=true');
  }
}
