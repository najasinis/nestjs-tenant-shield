import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3003);
  console.log('Redis cache example running on http://localhost:3003');
  console.log('Requires Redis: docker run -p 6379:6379 redis:7-alpine');
  console.log('First request (miss): curl -H "x-tenant-id: academy-A" http://localhost:3003/students');
  console.log('Second request (hit):  curl -H "x-tenant-id: academy-A" http://localhost:3003/students');
}

bootstrap();
