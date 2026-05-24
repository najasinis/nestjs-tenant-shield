import { SYSTEM_ACTION_METADATA } from '../constants';

/**
 * ─────────────────────────────────────────────────────────────
 * @SystemAction() — tenant 없이 실행되어야 하는 시스템 작업 표시 데코레이터.
 *
 * 일반적으로 @RequireTenant()가 클래스 레벨에 붙어 있는 서비스라도,
 * cron / 마이그레이션 / 모니터링 같은 메서드는 모든 tenant를 가로질러
 * 동작해야 합니다. 그때 이 데코레이터로 "의도적으로 보호 제외"임을
 * 명시하는 것이 안전합니다.
 *
 * 동작 전제:
 *  forRoot.allowSystemActions: true 여야 실제로 작동.
 *  (켜지 않으면 라이브러리가 보안 우회 가능성을 차단)
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [사용 예시]
 *
 *   @Injectable()
 *   @RequireTenant()
 *   export class MaintenanceService {
 *     // 일반 메서드 — tenant 컨텍스트 필요
 *     async cleanupForCurrentTenant() { ... }
 *
 *     // 시스템 메서드 — tenant 컨텍스트 없이 실행 가능
 *     @SystemAction()
 *     async runDailyCleanupForAllTenants() {
 *       const tenants = await tenantRegistry.findAll();
 *       for (const t of tenants) {
 *         await runWithTenant(t.id, async () => {
 *           await this.cleanupForCurrentTenant();
 *         });
 *       }
 *     }
 *   }
 *
 * ─────────────────────────────────────────────────────────────
 */
export function SystemAction(): MethodDecorator {
  return function (
    _target: any,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    // 표식만 남김 — 실제 우회 로직은 @RequireTenant()가 이 메타데이터를 보고 처리.
    Reflect.defineMetadata(SYSTEM_ACTION_METADATA, true, descriptor.value);
    return descriptor;
  };
}
