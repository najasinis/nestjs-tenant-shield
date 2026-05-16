/**
 * ─────────────────────────────────────────────────────────────
 * 라이브러리 전역에서 공유하는 상수 모음.
 *
 * 두 종류가 들어 있습니다:
 *
 *  1) DI 토큰         — NestJS 의존성 주입 시 옵션 객체를 식별하는 키.
 *  2) 메타데이터 키   — reflect-metadata로 메서드/클래스에 표식을 남길 때
 *                       사용하는 문자열 키. 다른 곳에서 같은 키를 쓰면 충돌이
 *                       나므로 라이브러리 prefix를 붙여 고유성을 확보합니다.
 *
 * 모든 키는 'nestjs-tenant-shield:' prefix를 사용 — 외부와 충돌 방지.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * forRoot()에서 받은 옵션 객체(TenantShieldOptions)를 DI 컨테이너에
 * 등록할 때 사용하는 토큰.
 *
 * 미들웨어/Subscriber 등이 `@Inject(TENANT_SHIELD_OPTIONS)`로
 * 같은 인스턴스를 받아 옵니다.
 */
export const TENANT_SHIELD_OPTIONS = Symbol('nestjs-tenant-shield:options');

/**
 * 캐시 서비스(TenantAwareCacheService 구현체)를 DI에 등록할 때 쓰는 토큰.
 *
 * 기본값은 InMemoryTenantAwareCacheService(모듈에서 자동 등록).
 * 사용자가 Redis 등으로 교체하려면:
 *
 *   @Module({
 *     providers: [
 *       { provide: TENANT_SHIELD_CACHE, useClass: RedisCacheAdapter },
 *     ],
 *   })
 */
export const TENANT_SHIELD_CACHE = Symbol('nestjs-tenant-shield:cache');

/**
 * @RequireTenant()가 메서드에 남기는 메타데이터 키.
 * Subscriber 또는 디버깅 도구가 "이 메서드가 보호 대상인지" 확인할 때 사용.
 *
 * 값은 RequireTenantOptions 객체.
 */
export const REQUIRE_TENANT_METADATA = 'nestjs-tenant-shield:require-tenant';

/**
 * @SystemAction()이 메서드에 남기는 메타데이터 키.
 * @RequireTenant()의 클래스 레벨 적용 시 이 표식이 있는 메서드는
 * 자동 wrapping에서 건너뜁니다.
 *
 * 값은 boolean (true).
 */
export const SYSTEM_ACTION_METADATA = 'nestjs-tenant-shield:system-action';

/**
 * @Cacheable()이 메서드에 남기는 메타데이터 키.
 * (현재는 데코레이터가 디스크립터를 직접 감싸므로 동작에는 필수 아님.
 *  향후 introspection / 디버깅 / 캐시 무효화 도구에서 사용 예정.)
 */
export const CACHEABLE_METADATA = 'nestjs-tenant-shield:cacheable';

/**
 * 캐시 키의 tenant prefix 구분자.
 * 'academy-A' + ':' + 'StudentsService.findAll' 처럼 조합.
 *
 * 변경 시 캐시 호환성이 깨지므로 메이저 버전 업데이트에서만 변경.
 */
export const CACHE_KEY_DELIMITER = ':';
