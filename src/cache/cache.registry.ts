import { TenantAwareCacheService } from './cache.service';

/**
 * ─────────────────────────────────────────────────────────────
 * 글로벌 캐시 registry — @Cacheable 데코레이터의 DI 우회로.
 *
 * 배경:
 *   @Cacheable은 메서드 디스크립터를 직접 wrap 하기 때문에 NestJS DI
 *   컨테이너에 접근할 수 없습니다. 그렇다고 사용자에게 매번 클래스에
 *   `cacheService` 프로퍼티를 inject 하라고 강제하면 불편합니다.
 *
 *   해결: 모듈이 onApplicationBootstrap 시점에 캐시 인스턴스를 이 작은
 *   글로벌 registry에 등록 → 데코레이터는 registry에서 가져옴.
 *
 *   사용자가 클래스 인스턴스에 `cacheService`를 명시적으로 두면 그게
 *   우선 사용되고, 없으면 글로벌 fallback으로 동작합니다.
 *
 * ⚠️ 이 패턴의 한계:
 *   - 한 프로세스에 하나의 캐시만 가능 (대부분 SaaS에서는 OK)
 *   - 테스트 격리를 위해 reset이 필요 → resetGlobalCache 제공
 *
 * ─────────────────────────────────────────────────────────────
 */

let globalCache: TenantAwareCacheService | undefined;

/**
 * 모듈 bootstrap 단계에서 1회 호출.
 * 라이브러리 외부에서 직접 호출할 일은 없습니다.
 */
export function setGlobalCache(cache: TenantAwareCacheService): void {
  globalCache = cache;
}

/**
 * @Cacheable 데코레이터가 fallback으로 사용하는 lookup 함수.
 *
 * 반환값:
 *   - TenantAwareCacheService 인스턴스 (모듈 bootstrap 후 정상 상태)
 *   - undefined (모듈이 아직 init되지 않았거나, 라이브러리 미사용 환경)
 */
export function getGlobalCache(): TenantAwareCacheService | undefined {
  return globalCache;
}

/**
 * 테스트 격리용. 각 테스트 케이스 후 호출해서 다음 테스트에 영향을 안 미치게.
 */
export function resetGlobalCache(): void {
  globalCache = undefined;
}
