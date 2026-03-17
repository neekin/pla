import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/app.router';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isDevelopment = process.env.NODE_ENV === 'development';
  const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

  app.enableCors({
    origin: frontendOrigin,
  });

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
          ];
          return !backendPrefixes.some((prefix) => pathname.startsWith(prefix));
        },
      }),
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
