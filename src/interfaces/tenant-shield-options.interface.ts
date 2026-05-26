/**
 * ─────────────────────────────────────────────────────────────
 * TenantShieldModule.forRoot()에 넘기는 전역 설정 인터페이스.
 *
 * 라이브러리 사용자가 앱 시작 시 단 한 번 호출하며, 이 옵션이
 * 모든 데코레이터/미들웨어/Subscriber의 동작을 결정합니다.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * tenant ID를 요청에서 추출하는 방식.
 * 보통 SaaS의 인증 방식과 매칭됩니다.
 *
 * - 'header'    : 모바일/내부 API에서 흔함. 예) X-Tenant-Id: academy-A
 * - 'jwt'       : 표준적인 토큰 기반 인증.
 * - 'subdomain' : academy-a.yourapp.com 같은 멀티 도메인 SaaS.
 * - 'custom'    : 위 셋에 안 맞는 특수한 경우. 사용자가 함수를 직접 제공.
 */
export type TenantSource = 'header' | 'jwt' | 'subdomain' | 'custom';

/**
 * 멀티테넌시 격리 전략.
 *
 * v0.1에서는 'discriminator'만 구현됩니다.
 * 나머지는 v0.2+에서 추가됩니다 (PRD §7 범위 제외 참조).
 */
export type TenantStrategy = 'discriminator' | 'schema' | 'database';

/**
 * Security violation audit event. Passed to `onSecurityViolation` callback just before throwing.
 * Use it for Sentry/Slack alerts or audit logs.
 *
 * 보안 위반 감사 이벤트. throw 직전에 `onSecurityViolation` 콜백으로 전달됩니다.
 */
export interface SecurityViolationEvent {
  /** Violation type. / 위반 유형. */
  type: 'cross-tenant' | 'missing-context';
  /** Current request tenant ID, or null if missing. / 현재 요청의 tenant ID (없으면 null). */
  currentTenantId: string | null;
  /** The tenant ID of the attempted data (cross-tenant only). / 접근 시도된 데이터의 tenant ID. */
  attemptedTenantId?: string;
  /** Entity or Prisma model name, if available. / entity 또는 모델 이름. */
  entityName?: string;
  /** The operation where the violation was detected. / 위반이 감지된 작업. */
  operation: string;
}

/**
 * forRoot()에 전달하는 옵션.
 */
export interface TenantShieldOptions {
  /**
   * 멀티테넌시 패턴.
   *  - 'discriminator': 같은 테이블에 tenant_id 컬럼으로 구분 (v0.1)
   *  - 'schema'       : Postgres schema 분리 (v0.2)
   *  - 'database'     : DB-per-tenant (v0.2)
   */
  strategy: TenantStrategy;

  /**
   * Entity에서 tenant를 식별하는 컬럼/필드 이름.
   * 회사마다 컨벤션이 다르므로 사용자가 지정합니다.
   * 예: 'tenantId' (일반), 'spaceId' (슈퍼러닝), 'orgId' (Slack 스타일)
   */
  tenantIdField: string;

  /**
   * 요청에서 tenant ID를 어떻게 추출할지 지정.
   * 아래 source 관련 옵션과 함께 사용.
   */
  tenantSource: TenantSource;

  /**
   * tenantSource가 'header'일 때 사용할 헤더 이름.
   * 기본값: 'x-tenant-id'
   */
  headerName?: string;

  /**
   * tenantSource가 'jwt'일 때 사용할 JWT claim 이름.
   * 기본값: 'tenant_id'
   *
   * 주의: JWT 디코딩 자체는 사용자의 인증 미들웨어 책임.
   * 이 라이브러리는 request.user 또는 request.jwt에서 값만 꺼냅니다.
   */
  jwtClaim?: string;

  /**
   * tenantSource가 'subdomain'일 때 사용할 도메인 패턴.
   * 예: '*.yourapp.com' → 'academy-a.yourapp.com'에서 'academy-a' 추출.
   */
  subdomainPattern?: string;

