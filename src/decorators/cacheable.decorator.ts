import { CacheableOptions } from '../interfaces/cacheable-options.interface';
import { getCurrentTenantId } from '../context/get-current-tenant-id';
import { TenantAwareCacheService } from '../cache/cache.service';
import { getGlobalCache } from '../cache/cache.registry';

/**
 * ─────────────────────────────────────────────────────────────
 * @Cacheable() — 메서드 결과를 캐시 + tenant 단위 자동 분리.
 *
 * 일반 캐시 데코레이터의 가장 큰 함정은 "캐시 키가 tenant 간 공유돼서
 * A학원이 요청한 결과를 B학원이 받는" 사고입니다.
 * 이 데코레이터는 tenantScoped: true 시 키에 tenant ID prefix를
 * 자동으로 붙여 그 위험을 차단합니다.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [예시]
 *
 *   @Cacheable({ ttl: 300, tenantScoped: true })
 *   async getStudentRoster() {
 *     return this.repo.find();
 *   }
 *
 *   // 캐시 키 예: "academy-A:StudentsService.getStudentRoster:[]"
 *   //            "academy-B:StudentsService.getStudentRoster:[]"
 *   // → 서로 절대 섞이지 않음.
 *
 * ─────────────────────────────────────────────────────────────
 */
export function Cacheable(options: CacheableOptions): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const className = target.constructor?.name ?? 'UnknownClass';

    // dev 환경에서 fallback 사용 시 1회만 안내 — 디버깅 부담 완화.
    let fallbackWarned = false;

    descriptor.value = async function (this: any, ...args: unknown[]) {
      // 1) 캐시 서비스 인스턴스 lookup — 두 경로 시도:
      //    (a) 사용자 클래스에 명시적으로 주입된 this.cacheService (우선)
      //    (b) TenantShieldModule이 bootstrap 시 등록한 글로벌 registry (fallback)
      //
      //    (b)가 동작하려면 AppModule이 TenantShieldModule.forRoot()를
      //    import 했고, 앱이 onApplicationBootstrap 라이프사이클을 지난 상태여야 함.
      const explicit: TenantAwareCacheService | undefined = this.cacheService;
      const cacheService: TenantAwareCacheService | undefined =
        explicit ?? getGlobalCache();

      if (!cacheService) {
        // 둘 다 없으면 캐시를 그냥 우회 — 기능적으로는 안전(원본 결과 반환).
        // 다만 사용자가 @Cacheable을 명시했다는 건 캐시를 원했다는 뜻이므로
        // 개발 환경에서 한 번만 경고 로그를 남겨 디버깅을 도와줍니다.
        if (!fallbackWarned && process.env.NODE_ENV !== 'production') {
          fallbackWarned = true;
          // eslint-disable-next-line no-console
          console.warn(
            `[nestjs-tenant-shield] @Cacheable이 적용된 ${className}.${String(propertyKey)}가 ` +
              `캐시 인스턴스를 찾지 못해 원본 호출로 fallback 합니다. ` +
              `TenantShieldModule.forRoot() import 여부 또는 cacheService 주입을 확인하세요.`,
          );
        }
        return originalMethod.apply(this, args);
      }

      // 2) 캐시 키 생성.
      const key = buildCacheKey({
        className,
        methodName: String(propertyKey),
        args,
        options,
      });

      // 3) 캐시 hit → 즉시 반환
      const cached = await cacheService.get(key);
      if (cached !== undefined) return cached;

      // 4) Miss → 원본 실행 → 결과 저장 → 반환
      const result = await originalMethod.apply(this, args);
      await cacheService.set(key, result, options.ttl);
      return result;
    };

    return descriptor;
  };
}

/**
 * 캐시 키를 만드는 헬퍼.
 *
 * 기본 키 포맷:
 *   `[${tenantId}:]${ClassName}.${methodName}:${JSON.stringify(args)}`
 *
 * keyGenerator가 옵션에 있으면 args 부분은 그것을 그대로 사용.
 */
function buildCacheKey(input: {
  className: string;
  methodName: string;
  args: unknown[];
  options: CacheableOptions;
}): string {
  const { className, methodName, args, options } = input;

  // 1) tenant prefix
  const tenantPrefix = options.tenantScoped ? `${getCurrentTenantId() ?? 'no-tenant'}:` : '';

  // 2) args 직렬화
  //    커스텀 keyGenerator가 있으면 우선 사용 — 사용자가 키 충돌/길이 제어 가능.
  const argsKey = options.keyGenerator
    ? options.keyGenerator(args)
    : safeStringify(args);

  return `${tenantPrefix}${className}.${methodName}:${argsKey}`;
}

/**
 * 인자가 순환 참조이거나 Date 등 직렬화가 까다로운 경우에도 죽지 않게.
 * 일단 try/catch로 감싸고, 실패 시 인자 타입 정보만 활용.
 */
function safeStringify(args: unknown[]): string {
  try {
    return JSON.stringify(args);
  } catch {
    return `[unserializable:${args.length}args]`;
  }
}
