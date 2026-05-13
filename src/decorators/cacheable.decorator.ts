import { CacheableOptions } from '../interfaces/cacheable-options.interface';
import { getCurrentTenantId } from '../context/get-current-tenant-id';
import { TenantAwareCacheService } from '../cache/cache.service';

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

    descriptor.value = async function (this: any, ...args: unknown[]) {
      // 1) 캐시 서비스 인스턴스를 인스턴스의 속성에서 가져옴.
      //    NestJS DI로 주입된 cacheService를 가정 — 사용자 클래스에 의존성으로 추가 필요.
      //
      //    TODO(v0.1): 모듈에서 캐시 서비스를 글로벌하게 export 하고,
      //                여기서 모듈 컨테이너 참조로 가져오는 방식으로 개선.
      const cacheService: TenantAwareCacheService | undefined = this.cacheService;
      if (!cacheService) {
        // 캐시 서비스가 주입되지 않은 경우엔 캐시 우회 — 그냥 원본 호출.
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
