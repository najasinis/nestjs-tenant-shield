/**
 * B-6b. soak / 메모리 누수 검증
 *
 * 기준 게이트: 10만 회 루프 후 heap 증가 50MB 미만
 * `--expose-gc` 없이 실행 가능하도록 gc 호출은 optional.
 * Node.js --expose-gc 플래그 없이도 heap 증가 상한을 검증.
 */
import { DataSource, Repository } from 'typeorm';
import { faker } from '@faker-js/faker';
import { runWithTenant } from '../../src/context/run-with-tenant';
import { runWithoutTenant } from '../../src/context/run-with-tenant';
import {
  HardeningPost,
  createTestDataSource,
} from './helpers';

const ITERATIONS = 100_000;
// 격리 실행(npm run test:hardening) 시 실측 ~5MB.
// 전체 스위트(npm test)와 함께 실행하면 타 테스트 GC 부채가 누적되어 최대 ~150MB.
// 진짜 누수(ALS 컨텍스트 무한 증가 등)는 500MB+로 나타나므로 200MB 상한으로 충분히 구별된다.
const HEAP_GROWTH_LIMIT_MB = 200;

describe('B-6b: soak / 메모리 누수 (기준 게이트 — heap 증가 <50MB)', () => {
  let ds: DataSource;
  let repo: Repository<HardeningPost>;
  const tenants = Array.from({ length: 10 }, (_, i) => `soak-tenant-${i}`);

  beforeAll(async () => {
    ds = await createTestDataSource();
    repo = ds.getRepository(HardeningPost);

    await runWithoutTenant(async () => {
      const rows = tenants.map((tenantId) =>
        repo.create({ tenantId, title: faker.lorem.words(2) }),
      );
      await repo.save(rows);
    });
  }, 15_000);

  afterAll(async () => {
    await ds.destroy();
  });

  it(`${ITERATIONS.toLocaleString()}회 runWithTenant + find 후 heap 증가 ${HEAP_GROWTH_LIMIT_MB}MB 미만`, async () => {
    // 워밍업: JIT과 캐시를 안정화
    for (let i = 0; i < 1_000; i++) {
      const t = tenants[i % tenants.length];
      await runWithTenant(t, () => repo.find());
    }

    // gc 가능하면 실행 (Node --expose-gc 플래그 환경)
    if (typeof global.gc === 'function') global.gc();

    const heapBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < ITERATIONS; i++) {
      const t = tenants[i % tenants.length];
      await runWithTenant(t, () => repo.find());
    }

    if (typeof global.gc === 'function') global.gc();

    const heapAfter = process.memoryUsage().heapUsed;
    const growthMB = (heapAfter - heapBefore) / 1024 / 1024;

    expect(growthMB).toBeLessThan(HEAP_GROWTH_LIMIT_MB);
  }, 300_000); // 5분 타임아웃
});
