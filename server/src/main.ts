import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/app.router';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isDevelopment = process.env.NODE_ENV === 'development';

  app.enableCors({
    origin: 'http://localhost:5173',
  });

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
        pathFilter: (pathname) => !pathname.startsWith('/trpc'),
      }),
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
