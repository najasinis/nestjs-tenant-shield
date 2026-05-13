import { Test } from '@nestjs/testing';
import { TenantShieldModule } from '../src/tenant-shield.module';
import { TENANT_SHIELD_OPTIONS } from '../src/constants';

/**
 * 모듈 부팅 시나리오 검증.
 *
 *  - forRoot가 옵션을 DI에 제대로 등록하는지
 *  - 잘못된 설정이면 부팅 단계에서 throw하는지
 */
describe('TenantShieldModule', () => {
  it('forRoot로 동기 옵션을 등록할 수 있어야 한다', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TenantShieldModule.forRoot({
          strategy: 'discriminator',
          tenantIdField: 'tenantId',
          tenantSource: 'header',
          headerName: 'x-tenant-id',
        }),
      ],
    }).compile();

    const options = moduleRef.get(TENANT_SHIELD_OPTIONS);
    expect(options).toMatchObject({
      strategy: 'discriminator',
      tenantIdField: 'tenantId',
    });
  });

  // TODO: forRootAsync 옵션 등록 검증
  // TODO: tenantSource 'custom'인데 customResolver 누락 시 InvalidTenantSourceError 검증
});
