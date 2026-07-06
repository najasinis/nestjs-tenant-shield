/**
 * B-5. "90% rule" 정직성 테스트
 *
 * 하드 게이트: 문서-구현 불일치 0건
 * README / SECURITY.md가 "보호 안 됨"이라 명시한 경로가 실제로 문서대로 동작하는지,
 * "보호됨"이라 명시한 경로가 실제로 막히는지 검증.
 * 문서가 거짓말하지 않아야 한다.
 */
import { DataSource, Repository } from 'typeorm';
import { runWithTenant } from '../../src/context/run-with-tenant';
import { runWithoutTenant } from '../../src/context/run-with-tenant';
import { withTenantWhere } from '../../src/typeorm/raw-sql.helper';
import { CrossTenantAccessError } from '../../src/errors/cross-tenant-access.error';
import {
  HardeningPost,
  createTestDataSource,
} from './helpers';

const TENANT_A = 'honesty-tenant-A';
const TENANT_B = 'honesty-tenant-B';

describe('B-5: 90% rule 정직성 테스트 (하드 게이트 — 불일치 0건)', () => {
  let ds: DataSource;
  let repo: Repository<HardeningPost>;

  beforeAll(async () => {
    ds = await createTestDataSource();
    repo = ds.getRepository(HardeningPost);

    await runWithoutTenant(async () => {
      await repo.save([
        repo.create({ tenantId: TENANT_A, title: 'A-post-1' }),
        repo.create({ tenantId: TENANT_A, title: 'A-post-2' }),
        repo.create({ tenantId: TENANT_B, title: 'B-post-1' }),
        repo.create({ tenantId: TENANT_B, title: 'B-post-2' }),
      ]);
    });
  }, 15_000);

  afterAll(async () => {
    await ds.destroy();
  });

  // ──────────────────────────────────────────────────────────
  // 보호됨 검증 (막힌다고 문서에 쓴 것은 실제로 막혀야 한다)
  // ──────────────────────────────────────────────────────────

  it('[보호됨] Repository.find() 는 tenant 격리된다', async () => {
    await runWithTenant(TENANT_A, async () => {
      const rows = await repo.find();
      expect(rows.every((r) => r.tenantId === TENANT_A)).toBe(true);
      expect(rows.some((r) => r.tenantId === TENANT_B)).toBe(false);
    });
  });

  it('[보호됨] QueryBuilder.getMany() 는 tenant 격리된다', async () => {
    await runWithTenant(TENANT_A, async () => {
      const rows = await repo.createQueryBuilder('p').getMany();
      expect(rows.every((r) => r.tenantId === TENANT_A)).toBe(true);
    });
  });

  it('[보호됨] cross-tenant insert 는 throw한다', async () => {
    await runWithTenant(TENANT_A, async () => {
      await expect(
        repo.save(repo.create({ tenantId: TENANT_B, title: 'inject' })),
      ).rejects.toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────
  // 보호 안 됨 검증 (안 막힌다고 문서에 쓴 것은 실제로 안 막혀야 한다)
  // ──────────────────────────────────────────────────────────

  it('[보호 안 됨] raw SQL은 tenant 격리되지 않는다 (90% rule)', async () => {
    await runWithTenant(TENANT_A, async () => {
      // 라이브러리가 막지 않으므로 모든 tenant 데이터가 나온다 (문서대로)
      const allRows = await ds.query('SELECT * FROM hardening_post');
      const tenantBRows = allRows.filter(
        (r: any) => r.tenantId === TENANT_B,
      );
      // raw SQL은 실제로 누출됨 = 문서가 정직함
      expect(tenantBRows.length).toBeGreaterThan(0);
    });
  });

  it('[보호됨] withTenantWhere 헬퍼를 사용하면 raw SQL도 격리된다', async () => {
    await runWithTenant(TENANT_A, async () => {
      const { text, params } = withTenantWhere(
        'SELECT * FROM hardening_post',
        'tenantId',
      );
      const rows = await ds.query(text, params);
      expect(rows.every((r: any) => r.tenantId === TENANT_A)).toBe(true);
      expect(rows.some((r: any) => r.tenantId === TENANT_B)).toBe(false);
    });
  });

  it('[보호 안 됨] runWithoutTenant 안에서는 전체 데이터에 접근 가능하다 (시스템 작업 escape hatch)', async () => {
    await runWithoutTenant(async () => {
      const rows = await repo.find();
      const hasBoth =
        rows.some((r) => r.tenantId === TENANT_A) &&
        rows.some((r) => r.tenantId === TENANT_B);
      // runWithoutTenant는 의도된 escape hatch — 전체 접근 가능함이 정상
      expect(hasBoth).toBe(true);
    });
  });

  it('[보호됨] QueryBuilder에 명시적으로 다른 tenantId를 WHERE에 넣어도 afterLoad 안전망이 차단한다', async () => {
    // subscriber의 hasTenantWhere 체크는 WHERE 추가를 건너뛰지만,
    // afterLoad 최후 안전망이 잘못된 tenant 데이터를 잡아 CrossTenantAccessError를 던진다.
    await runWithTenant(TENANT_A, async () => {
      await expect(
        ds.createQueryBuilder(HardeningPost, 'p')
          .where('p.tenantId = :t', { t: TENANT_B })
          .getMany(),
      ).rejects.toThrow(CrossTenantAccessError);
    });
  });

  it('[보호됨] QueryBuilder DELETE에 명시적으로 다른 tenantId를 WHERE에 넣으면 CrossTenantAccessError를 던진다 (C-1.11 수정)', async () => {
    // C-1.11 수정: applyTenantWhereForMutation이 WHERE 조건의 tenantId 파라미터 값을 검사해
    // 현재 tenant와 다르면 즉시 CrossTenantAccessError를 던진다 (Fail-Loud).
    const tempTenant = 'honesty-delete-victim';
    await runWithoutTenant(async () => {
      await repo.save(repo.create({ tenantId: tempTenant, title: 'protected-row' }));
    });

    let before: number;
    await runWithoutTenant(async () => {
      before = await repo.count({ where: { tenantId: tempTenant } });
    });
    expect(before!).toBeGreaterThan(0);

    // TENANT_A 컨텍스트에서 tempTenant row를 DELETE 시도 → 즉시 throw
    // execute()가 동기적으로 throw하므로 Promise.resolve().then()으로 감싸야 rejects가 잡는다
    await runWithTenant(TENANT_A, async () => {
      await expect(
        Promise.resolve().then(() =>
          ds.createQueryBuilder()
            .delete()
            .from(HardeningPost)
            .where('tenantId = :t', { t: tempTenant })
            .execute(),
        ),
      ).rejects.toThrow(CrossTenantAccessError);
    });

    // row가 그대로 남아 있어야 한다
    let after: number;
    await runWithoutTenant(async () => {
      after = await repo.count({ where: { tenantId: tempTenant } });
    });
    expect(after!).toBe(before!);
  });

  it('[보호됨] QueryBuilder UPDATE에 명시적으로 다른 tenantId를 WHERE에 넣으면 CrossTenantAccessError를 던진다 (C-1.11 수정)', async () => {
    // DELETE와 동일한 경로 — UPDATE도 afterLoad가 없으므로 applyTenantWhereForMutation이 보호
    const tempTenant = 'honesty-update-victim';
    await runWithoutTenant(async () => {
      await repo.save(repo.create({ tenantId: tempTenant, title: 'original-title' }));
    });

    await runWithTenant(TENANT_A, async () => {
      await expect(
        Promise.resolve().then(() =>
          repo.createQueryBuilder()
            .update(HardeningPost)
            .set({ title: 'hacked' })
            .where('tenantId = :t', { t: tempTenant })
            .execute(),
        ),
      ).rejects.toThrow(CrossTenantAccessError);
    });

    // title이 변경되지 않아야 한다
    let row: any;
    await runWithoutTenant(async () => {
      [row] = await repo.find({ where: { tenantId: tempTenant } });
    });
    expect(row?.title).toBe('original-title');
  });

  it('[보호됨] findBy로 다른 tenant title을 검색해도 그 row는 반환되지 않는다', async () => {
    await runWithTenant(TENANT_A, async () => {
      // TENANT_B에만 있는 title
      const rows = await repo.findBy({ title: 'B-post-1' });
      expect(rows).toHaveLength(0);
    });
  });
});
