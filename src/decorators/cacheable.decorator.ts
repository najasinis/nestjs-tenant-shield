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
      // 캐시 서비스 lookup: this.cacheService(명시적 주입) → globalCache(모듈 bootstrap 등록).
      const cacheService: TenantAwareCacheService | undefined =
        this.cacheService ?? getGlobalCache();

      if (!cacheService) {
        // 캐시 인스턴스 없으면 원본 호출로 fallback. dev에서 1회만 경고.
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

      const key = buildCacheKey({
        className,
        methodName: String(propertyKey),
        args,
        options,
      });

      const cached = await cacheService.get(key);
      if (cached !== undefined) return cached;

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

  const tenantPrefix = options.tenantScoped ? `${getCurrentTenantId() ?? 'no-tenant'}:` : '';
  const argsKey = options.keyGenerator ? options.keyGenerator(args) : safeStringify(args);

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
