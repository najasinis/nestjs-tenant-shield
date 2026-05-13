import { DataSource, Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { TenantSubscriber } from '../../src/typeorm/tenant.subscriber';
import { runWithTenant, runWithoutTenant } from '../../src/context/run-with-tenant';
import { CrossTenantAccessError } from '../../src/errors/cross-tenant-access.error';
import { TenantShieldOptions } from '../../src/interfaces/tenant-shield-options.interface';

/**
 * ─────────────────────────────────────────────────────────────
 * TypeORM 통합 e2e 테스트 — v0.1 동작 검증.
 *
 * 실제 SQLite 인-메모리 DB를 띄워서,
 *  1) QueryBuilder 자동 WHERE 주입
 *  2) INSERT 시 tenant_id 자동 주입
 *  3) cross-tenant INSERT 차단
 *  4) 시스템 작업(runWithoutTenant)에서는 전체 조회 허용
 * 를 확인합니다.
 * ─────────────────────────────────────────────────────────────
 */

@Entity()
class Student {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  tenantId!: string;

  @Column()
  name!: string;
}

describe('TypeORM TenantSubscriber e2e (v0.1)', () => {
  let dataSource: DataSource;

  const options: TenantShieldOptions = {
    strategy: 'discriminator',
    tenantIdField: 'tenantId',
    tenantSource: 'header',
    strictMode: true,
  };

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Student],
      synchronize: true,
      subscribers: [],
    });
    await dataSource.initialize();

    dataSource.subscribers.push(new TenantSubscriber(options) as any);

    const repo = dataSource.getRepository(Student);
    await runWithoutTenant(async () => {
      await repo.save([
        repo.create({ tenantId: 'academy-A', name: 'A-1' }),
        repo.create({ tenantId: 'academy-A', name: 'A-2' }),
        repo.create({ tenantId: 'academy-B', name: 'B-1' }),
        repo.create({ tenantId: 'academy-B', name: 'B-2' }),
      ]);
    });
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('runWithTenant("academy-A") 안에서 find()는 A의 row만 반환한다', async () => {
    const repo = dataSource.getRepository(Student);
    await runWithTenant('academy-A', async () => {
      const rows = await repo.find();
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.tenantId === 'academy-A')).toBe(true);
    });
  });

  it('create() 시 entity의 tenant_id가 자동으로 현재 컨텍스트 값으로 채워진다', async () => {
    const repo = dataSource.getRepository(Student);
    await runWithTenant('academy-A', async () => {
      const created = repo.create({ name: 'A-3' });
      const saved = await repo.save(created);
      expect(saved.tenantId).toBe('academy-A');
    });
  });

  it('cross-tenant insert는 CrossTenantAccessError를 throw한다', async () => {
    const repo = dataSource.getRepository(Student);
    await runWithTenant('academy-A', async () => {
      await expect(
        Promise.resolve().then(() =>
          repo.save(repo.create({ tenantId: 'academy-B', name: 'B-3' })),
        ),
      ).rejects.toThrow(CrossTenantAccessError);
    });
  });

  it('runWithoutTenant() 안에서는 모든 tenant 데이터를 자유롭게 읽을 수 있다', async () => {
    const repo = dataSource.getRepository(Student);
    await runWithoutTenant(async () => {
      const rows = await repo.find();
      expect(rows.length).toBeGreaterThanOrEqual(4);
    });
  });
});
