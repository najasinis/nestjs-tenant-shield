import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3001);
  console.log('Prisma SaaS example running on http://localhost:3001');
  console.log('Try: curl -H "x-tenant-id: academy-A" http://localhost:3001/students');
}

bootstrap();
