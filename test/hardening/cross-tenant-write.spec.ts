/**
 * B-4. cross-tenant 쓰기(insert/update/delete) 대규모 검증
 *
 * 하드 게이트: cross-tenant write 누출 0건
 * 무작위로 "다른 tenant id로 저장/수정 시도" → 항상 CrossTenantAccessError
 */
import { DataSource, Repository } from 'typeorm';
import { faker } from '@faker-js/faker';
import { runWithTenant } from '../../src/context/run-with-tenant';
import { runWithoutTenant } from '../../src/context/run-with-tenant';
import { CrossTenantAccessError } from '../../src/errors/cross-tenant-access.error';
import {
  HardeningPost,
  createTestDataSource,
  seedTenants,
  randomElement,
} from './helpers';

const TENANT_COUNT = 10;
const ROWS_PER_TENANT = 20;
const WRITE_ATTEMPTS = 500;

describe('B-4: cross-tenant 쓰기 차단 (하드 게이트 — 누출 0건)', () => {
  let ds: DataSource;
  let repo: Repository<HardeningPost>;
  let tenants: string[];

  beforeAll(async () => {
    ds = await createTestDataSource();
    repo = ds.getRepository(HardeningPost);
    tenants = Array.from({ length: TENANT_COUNT }, () => faker.string.uuid());
    await seedTenants(ds, tenants, ROWS_PER_TENANT);
  }, 15_000);

  afterAll(async () => {
    await ds.destroy();
  });

  it(`${WRITE_ATTEMPTS}회 cross-tenant insert 시도 → 전부 CrossTenantAccessError`, async () => {
    let blocked = 0;
    let leaked = 0;

    for (let i = 0; i < WRITE_ATTEMPTS; i++) {
      const writer = randomElement(tenants);
      const victim = randomElement(tenants.filter((t) => t !== writer));

      await runWithTenant(writer, async () => {
        try {
          await repo.save(
            repo.create({ tenantId: victim, title: faker.lorem.words(2) }),
          );
          leaked++; // 여기 도달하면 누출
        } catch (err) {
          if (err instanceof CrossTenantAccessError) {
            blocked++;
          } else {
            throw err; // 예상 밖 에러는 테스트 실패로 전파
          }
        }
      });
    }

    expect(leaked).toBe(0);
    expect(blocked).toBe(WRITE_ATTEMPTS);
  }, 60_000);

  it('같은 tenant의 row는 정상적으로 저장된다 (false positive 없음)', async () => {
    const tenant = randomElement(tenants);
    await runWithTenant(tenant, async () => {
      const saved = await repo.save(
        repo.create({ title: faker.lorem.words(2) }),
      );
      expect(saved.tenantId).toBe(tenant);
      expect(saved.id).toBeDefined();
    });
  });

  it('update 시 save로 다른 tenant row 수정 시도 → CrossTenantAccessError', async () => {
    const [tenantA, tenantB] = tenants;

    // tenantB row 하나를 먼저 가져옴
    let victimId: number;
    await runWithoutTenant(async () => {
      const rows = await repo.find({ where: { tenantId: tenantB } });
      victimId = rows[0].id;
    });

    await runWithTenant(tenantA, async () => {
      // tenantA 컨텍스트에서 tenantB id를 직접 지정해 save 시도
      await expect(
        repo.save({ id: victimId!, tenantId: tenantB, title: 'hacked' }),
      ).rejects.toThrow(CrossTenantAccessError);
    });
  });

  it('delete: tenantId 명시 없는 QueryBuilder.delete()는 현재 tenant row만 삭제한다', async () => {
    const [tenantA, tenantB] = tenants;

    let beforeB: number;
    await runWithoutTenant(async () => {
      beforeB = await repo.count({ where: { tenantId: tenantB } });
    });

    // tenantA 컨텍스트에서 tenantId 명시 없이 delete → subscriber가 AND tenantId = tenantA 추가
    await runWithTenant(tenantA, async () => {
      await repo
        .createQueryBuilder()
        .delete()
        .from(HardeningPost)
        .where('1 = 1') // tenantId 조건 없이 "전부 삭제" 시도
        .execute();
    });

    let afterB: number;
    await runWithoutTenant(async () => {
      afterB = await repo.count({ where: { tenantId: tenantB } });
    });

    // tenantB row는 그대로여야 한다 (tenantA 컨텍스트의 delete는 tenantA row에만 영향)
    expect(afterB!).toBe(beforeB!);
  });
});
