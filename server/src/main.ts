import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/app.router';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { JsonLogger } from './common/json-logger';
import { initTelemetry, shutdownTelemetry } from './common/telemetry';
import { validateEnvOrThrow } from './common/config/env.validation';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createTrpcContext } from './trpc/context';

async function bootstrap() {
  validateEnvOrThrow();
  await initTelemetry();

  const useJsonLogger = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    ...(useJsonLogger ? { logger: new JsonLogger() } : {}),
  });
  const isDevelopment = process.env.NODE_ENV === 'development';
  const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

  app.enableCors({
    origin: frontendOrigin,
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: createTrpcContext,
    }),
  );

  if (isDevelopment) {
    app.use(
      createProxyMiddleware({
        target: 'http://localhost:5173',
        changeOrigin: true,
        ws: true,
        pathFilter: (pathname) => {
          const backendPrefixes = [
            '/trpc',
            '/auth',
            '/tasks',
            '/system',
            '/tenants',
            '/iam',
            '/billing',
          ];
          return !backendPrefixes.some((prefix) => pathname.startsWith(prefix));
        },
      }),
    );
  }

  await app.listen(process.env.PORT ?? 3000);

  const gracefulShutdown = async () => {
    await app.close();
    await shutdownTelemetry();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void gracefulShutdown();
  });

  process.on('SIGTERM', () => {
    void gracefulShutdown();
  });
}
bootstrap();
