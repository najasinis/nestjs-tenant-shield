import 'reflect-metadata';
import { DataSource, Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { TenantSubscriber } from '../../src/typeorm/tenant.subscriber';
import { runWithTenant, runWithoutTenant } from '../../src/context/run-with-tenant';
import { CrossTenantAccessError } from '../../src/errors/cross-tenant-access.error';
import { MissingTenantContextError } from '../../src/errors/missing-tenant-context.error';
import { TenantShieldOptions } from '../../src/interfaces/tenant-shield-options.interface';

/**
 * ─────────────────────────────────────────────────────────────
 * TypeORM TenantSubscriber e2e — 실제 PostgreSQL (Docker)
 *
 * SQLite e2e(typeorm-integration.spec.ts)와 동일한 격리 시나리오를
 * 실제 PostgreSQL 엔진으로 검증한다.
 *
 * Docker 없는 환경(CI without Docker, 로컬 미설치)에서는 자동 skip.
 * ─────────────────────────────────────────────────────────────
 */

jest.setTimeout(120_000);

function isDockerAvailable(): boolean {
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    execSync('docker info', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const describeIfDocker = isDockerAvailable() ? describe : describe.skip;

@Entity()
class Student {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  tenantId!: string;

  @Column()
  name!: string;
}

const options: TenantShieldOptions = {
  strategy: 'discriminator',
  tenantIdField: 'tenantId',
  tenantSource: 'header',
  strictMode: true,
};

describeIfDocker('TypeORM TenantSubscriber e2e (PostgreSQL)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [Student],
      synchronize: true,
      logging: false,
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
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  it('runWithTenant("academy-A") 안에서 find()는 A의 row만 반환한다', async () => {
    const repo = dataSource.getRepository(Student);
    await runWithTenant('academy-A', async () => {
      const rows = await repo.find();
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.tenantId === 'academy-A')).toBe(true);
    });
  });

  it('cross-tenant insert는 CrossTenantAccessError를 throw한다', async () => {
    const repo = dataSource.getRepository(Student);
    await runWithTenant('academy-A', async () => {
      await expect(
        repo.save(repo.create({ tenantId: 'academy-B', name: 'B-injected' })),
      ).rejects.toThrow(CrossTenantAccessError);
    });
  });

  it('다른 tenant의 PK로 findOneBy 조회 시 null 반환 (보안 격리)', async () => {
    const repo = dataSource.getRepository(Student);
    const bRow = await runWithoutTenant(() =>
      repo.findOne({ where: { tenantId: 'academy-B' } }),
    );
    expect(bRow).toBeTruthy();

    await runWithTenant('academy-A', async () => {
      const found = await repo.findOneBy({ id: bRow!.id });
      expect(found).toBeNull();
    });
  });

  it('strict 모드 + tenant 컨텍스트 없이 repo.find() → MissingTenantContextError', async () => {
    const repo = dataSource.getRepository(Student);
    await expect(repo.find()).rejects.toBeInstanceOf(MissingTenantContextError);
  });

  it('runWithoutTenant() 안에서는 모든 tenant 데이터를 자유롭게 읽을 수 있다', async () => {
    const repo = dataSource.getRepository(Student);
    await runWithoutTenant(async () => {
      const rows = await repo.find();
      expect(rows.length).toBeGreaterThanOrEqual(4);
    });
  });
});
