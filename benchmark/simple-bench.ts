/**
 * nestjs-tenant-shield 순수 오버헤드 벤치마크
 *
 * 실행: npm run benchmark
 *
 * 측정 항목 (DB 없이 in-memory):
 *   1. AsyncLocalStorage round-trip (runWithTenant + getCurrentTenantId)
 *   2. withTenantPayload() 호출
 *   3. @TenantContext() 데코레이터 핸들러 호출
 *
 * TypeORM / Prisma DB 레벨 오버헤드는 실제 DB가 필요합니다.
 * examples/academy-saas/ 또는 test/e2e/postgres-integration.spec.ts를 참고하세요.
 */
import 'reflect-metadata';
import { runWithTenant, getCurrentTenantId } from '../src/context';
import { withTenantPayload } from '../src/bull';
import { TenantContext } from '../src/decorators/tenant-context.decorator';

const WARMUP = 1_000;
const ITERATIONS = 100_000;

async function bench(label: string, fn: () => Promise<void>): Promise<number> {
  for (let i = 0; i < WARMUP; i++) await fn();

  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) await fn();
  const elapsed = performance.now() - start;

  const avgMs = elapsed / ITERATIONS;
  const label_ = label.padEnd(50);
  console.log(`  ${label_}  ${avgMs.toFixed(5)} ms / call`);
  return avgMs;
}

class MockProcessor {
  @TenantContext()
  async handle(_job: { data: { tenantId: string } }): Promise<string> {
    return getCurrentTenantId() ?? '';
  }
}

async function main(): Promise<void> {
  const proc = new MockProcessor();

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  nestjs-tenant-shield — Pure Overhead Benchmark`);
  console.log(`  Node.js ${process.version} | ${ITERATIONS.toLocaleString()} iterations`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  await bench('runWithTenant() + getCurrentTenantId()', async () => {
    await runWithTenant('t', () => Promise.resolve(getCurrentTenantId()));
  });

  await bench('withTenantPayload({ key: "val" })', async () => {
    await runWithTenant('t', async () => {
      withTenantPayload({ key: 'val' });
    });
  });

  await bench('@TenantContext() handler invocation', async () => {
    await proc.handle({ data: { tenantId: 't' } });
  });

  console.log('\n  Note: TypeORM/Prisma DB overhead requires a live database.');
  console.log('  Use examples/academy-saas/ or test/e2e/ for end-to-end measurement.\n');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(console.error);
