import { RequireTenantOptions } from '../interfaces/require-tenant-options.interface';
import { getCurrentTenantId } from '../context/get-current-tenant-id';
import { tenantContextStorage } from '../context/tenant-context.storage';
import { MissingTenantContextError } from '../errors/missing-tenant-context.error';
import { REQUIRE_TENANT_METADATA, SYSTEM_ACTION_METADATA } from '../constants';

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
    // ─────────────────────────────────────────────
    // CASE 1: 메서드 데코레이터로 사용된 경우
    // propertyKey와 descriptor가 모두 존재함.
    // ─────────────────────────────────────────────
    if (propertyKey && descriptor) {
      wrapMethod(target, propertyKey, descriptor, options);
      return descriptor;
    }

    // ─────────────────────────────────────────────
    // CASE 2: 클래스 데코레이터로 사용된 경우
    // propertyKey가 undefined이고, target이 클래스 생성자.
    // 클래스의 prototype에 있는 모든 메서드를 자동으로 감쌉니다.
    // ─────────────────────────────────────────────
    const proto = target.prototype;
    for (const key of Object.getOwnPropertyNames(proto)) {
      // constructor는 건너뛰기.
      if (key === 'constructor') continue;

      const desc = Object.getOwnPropertyDescriptor(proto, key);

      // 함수가 아닌 속성(getter 등)은 건너뜀.
      if (!desc || typeof desc.value !== 'function') continue;

      // @SystemAction()이 붙은 메서드는 의도적으로 보호 제외.
      const isSystemAction = Reflect.getMetadata(SYSTEM_ACTION_METADATA, desc.value);
      if (isSystemAction) continue;

      wrapMethod(proto, key, desc, options);

      // 변경된 descriptor 적용.
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
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
  options: RequireTenantOptions,
): void {
  // 원본 메서드 백업.
  const originalMethod = descriptor.value;

  // 이 메서드가 @RequireTenant로 보호된다는 메타데이터 기록.
  // Subscriber나 디버깅 도구가 참조할 수 있습니다.
  Reflect.defineMetadata(REQUIRE_TENANT_METADATA, options, originalMethod);

  // 메서드를 감싸기 — 화살표 함수가 아니라 일반 함수로 작성하여
  // `this`가 호출 시점의 인스턴스로 정상 바인딩되도록 합니다.
  descriptor.value = async function (this: unknown, ...args: unknown[]) {
    const store = tenantContextStorage.getStore();
    const tenantId = getCurrentTenantId();
    const isSystemAction = store?.isSystemAction === true;

    // 시스템 작업으로 명시되면 통과 허용 (allowSystem 옵션 또는 runWithoutTenant 진입).
    if (!tenantId && !options.allowSystem && !isSystemAction) {
      // strictMode가 명시적으로 false면 경고만 남기고 통과,
      // 그 외에는 (기본 true) 즉시 throw.
      const strict = options.strictMode !== false;
      if (strict) {
        throw new MissingTenantContextError(
          `@RequireTenant: tenant 컨텍스트가 없습니다. ${String(propertyKey)} 호출 전 미들웨어/테스트 헬퍼를 점검하세요.`,
          'decorator',
        );
      } else {
        // TODO: forRoot에서 받은 logger 인스턴스로 경고 출력.
        // (의도적으로 console 직접 호출은 피함 — 로거 인스턴스 주입 예정)
      }
    }

    // 원본 메서드 실행 결과 반환.
    return originalMethod.apply(this, args);
  };
}
