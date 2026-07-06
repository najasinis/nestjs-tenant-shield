/**
 * B-2. 동시성 / ALS 컨텍스트 누수 하네스
 *
 * 하드 게이트: ALS 컨텍스트 bleed 0건
 * PRD §10 실패모드 #6 (race condition) 실증.
 * Promise.all + setTimeout 경계로 컨텍스트 스위칭을 강제한 뒤,
 * 각 비동기 작업이 자기 tenant 데이터만 보는지 검증.
 */
import { DataSource, Repository } from 'typeorm';
import { faker } from '@faker-js/faker';
import { runWithTenant } from '../../src/context/run-with-tenant';
import { getCurrentTenantId } from '../../src/context/get-current-tenant-id';
import {
  HardeningPost,
  createTestDataSource,
  seedTenants,
} from './helpers';

const CONCURRENT_TENANTS = 50;
const ROWS_PER_TENANT = 10;

describe('B-2: 동시성 / ALS 컨텍스트 누수 (하드 게이트 — bleed 0건)', () => {
  let ds: DataSource;
  let repo: Repository<HardeningPost>;
  let tenants: string[];

  beforeAll(async () => {
    ds = await createTestDataSource();
    repo = ds.getRepository(HardeningPost);
    tenants = Array.from({ length: CONCURRENT_TENANTS }, () => faker.string.uuid());
    await seedTenants(ds, tenants, ROWS_PER_TENANT);
  }, 15_000);

  afterAll(async () => {
    await ds.destroy();
  });

  it('동시에 실행되는 tenant 컨텍스트들이 서로 bleed되지 않는다', async () => {
    let bleeds = 0;

    const tasks = tenants.map((tenantId) =>
      runWithTenant(tenantId, async () => {
        // await 경계 + setTimeout으로 컨텍스트 전환 유도
        await new Promise<void>((r) =>
          setTimeout(r, Math.floor(Math.random() * 10)),
        );

        // ALS bleed 검증: 현재 컨텍스트가 출발한 tenant와 동일해야 함
        const ctx = getCurrentTenantId();
        if (ctx !== tenantId) bleeds++;

        // DB 쿼리 경유 검증
        await new Promise<void>((r) =>
          setTimeout(r, Math.floor(Math.random() * 5)),
        );

        const rows = await repo.find();
        for (const row of rows) {
          if (row.tenantId !== tenantId) bleeds++;
        }
      }),
    );

    await Promise.all(tasks);
    expect(bleeds).toBe(0);
  }, 30_000);

  it('중첩 runWithTenant는 내부 컨텍스트가 우선하고 외부 컨텍스트로 정확히 복귀한다', async () => {
    const outer = tenants[0];
    const inner = tenants[1];

    await runWithTenant(outer, async () => {
      expect(getCurrentTenantId()).toBe(outer);

      await runWithTenant(inner, async () => {
        expect(getCurrentTenantId()).toBe(inner);
      });

      // 내부 컨텍스트가 끝난 뒤 외부로 정확히 복귀
      expect(getCurrentTenantId()).toBe(outer);
    });
  });

  it('여러 tenant 작업이 인터리빙돼도 각자 올바른 row 수를 본다', async () => {
    const sample = tenants.slice(0, 5);

    const results = await Promise.all(
      sample.map((tenantId) =>
        runWithTenant(tenantId, async () => {
          await new Promise<void>((r) => setTimeout(r, Math.random() * 5));
          const rows = await repo.find();
          return { tenantId, count: rows.length, allOwned: rows.every((r) => r.tenantId === tenantId) };
        }),
      ),
    );

    for (const result of results) {
      expect(result.allOwned).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    }
  }, 15_000);
});
