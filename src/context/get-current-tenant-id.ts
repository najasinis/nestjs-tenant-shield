import { tenantContextStorage } from './tenant-context.storage';

/**
 * 현재 요청의 tenant ID를 조회합니다.
 *
 * 비즈니스 로직 안에서 "지금 누구의 데이터를 다루고 있는지" 알고 싶을 때 사용.
 *
 * 반환값:
 *  - string : 컨텍스트가 정상 설정된 경우 tenant ID
 *  - null   : 컨텍스트가 없거나 시스템 작업인 경우
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [사용 예시]
 *
 *   @Injectable()
 *   export class AuditService {
 *     async log(action: string) {
 *       const tenantId = getCurrentTenantId();
 *       await this.repo.save({ action, tenantId, occurredAt: new Date() });
 *     }
 *   }
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [주의]
 *  이 함수는 절대 throw하지 않습니다. tenant가 없으면 그냥 null을 반환합니다.
 *  "없으면 거부"하는 보호 로직은 @RequireTenant() 데코레이터의 역할입니다.
 *  → 일반 비즈니스 코드에서 throw 책임이 분산되면 추적이 어려워지기 때문.
 */
export function getCurrentTenantId(): string | null {
  return tenantContextStorage.getStore()?.tenantId ?? null;
}
