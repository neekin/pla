import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function run() {
  process.env.DB_TYPE ??= 'postgres';
  process.env.DB_HOST ??= '127.0.0.1';
  process.env.DB_PORT ??= '5432';
  process.env.DB_USERNAME ??= 'postgres';
  process.env.DB_PASSWORD ??= 'postgres';
  process.env.DB_NAME ??= 'gigpayday';
  process.env.DB_SYNCHRONIZE ??= 'false';
  process.env.NODE_ENV ??= 'test';

  const appModulePath = resolve(process.cwd(), 'dist', 'app.module.js');
  const { AppModule } = await import(pathToFileURL(appModulePath).href);

  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('GigPayday API')
    .setDescription('GigPayday platform API contract')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  const outputPath = resolve(
    process.cwd(),
    process.env.OPENAPI_OUTPUT ?? 'openapi/openapi.generated.json',
  );

  writeFileSync(outputPath, JSON.stringify(document, null, 2) + '\n', 'utf-8');
  await app.close();

  console.log(`✅ OpenAPI exported: ${outputPath}`);
}

void run().catch((error) => {
  console.error('❌ OpenAPI export failed.');
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
