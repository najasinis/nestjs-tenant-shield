import { DataSource, Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { TenantSubscriber } from '../../src/typeorm/tenant.subscriber';
import { runWithoutTenant } from '../../src/context/run-with-tenant';
import { TenantShieldOptions } from '../../src/interfaces/tenant-shield-options.interface';
import { faker } from '@faker-js/faker';

// 모든 하네스 spec에서 공유하는 entity
@Entity()
export class HardeningPost {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  tenantId!: string;

  @Column()
  title!: string;
}

export const DEFAULT_OPTIONS: TenantShieldOptions = {
  strategy: 'discriminator',
  tenantIdField: 'tenantId',
  tenantSource: 'header',
  strictMode: true,
};

export async function createTestDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [HardeningPost],
    synchronize: true,
    subscribers: [],
  });
  await ds.initialize();
  ds.subscribers.push(new TenantSubscriber(DEFAULT_OPTIONS) as any);
  return ds;
}

// N개 tenant에 각 rowsPerTenant 개 row 삽입. runWithoutTenant 안에서 실행.
export async function seedTenants(
  ds: DataSource,
  tenantIds: string[],
  rowsPerTenant: number,
): Promise<void> {
  const repo = ds.getRepository(HardeningPost);
  await runWithoutTenant(async () => {
    const batch: HardeningPost[] = [];
    for (const tenantId of tenantIds) {
      for (let i = 0; i < rowsPerTenant; i++) {
        batch.push(repo.create({ tenantId, title: faker.lorem.words(3) }));
      }
    }
    await repo.save(batch);
  });
}

export function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
