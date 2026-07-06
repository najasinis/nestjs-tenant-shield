/**
 * B-1. 대규모 격리 fuzz 하네스
 *
 * 하드 게이트: cross-tenant read 누출 0건
 * 다양한 read API(find / findBy / findOne / QueryBuilder)에서
 * 반환된 모든 row의 tenantId가 현재 컨텍스트와 일치하는지 K회 검증.
 */
import { DataSource, Repository } from 'typeorm';
import { faker } from '@faker-js/faker';
import { runWithTenant } from '../../src/context/run-with-tenant';
import { CrossTenantAccessError } from '../../src/errors/cross-tenant-access.error';
import {
  HardeningPost,
  createTestDataSource,
  seedTenants,
  randomElement,
} from './helpers';

const TENANT_COUNT = 20;
const ROWS_PER_TENANT = 30;
const ITERATIONS = 1_000;

describe('B-1: 대규모 격리 fuzz (하드 게이트 — 누출 0건)', () => {
  let ds: DataSource;
  let repo: Repository<HardeningPost>;
  let tenants: string[];

  beforeAll(async () => {
    ds = await createTestDataSource();
    repo = ds.getRepository(HardeningPost);
    tenants = Array.from({ length: TENANT_COUNT }, () => faker.string.uuid());
    await seedTenants(ds, tenants, ROWS_PER_TENANT);
  }, 30_000);

  afterAll(async () => {
    await ds.destroy();
  });

  it(`${ITERATIONS}회 무작위 tenant 컨텍스트 + 무작위 read API → 누출 0건`, async () => {
    let leaks = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const targetTenant = randomElement(tenants);
      const apiIndex = i % 4;

      await runWithTenant(targetTenant, async () => {
        let rows: HardeningPost[] = [];

        switch (apiIndex) {
          case 0:
            rows = await repo.find();
            break;
          case 1:
            rows = await repo.findBy({});
            break;
          case 2: {
            const row = await repo.findOne({ where: {} as any });
            rows = row ? [row] : [];
            break;
          }
          case 3:
            rows = await repo
              .createQueryBuilder('p')
              .getMany();
            break;
        }

        for (const row of rows) {
          if (row.tenantId !== targetTenant) {
            leaks++;
          }
        }
      });
    }

    expect(leaks).toBe(0);
  }, 60_000);

  it('afterLoad 안전망: save로 삽입된 row의 tenantId는 항상 컨텍스트와 일치한다', async () => {
    const tenant = randomElement(tenants);
    await runWithTenant(tenant, async () => {
      const saved = await repo.save(
        repo.create({ title: faker.lorem.words(2) }),
      );
      expect(saved.tenantId).toBe(tenant);
    });
  });

  it('다른 tenantId로 save 시도하면 CrossTenantAccessError를 던진다', async () => {
    const [writer, victim] = tenants;
    await runWithTenant(writer, async () => {
      await expect(
        repo.save(repo.create({ tenantId: victim, title: 'hack' })),
      ).rejects.toThrow(CrossTenantAccessError);
    });
  });
});
