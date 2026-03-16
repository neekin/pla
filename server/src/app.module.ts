import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'static'),
      exclude: ['/trpc', '/trpc/*path'],
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
