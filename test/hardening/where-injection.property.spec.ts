/**
 * B-3. property-based WHERE 주입 검증
 *
 * 하드 게이트: WHERE 불변식 위반 0건
 * fast-check로 무작위 FindManyOptions를 생성하여,
 * Repository.find(options)가 항상 현재 tenant의 row만 반환하는지 검증.
 * (applyTenantToFindOptions는 내부 함수이므로 public API를 통해 간접 검증)
 */
import * as fc from 'fast-check';
import { DataSource, Repository } from 'typeorm';
import { faker } from '@faker-js/faker';
import { runWithTenant } from '../../src/context/run-with-tenant';
import { runWithoutTenant } from '../../src/context/run-with-tenant';
import {
  HardeningPost,
  createTestDataSource,
} from './helpers';

describe('B-3: property-based WHERE 불변식 (하드 게이트 — 위반 0건)', () => {
  let ds: DataSource;
  let repo: Repository<HardeningPost>;
  const tenantA = 'prop-tenant-A';
  const tenantB = 'prop-tenant-B';

  beforeAll(async () => {
    ds = await createTestDataSource();
    repo = ds.getRepository(HardeningPost);

    await runWithoutTenant(async () => {
      await repo.save([
        repo.create({ tenantId: tenantA, title: 'alpha' }),
        repo.create({ tenantId: tenantA, title: 'beta' }),
        repo.create({ tenantId: tenantA, title: 'gamma' }),
        repo.create({ tenantId: tenantB, title: 'delta' }),
        repo.create({ tenantId: tenantB, title: 'epsilon' }),
      ]);
    });
  }, 15_000);

  afterAll(async () => {
    await ds.destroy();
  });

  it('임의 where 옵션을 넣어도 항상 현재 tenant row만 반환된다 (fast-check)', async () => {
    // SQLite에서 지원하는 단순 컬럼 필터 where 조합을 생성
    const titleArb = fc.oneof(
      fc.constant(undefined),
      fc.constantFrom('alpha', 'beta', 'gamma', 'delta', 'epsilon', 'nonexistent'),
    );

    await fc.assert(
      fc.asyncProperty(titleArb, async (title) => {
        const whereOption = title !== undefined ? { title } : {};

        let violated = false;
        await runWithTenant(tenantA, async () => {
          const rows = await repo.find({ where: whereOption as any });
          for (const row of rows) {
            if (row.tenantId !== tenantA) violated = true;
          }
        });
        return !violated;
      }),
      { numRuns: 200, verbose: true },
    );
  }, 60_000);

  it('빈 where 옵션({})도 격리된다', async () => {
    await runWithTenant(tenantA, async () => {
      const rows = await repo.find({ where: {} as any });
      expect(rows.every((r) => r.tenantId === tenantA)).toBe(true);
    });
  });

  it('where 없는 find()도 격리된다', async () => {
    await runWithTenant(tenantB, async () => {
      const rows = await repo.find();
      expect(rows.every((r) => r.tenantId === tenantB)).toBe(true);
    });
  });

  it('존재하지 않는 title로 find해도 다른 tenant row를 반환하지 않는다', async () => {
    await runWithTenant(tenantA, async () => {
      // tenantB에만 있는 'delta'를 tenantA 컨텍스트에서 검색
      const rows = await repo.find({ where: { title: 'delta' } });
      expect(rows).toHaveLength(0);
    });
  });

  it('faker로 생성된 임의 title 100개에 대해 격리 불변식이 성립한다', async () => {
    let leaks = 0;
    for (let i = 0; i < 100; i++) {
      const randomTitle = faker.lorem.word();
      await runWithTenant(tenantA, async () => {
        const rows = await repo.find({ where: { title: randomTitle } });
        for (const row of rows) {
          if (row.tenantId !== tenantA) leaks++;
        }
      });
    }
    expect(leaks).toBe(0);
  }, 30_000);
});
