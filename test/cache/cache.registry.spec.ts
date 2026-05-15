import 'reflect-metadata';
import {
  InMemoryTenantAwareCacheService,
  getGlobalCache,
  resetGlobalCache,
  setGlobalCache,
} from '../../src/cache';

/**
 * ─────────────────────────────────────────────────────────────
 * cache.registry — 글로벌 캐시 인스턴스 등록/조회 동작.
 *
 * @Cacheable 데코레이터가 DI 컨테이너 없이도 캐시를 찾을 수 있도록 하는
 * "작은 글로벌 변수" 메커니즘이 정확히 동작하는지 검증.
 *
 * 각 테스트 후 resetGlobalCache로 격리 — 다음 테스트가 이전 상태에 오염되지 않도록.
 * ─────────────────────────────────────────────────────────────
 */
describe('cache.registry', () => {
  afterEach(() => {
    resetGlobalCache();
  });

  it('초기 상태에서 getGlobalCache는 undefined', () => {
    expect(getGlobalCache()).toBeUndefined();
  });

  it('setGlobalCache로 등록한 인스턴스를 getGlobalCache가 그대로 반환', () => {
    const cache = new InMemoryTenantAwareCacheService();
    setGlobalCache(cache);
    expect(getGlobalCache()).toBe(cache);
  });

  it('resetGlobalCache 호출 후 다시 undefined가 된다', () => {
    setGlobalCache(new InMemoryTenantAwareCacheService());
    resetGlobalCache();
    expect(getGlobalCache()).toBeUndefined();
  });
});
