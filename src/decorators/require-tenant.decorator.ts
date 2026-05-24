import { RequireTenantOptions } from '../interfaces/require-tenant-options.interface';
import { getCurrentTenantId } from '../context/get-current-tenant-id';
import { tenantContextStorage } from '../context/tenant-context.storage';
import { MissingTenantContextError } from '../errors/missing-tenant-context.error';
import { REQUIRE_TENANT_METADATA, SYSTEM_ACTION_METADATA } from '../constants';
import { getGlobalOptions } from '../options/options.registry';

/**
 * ─────────────────────────────────────────────────────────────
 * @RequireTenant() — 이 라이브러리의 얼굴 마담 데코레이터.
 *
 * 클래스 또는 메서드에 붙이면, 해당 메서드를 호출할 때마다
 * AsyncLocalStorage에 tenant 컨텍스트가 있는지 자동으로 확인합니다.
 * 없으면 MissingTenantContextError를 throw하여 데이터 누출을 사전 차단.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [사용 패턴 1 — 클래스 레벨]
 *
 *   @Injectable()
 *   @RequireTenant()           // 이 서비스의 모든 public 메서드 보호
 *   export class StudentsService {
 *     async findAll() { ... }   // 자동 보호
 *     async findOne(id) { ... } // 자동 보호
 *   }
 *
 * [사용 패턴 2 — 메서드 레벨]
 *
 *   @Injectable()
 *   export class MixedService {
 *     @RequireTenant()
 *     async findStudents() { ... }     // 보호
 *
 *     async getPublicStats() { ... }   // 보호 안 됨 (공개 통계 등)
 *   }
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [구현 메모]
 *  - reflect-metadata로 메타데이터를 박아두면 Subscriber가 "이 호출이
 *    보호 대상인지" 알 수 있습니다.
 *  - 메서드 디스크립터를 감싸서 실제 호출 직전 컨텍스트를 검사.
 *  - 클래스 데코레이터로 쓰면 prototype의 모든 메서드를 자동 순회.
 * ─────────────────────────────────────────────────────────────
 */
export function RequireTenant(
  options: RequireTenantOptions = {},
): MethodDecorator & ClassDecorator {
  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ): any {
    // 메서드 데코레이터로 사용된 경우.
    if (propertyKey && descriptor) {
      wrapMethod(propertyKey, descriptor, options);
      return descriptor;
    }

    // 클래스 데코레이터로 사용된 경우 — prototype의 모든 메서드를 자동 wrapping.
    const proto = target.prototype;
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;

      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (!desc || typeof desc.value !== 'function') continue;

      // @SystemAction()이 붙은 메서드는 의도적으로 보호 제외.
      if (Reflect.getMetadata(SYSTEM_ACTION_METADATA, desc.value)) continue;

      wrapMethod(key, desc, options);
      Object.defineProperty(proto, key, desc);
    }

    return target;
  };
}

/**
 * 메서드 디스크립터를 감싸 호출 전 tenant 컨텍스트를 검사하도록 변환합니다.
 *
 * 이 함수가 실질적인 보호 로직의 코어입니다.
 */
function wrapMethod(
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
  options: RequireTenantOptions,
): void {
  const originalMethod = descriptor.value;

  // 보호 대상 메타데이터 기록 — Subscriber/디버깅 도구가 참조.
  Reflect.defineMetadata(REQUIRE_TENANT_METADATA, options, originalMethod);

  // 일반 function으로 작성 — `this` 바인딩 보존.
  descriptor.value = async function (this: unknown, ...args: unknown[]) {
    const store = tenantContextStorage.getStore();
    const tenantId = getCurrentTenantId();

    // 런타임: runWithoutTenant() 진입. 데코레이터: @SystemAction()이 originalMethod에 붙음
    // (올바른 적용 순서 — @RequireTenant 위, @SystemAction 아래일 때만 유효).
    const isSystemActionRuntime = store?.isSystemAction === true;
    const isSystemActionDecorated =
      Reflect.getMetadata(SYSTEM_ACTION_METADATA, originalMethod) === true;
    const globalAllowSystemActions = getGlobalOptions()?.allowSystemActions ?? false;
    const shouldBypass =
      isSystemActionRuntime || (isSystemActionDecorated && globalAllowSystemActions);

    if (!tenantId && !options.allowSystem && !shouldBypass) {
      // strictMode=false면 경고만(현재 logger 미주입), 그 외 throw.
      if (options.strictMode !== false) {
        throw new MissingTenantContextError(
          `@RequireTenant: tenant 컨텍스트 없음 — "${String(propertyKey)}" 호출 전 확인:\n` +
            `  1) TenantContextMiddleware가 이 라우트에 적용됐는지\n` +
            `  2) 테스트라면 runWithTenant()로 감쌌는지\n` +
            `  3) 시스템 작업이라면 @SystemAction + forRoot({ allowSystemActions: true }) 조합인지`,
          'decorator',
        );
      }
    }

    return originalMethod.apply(this, args);
  };
}
