import { Cacheable } from '../../src/decorators/cacheable.decorator';
import { InMemoryTenantAwareCacheService } from '../../src/cache/cache.service';
import { runWithTenant } from '../../src/context';

/**
 * @Cacheable 데코레이터의 캐시 + tenant 분리 동작 검증.
 *
 * 시나리오:
 *  - 같은 인자 + 같은 tenant → 캐시 hit
 *  - 같은 인자 + 다른 tenant → 캐시 miss (tenant 분리)
 *  - TTL 만료 후 miss
 *  - keyGenerator 동작
 */
describe('@Cacheable', () => {
  let callCount: number;

  class StudentsService {
    public cacheService = new InMemoryTenantAwareCacheService();

    @Cacheable({ ttl: 60, tenantScoped: true })
    async getRoster() {
      callCount += 1;
      return ['student-A1', 'student-A2'];
    }
  }

  let service: StudentsService;

  beforeEach(() => {
    callCount = 0;
    service = new StudentsService();
  });

  it('같은 tenant + 같은 인자에서는 캐시 hit', async () => {
    await runWithTenant('academy-A', async () => {
      await service.getRoster();
      await service.getRoster();
    });
    expect(callCount).toBe(1);
  });

  it('다른 tenant는 캐시가 분리되어 각각 호출되어야 한다', async () => {
    await runWithTenant('academy-A', async () => {
      await service.getRoster();
    });
    await runWithTenant('academy-B', async () => {
      await service.getRoster();
    });
    expect(callCount).toBe(2);
  });

  // TODO: TTL 만료 테스트 (jest fake timers)
  // TODO: keyGenerator 커스텀 키 동작
  // TODO: tenantScoped: false 시 전 tenant 공유 동작
});