  /**
   * tenantSource가 'custom'일 때 사용자가 제공하는 추출 함수.
   * null을 반환하면 tenant 컨텍스트가 설정되지 않은 것으로 간주.
   *
   * 예시:
   *   customResolver: (req) => req.user?.organizationId ?? null
   */
  customResolver?: (request: unknown) => string | null;

  /**
   * Strict mode 활성화 여부 (기본 true, 강력 권장).
   *
   * true  : tenant 컨텍스트 없거나 cross-tenant 감지 시 즉시 throw.
   * false : 경고 로그만 남기고 진행. 마이그레이션 중에만 임시 사용.
   *
   * 프로덕션에서는 절대 false로 두지 마세요. 데이터 누출 사고의 첫 단추.
   */
  strictMode?: boolean;

  /**
   * 시스템 작업(@SystemAction) 허용 여부 (기본 false).
   *
   * true로 켜면 cron, 마이그레이션, 모니터링 같은 작업이
   * tenant 컨텍스트 없이 실행될 수 있습니다.
   *
   * 켜더라도 메서드에 @SystemAction()을 명시적으로 붙여야 합니다.
   */
  allowSystemActions?: boolean;

  /**
   * Security violation audit callback. Called just BEFORE throwing CrossTenantAccessError
   * or MissingTenantContextError. Errors thrown by this callback are silently swallowed to
   * ensure the original security error always propagates.
   *
   * 보안 위반 감사 콜백. CrossTenantAccessError / MissingTenantContextError throw 직전에 호출됩니다.
   * 콜백에서 throw가 발생해도 원래 보안 에러가 항상 전파되도록 조용히 무시됩니다.
   *
   * Example / 예시:
   *   onSecurityViolation: (event) => {
   *     if (event.type === 'cross-tenant') {
   *       alertingService.critical('Cross-tenant access detected', event);
   *     }
   *   }
   */
  onSecurityViolation?: (event: SecurityViolationEvent) => void;

  /**
   * tenant 보호를 적용할 entity 클래스 목록.
   *
   * 미지정 시 라이브러리가 자동으로 tenantIdField를 가진 모든 entity를 감시.
   * 명시하면 화이트리스트로 동작 (성능 + 안전성 둘 다 향상).
   */
  entities?: Function[];

  /**
   * 캐시 백엔드 교체 슬롯.
   *
   * 미지정 시 InMemoryTenantAwareCacheService(단일 프로세스용)가 사용됩니다.
   * 프로덕션에서는 Redis 등 외부 캐시 어댑터로 교체 권장.
   *
   * 세 가지 형태로 제공 가능 (NestJS provider와 동일한 패턴):
   *  - `useClass`   : 클래스 자체. NestJS DI가 인스턴스 생성.
   *  - `useValue`   : 이미 만들어진 인스턴스. 외부에서 만든 싱글톤.
   *  - `useFactory` : 비동기 셋업이 필요한 경우 (예: Redis client 초기화).
   *
   * 예시 (Redis 어댑터, 자세한 구현은 examples/redis-cache/ 참고):
   *
   *   cache: {
   *     useFactory: (config: ConfigService) => new RedisCacheAdapter(config.get('REDIS_URL')),
   *     inject: [ConfigService],
   *   }
   */
  cache?: TenantShieldCacheProvider;
}

/**
 * cache 슬롯에 들어갈 수 있는 세 가지 형태.
 *
 * 셋 중 정확히 하나만 채우는 것을 권장 (둘 이상 있으면 useFactory > useValue > useClass 순으로 우선).
 */
export interface TenantShieldCacheProvider {
  useClass?: new (...args: any[]) => unknown;
  useValue?: unknown;
  useFactory?: (...args: any[]) => unknown | Promise<unknown>;
  /** useFactory의 파라미터로 주입될 토큰들. */
  inject?: any[];
}

/**
 * forRootAsync()용 옵션. (v0.1.x 패치에서 추가 예정)
 *
 * ConfigService 같은 비동기 의존성을 통해 옵션을 만들고 싶을 때 사용.
 */
export interface TenantShieldAsyncOptions {
  imports?: any[];
  useFactory: (...args: any[]) => Promise<TenantShieldOptions> | TenantShieldOptions;
  inject?: any[];
}
