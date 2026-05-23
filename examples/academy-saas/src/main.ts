import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { runWithTenant, runWithoutTenant } from 'nestjs-tenant-shield';
import { AppModule } from './app.module';
import { Student } from './students/student.entity';

async function seed(ds: DataSource) {
  const repo = ds.getRepository(Student);
  const count = await runWithoutTenant(() => repo.count());
  if (count > 0) return;

  await runWithTenant('academy-A', () =>
    repo.save([
      repo.create({ name: '김민준', grade: 2 }),
      repo.create({ name: '이서연', grade: 3 }),
    ]),
  );
  await runWithTenant('academy-B', () =>
    repo.save([
      repo.create({ name: '박도현', grade: 1 }),
      repo.create({ name: '최유진', grade: 2 }),
    ]),
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });

  await seed(app.get(DataSource));
  await app.listen(3000);

  console.log('\n──────────────────────────────────────────────');
  console.log('  학원 SaaS 데모  →  http://localhost:3000');
  console.log('──────────────────────────────────────────────\n');
  console.log('# A 학원 학생 목록 (A 것만 나옴)');
  console.log('curl -s -H "x-tenant-id: academy-A" http://localhost:3000/students\n');
  console.log('# B 학원 학생 목록 (B 것만 나옴)');
  console.log('curl -s -H "x-tenant-id: academy-B" http://localhost:3000/students\n');
  console.log('# A 학원에 학생 추가 — tenantId는 헤더에서 자동 주입');
  console.log('curl -s -X POST -H "x-tenant-id: academy-A" \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"name":"신규학생","grade":1}\' \\');
  console.log('     http://localhost:3000/students\n');
  console.log('# 통계 (Cacheable 데모 — 두 번째 호출부터 캐시 hit)');
  console.log('curl -s -H "x-tenant-id: academy-A" http://localhost:3000/students/stats\n');
  console.log('# 헤더 없음 → MissingTenantContextError (격리 증명)');
  console.log('curl -s http://localhost:3000/students\n');
}

bootstrap().catch(console.error);
