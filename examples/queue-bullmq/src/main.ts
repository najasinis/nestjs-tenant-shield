import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3002);
  console.log('BullMQ example running on http://localhost:3002');
  console.log('Requires Redis: docker run -p 6379:6379 redis:7-alpine');
  console.log('Try: curl -X POST -H "x-tenant-id: academy-A" -H "Content-Type: application/json" -d \'{"month":"2026-05"}\' http://localhost:3002/reports/schedule');
}

bootstrap();
