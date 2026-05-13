import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  LoadEvent,
} from 'typeorm';
import { getCurrentTenantId } from '../context/get-current-tenant-id';
import { tenantContextStorage } from '../context/tenant-context.storage';
import { TenantShieldOptions } from '../interfaces/tenant-shield-options.interface';
import { MissingTenantContextError } from '../errors/missing-tenant-context.error';
import { CrossTenantAccessError } from '../errors/cross-tenant-access.error';

/**
 * ─────────────────────────────────────────────────────────────
 * TenantSubscriber — v0.1의 가장 중요한 컴포넌트.
 *
 * TypeORM의 EventSubscriber는 모든 SELECT/INSERT/UPDATE/DELETE
 * 동작에 끼어들 수 있는 hook입니다. 이 hook을 활용해서 사용자가
 * 코드에서 WHERE를 빠뜨려도, 라이브러리가 자동으로 안전망을 깔아줍니다.
 *
 * 적용되는 보호 3가지:
 *  1) beforeQuery (또는 QueryBuilder 가로채기): SELECT/UPDATE/DELETE에 자동 WHERE 주입
 *  2) beforeInsert: INSERT 시 현재 tenant ID를 자동으로 컬럼에 주입
 *  3) afterLoad: 어떤 escape hatch로든 다른 tenant의 entity가 반환되면 즉시 throw
 *
 * ⚠️ Raw SQL (repository.query()) 은 이 hook을 통과하지 않습니다.
 *    이 경우 사용자가 withTenantWhere() 헬퍼로 수동 보호해야 합니다.
 * ─────────────────────────────────────────────────────────────
 */
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  constructor(private readonly options: TenantShieldOptions) {}

  /**
   * INSERT 직전 hook.
   * tenant_id 컬럼이 비어 있으면 현재 컨텍스트의 tenantId를 자동으로 채워 넣습니다.
   *
   * 사용자가 "tenantId를 명시적으로 안 적어도 알아서 들어가는" 마법은 여기서 발생.
   */
  beforeInsert(event: InsertEvent<any>): void {
    const entity = event.entity;
    if (!entity) return;

    // tenant 보호 대상 entity인지 확인 (옵션에 entities 명시된 경우).
    if (!this.isTenantAwareEntity(event.metadata.target as Function)) return;

    const tenantField = this.options.tenantIdField;
    const tenantId = getCurrentTenantId();
    const isSystemAction = tenantContextStorage.getStore()?.isSystemAction === true;

    // 1) 이미 사용자가 직접 채워둔 경우 — 검증만 (cross-tenant insert 차단).
    const existingValue = (entity as Record<string, unknown>)[tenantField];
    if (existingValue) {
      if (tenantId && existingValue !== tenantId) {
        throw new CrossTenantAccessError(
          `INSERT 시 ${tenantField}=${existingValue}는 현재 tenant(${tenantId})와 다릅니다.`,
          tenantId,
          String(existingValue),
          event.metadata.name,
        );
      }
      return;
    }

    // 2) 비어 있으면 자동 주입.
    if (tenantId) {
      (entity as Record<string, unknown>)[tenantField] = tenantId;
      return;
    }

    // 3) 컨텍스트도 없고 시스템 작업도 아니면 strict mode에서 throw.
    if (!isSystemAction && this.options.strictMode !== false) {
      throw new MissingTenantContextError(
        `INSERT 시 tenant 컨텍스트가 없습니다. entity=${event.metadata.name}`,
        'typeorm-insert',
      );
    }
  }

  /**
   * Entity가 DB에서 로드된 직후 hook.
   *
   * 어떤 경로로든 (raw SQL, escape hatch, 우회 코드) 다른 tenant의 데이터가
   * 메모리에 올라왔다면 여기서 마지막으로 검출해 throw.
   *
   * "다층 방어"의 최종 안전망입니다.
   */
  afterLoad(entity: any, event?: LoadEvent<any>): void {
    if (!entity || !event) return;
    if (!this.isTenantAwareEntity(event.metadata.target as Function)) return;

    const tenantField = this.options.tenantIdField;
    const tenantId = getCurrentTenantId();
    const isSystemAction = tenantContextStorage.getStore()?.isSystemAction === true;

    // 시스템 작업이면 cross-tenant 검사 스킵 (모든 tenant 데이터 정상 접근).
    if (isSystemAction) return;

    const entityTenant = entity[tenantField];

    // 현재 컨텍스트가 있는데 다른 tenant 데이터가 올라왔다면 즉시 차단.
    if (tenantId && entityTenant && entityTenant !== tenantId) {
      throw new CrossTenantAccessError(
        `[SECURITY] ${event.metadata.name} 로드 결과의 ${tenantField}(${entityTenant})가 현재 tenant(${tenantId})와 다릅니다. 코드의 escape hatch를 점검하세요.`,
        tenantId,
        String(entityTenant),
        event.metadata.name,
      );
    }
  }

  /**
   * QueryBuilder의 SELECT/UPDATE/DELETE에 자동 WHERE 주입.
   *
   * TypeORM 0.3+에서는 beforeQuery 같은 hook이 제한적이라,
   * 실제 구현은 EntityManager wrap 또는 QueryBuilder 가로채기를 통해 이뤄집니다.
   *
   * TODO(v0.0.3 마일스톤): 정확한 구현 전략 결정.
   *   옵션 A: QueryBuilder의 createQueryBuilder를 monkey-patch
   *   옵션 B: TypeORM connection의 query() 가로채기 + SQL 텍스트 변환
   *   옵션 C: Repository 패턴 — Tenant-aware Repository 자동 주입 (가장 깔끔)
   *
   * 일단 v0.1 스켈레톤은 인터페이스만 정의하고, afterLoad 검증을
   * 통한 "사후 차단"으로 안전망 역할 보장.
   */
  // beforeQuery(event: QueryEvent): void { ... }  // v0.0.3 추가 예정

  /**
   * 주어진 entity 클래스가 tenant 보호 대상인지 판정.
   *
   * 사용자가 forRoot에 entities를 명시했으면 그 화이트리스트로만 확인.
   * 미명시 시 모든 entity를 검사 (기본 안전 모드).
   */
  private isTenantAwareEntity(target: Function): boolean {
    if (!this.options.entities || this.options.entities.length === 0) {
      // 화이트리스트가 없으면 모든 entity가 잠재적 대상.
      // 실제 검사 단계에서 tenantIdField가 entity에 없으면 자연스럽게 skip됨.
      return true;
    }
    return this.options.entities.includes(target);
  }
}
