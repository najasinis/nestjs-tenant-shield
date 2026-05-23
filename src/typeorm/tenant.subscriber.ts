import {
  DeleteQueryBuilder,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  LoadEvent,
  Repository,
  SelectQueryBuilder,
  UpdateQueryBuilder,
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
  constructor(private readonly options: TenantShieldOptions) {
    // v0.1: QueryBuilder 레벨에서 auto WHERE 주입 패치 적용
    patchQueryBuildersOnce(options);
    // v0.1: Repository 레벨에서 auto WHERE/INSERT 보강
    patchRepositoriesOnce(options);
  }

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
    * v0.1에서는 QueryBuilder 프로토타입을 monkey-patch하여
    * getMany/getOne/getCount/execute 전에 자동 조건을 주입합니다.
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

const TENANT_WHERE_APPLIED_FLAG = '__tenantShieldWhereApplied';
let isQueryBuilderPatched = false;
let patchedTenantField: string | null = null;
let isRepositoryPatched = false;
let patchedOptions: TenantShieldOptions | null = null;

let _origGetMany: typeof SelectQueryBuilder.prototype.getMany | null = null;
let _origGetOne: typeof SelectQueryBuilder.prototype.getOne | null = null;
let _origGetManyAndCount: typeof SelectQueryBuilder.prototype.getManyAndCount | null = null;
let _origGetCount: typeof SelectQueryBuilder.prototype.getCount | null = null;
let _origGetRawMany: typeof SelectQueryBuilder.prototype.getRawMany | null = null;
let _origGetRawOne: typeof SelectQueryBuilder.prototype.getRawOne | null = null;
let _origUpdateExecute: typeof UpdateQueryBuilder.prototype.execute | null = null;
let _origDeleteExecute: typeof DeleteQueryBuilder.prototype.execute | null = null;
let _origFind: typeof Repository.prototype.find | null = null;
let _origFindOne: typeof Repository.prototype.findOne | null = null;
let _origFindBy: typeof Repository.prototype.findBy | null = null;
let _origFindOneBy: typeof Repository.prototype.findOneBy | null = null;
let _origCount: typeof Repository.prototype.count | null = null;
let _origSave: typeof Repository.prototype.save | null = null;

function patchQueryBuildersOnce(options: TenantShieldOptions): void {
  if (isQueryBuilderPatched) {
    if (patchedTenantField && patchedTenantField !== options.tenantIdField) {
      throw new Error(
        `TenantSubscriber: 이미 tenantIdField='${patchedTenantField}'로 패치됨. ` +
          `다른 tenantIdField='${options.tenantIdField}'는 지원하지 않습니다.`,
      );
    }
    return;
  }

  isQueryBuilderPatched = true;
  patchedTenantField = options.tenantIdField;

  _origGetMany = SelectQueryBuilder.prototype.getMany;
  SelectQueryBuilder.prototype.getMany = function (this: SelectQueryBuilder<any>, ...args: any[]) {
    applyTenantWhereIfNeeded(this, options);
    return _origGetMany!.apply(this, args as any);
  } as any;

  _origGetOne = SelectQueryBuilder.prototype.getOne;
  SelectQueryBuilder.prototype.getOne = function (this: SelectQueryBuilder<any>, ...args: any[]) {
    applyTenantWhereIfNeeded(this, options);
    return _origGetOne!.apply(this, args as any);
  } as any;

  _origGetManyAndCount = SelectQueryBuilder.prototype.getManyAndCount;
  SelectQueryBuilder.prototype.getManyAndCount = function (this: SelectQueryBuilder<any>, ...args: any[]) {
    applyTenantWhereIfNeeded(this, options);
    return _origGetManyAndCount!.apply(this, args as any);
  } as any;

  _origGetCount = SelectQueryBuilder.prototype.getCount;
  SelectQueryBuilder.prototype.getCount = function (this: SelectQueryBuilder<any>, ...args: any[]) {
    applyTenantWhereIfNeeded(this, options);
    return _origGetCount!.apply(this, args as any);
  } as any;

  _origGetRawMany = SelectQueryBuilder.prototype.getRawMany;
  SelectQueryBuilder.prototype.getRawMany = function (this: SelectQueryBuilder<any>, ...args: any[]) {
    applyTenantWhereIfNeeded(this, options);
    return _origGetRawMany!.apply(this, args as any);
  } as any;

  _origGetRawOne = SelectQueryBuilder.prototype.getRawOne;
  SelectQueryBuilder.prototype.getRawOne = function (this: SelectQueryBuilder<any>, ...args: any[]) {
    applyTenantWhereIfNeeded(this, options);
    return _origGetRawOne!.apply(this, args as any);
  } as any;

  _origUpdateExecute = UpdateQueryBuilder.prototype.execute;
  UpdateQueryBuilder.prototype.execute = function (this: UpdateQueryBuilder<any>, ...args: any[]) {
    applyTenantWhereIfNeeded(this, options);
    return _origUpdateExecute!.apply(this, args as any);
  } as any;

  _origDeleteExecute = DeleteQueryBuilder.prototype.execute;
  DeleteQueryBuilder.prototype.execute = function (this: DeleteQueryBuilder<any>, ...args: any[]) {
    applyTenantWhereIfNeeded(this, options);
    return _origDeleteExecute!.apply(this, args as any);
  } as any;
}

function applyTenantWhereIfNeeded(
  queryBuilder: SelectQueryBuilder<any> | UpdateQueryBuilder<any> | DeleteQueryBuilder<any>,
  options: TenantShieldOptions,
): void {
  const qb = queryBuilder as any;
  if (qb[TENANT_WHERE_APPLIED_FLAG]) return;

  const tenantId = getCurrentTenantId();
  const isSystemAction = tenantContextStorage.getStore()?.isSystemAction === true;

  if (!tenantId) {
    if (!isSystemAction && options.strictMode !== false) {
      throw new MissingTenantContextError(
        'QueryBuilder 실행 시 tenant 컨텍스트가 없습니다. 요청/테스트 컨텍스트를 확인하세요.',
        'typeorm-query',
      );
    }
    return;
  }

  if (isSystemAction) return;

  const mainAlias = qb.expressionMap?.mainAlias;
  const metadata = mainAlias?.metadata;
  if (!metadata) return;

  if (!isTenantAwareMetadata(metadata, options)) return;

  const tenantField = options.tenantIdField;
  const aliasName = mainAlias.name;
  const paramKey = '__tenant_id';

  const wheres = qb.expressionMap?.wheres ?? [];
  const hasTenantWhere = wheres.some((where: any) => {
    const condition = where?.condition;
    if (!condition) return false;
    if (typeof condition === 'string') return condition.includes(tenantField);
    try {
      return JSON.stringify(condition).includes(tenantField);
    } catch {
      return false;
    }
  });

  if (!hasTenantWhere) {
    qb.andWhere(`${aliasName}.${tenantField} = :${paramKey}`, {
      [paramKey]: tenantId,
    });
  }

  qb[TENANT_WHERE_APPLIED_FLAG] = true;
}

function isTenantAwareMetadata(metadata: any, options: TenantShieldOptions): boolean {
  if (options.entities && options.entities.length > 0) {
    if (!options.entities.includes(metadata.target)) return false;
  }

  const tenantField = options.tenantIdField;
  return metadata.columns.some(
    (column: any) => column.propertyName === tenantField || column.databaseName === tenantField,
  );
}

function patchRepositoriesOnce(options: TenantShieldOptions): void {
  if (isRepositoryPatched) {
    if (patchedTenantField && patchedTenantField !== options.tenantIdField) {
      throw new Error(
        `TenantSubscriber: 이미 tenantIdField='${patchedTenantField}'로 패치됨. ` +
          `다른 tenantIdField='${options.tenantIdField}'는 지원하지 않습니다.`,
      );
    }
    return;
  }

  isRepositoryPatched = true;
  patchedTenantField = options.tenantIdField;
  patchedOptions = options;

  // 각 patch에 try/catch + Promise.reject — 컨텍스트 누락 throw가 NestJS의
  // async 흐름에서 자연스럽게 catch되도록 sync throw를 async rejection으로 통일.
  _origFind = Repository.prototype.find;
  Repository.prototype.find = function (this: Repository<any>, options?: any) {
    try {
      const patched = applyTenantToFindOptions(this, options, options ? options : undefined);
      return _origFind!.call(this, patched);
    } catch (err) {
      return Promise.reject(err);
    }
  } as any;

  _origFindOne = Repository.prototype.findOne;
  Repository.prototype.findOne = function (this: Repository<any>, options?: any) {
    try {
      const patched = applyTenantToFindOptions(this, options, options ? options : undefined);
      return _origFindOne!.call(this, patched);
    } catch (err) {
      return Promise.reject(err);
    }
  } as any;

  _origFindBy = Repository.prototype.findBy;
  Repository.prototype.findBy = function (this: Repository<any>, where: any) {
    try {
      const patched = applyTenantToWhere(this, where);
      return _origFindBy!.call(this, patched);
    } catch (err) {
      return Promise.reject(err);
    }
  } as any;

  _origFindOneBy = Repository.prototype.findOneBy;
  Repository.prototype.findOneBy = function (this: Repository<any>, where: any) {
    try {
      const patched = applyTenantToWhere(this, where);
      return _origFindOneBy!.call(this, patched);
    } catch (err) {
      return Promise.reject(err);
    }
  } as any;

  _origCount = Repository.prototype.count;
  Repository.prototype.count = function (this: Repository<any>, options?: any) {
    try {
      const patched = applyTenantToFindOptions(this, options, options ? options : undefined);
      return _origCount!.call(this, patched);
    } catch (err) {
      return Promise.reject(err);
    }
  } as any;

  _origSave = Repository.prototype.save;
  Repository.prototype.save = function (this: Repository<any>, entity: any, options?: any) {
    try {
      const patchedEntity = applyTenantToSaveEntity(this, entity, options);
      return _origSave!.call(this, patchedEntity, options);
    } catch (err) {
      return Promise.reject(err);
    }
  } as any;
}

function applyTenantToFindOptions(repo: Repository<any>, rawOptions: any, options: any): any {
  const tenantId = getCurrentTenantId();
  const isSystemAction = tenantContextStorage.getStore()?.isSystemAction === true;
  const strict = patchedOptions?.strictMode !== false;

  // tenant가 없는 모든 케이스를 한 곳에서 분기.
  //  - 시스템 작업이면: 머지 안 하고 원본 옵션 그대로 → 모든 tenant 데이터 접근
  //  - strict면      : MissingTenantContextError throw
  //  - 그 외         : 머지 안 하고 원본 옵션 그대로 (경고 정책은 데코레이터에서)
  if (!tenantId) {
    if (!isSystemAction && strict) {
      throw new MissingTenantContextError(
        'Repository 실행 시 tenant 컨텍스트가 없습니다. 요청/테스트 컨텍스트를 확인하세요.',
        'typeorm-repository',
      );
    }
    return rawOptions;
  }

  if (!isTenantAwareRepository(repo, options)) return rawOptions;

  const tenantField = patchedTenantField as string;
  const baseWhere = options?.where ?? undefined;
  const mergedWhere = mergeTenantWhere(baseWhere, tenantField, tenantId);

  return {
    ...(rawOptions ?? {}),
    where: mergedWhere,
  };
}

function applyTenantToWhere(repo: Repository<any>, where: any): any {
  const tenantId = getCurrentTenantId();
  const isSystemAction = tenantContextStorage.getStore()?.isSystemAction === true;
  const strict = patchedOptions?.strictMode !== false;

  if (!tenantId) {
    if (!isSystemAction) {
      if (strict) {
        throw new MissingTenantContextError(
          'Repository 실행 시 tenant 컨텍스트가 없습니다. 요청/테스트 컨텍스트를 확인하세요.',
          'typeorm-repository',
        );
      }
    }
    return where;
  }

  if (!isTenantAwareRepository(repo, where)) return where;

  const tenantField = patchedTenantField as string;
  const resolvedTenantId = tenantId as string;
  return mergeTenantWhere(where, tenantField, resolvedTenantId);
}

function applyTenantToSaveEntity(repo: Repository<any>, entity: any, _options: any): any {
  const tenantId = getCurrentTenantId();
  const isSystemAction = tenantContextStorage.getStore()?.isSystemAction === true;
  const strict = patchedOptions?.strictMode !== false;

  if (!tenantId) {
    if (!isSystemAction) {
      if (strict) {
        throw new MissingTenantContextError(
          'Repository.save 시 tenant 컨텍스트가 없습니다. 요청/테스트 컨텍스트를 확인하세요.',
          'typeorm-save',
        );
      }
    }
    return entity;
  }

  if (!isTenantAwareRepository(repo, entity)) return entity;

  const tenantField = patchedTenantField as string;
  const resolvedTenantId = tenantId as string;

  const attach = (item: any) => {
    const existing = item?.[tenantField];
    if (existing && existing !== resolvedTenantId) {
      throw new CrossTenantAccessError(
        `INSERT 시 ${tenantField}=${existing}는 현재 tenant(${tenantId})와 다릅니다.`,
        resolvedTenantId,
        String(existing),
        repo.metadata?.name ?? 'UnknownEntity',
      );
    }
    if (!existing) {
      item[tenantField] = resolvedTenantId;
    }
  };

  if (Array.isArray(entity)) {
    entity.forEach(attach);
    return entity;
  }

  attach(entity);
  return entity;
}

function mergeTenantWhere(where: any, tenantField: string, tenantId: string): any {
  if (!where) {
    return { [tenantField]: tenantId };
  }

  if (Array.isArray(where)) {
    return where.map((item) => ({ ...item, [tenantField]: tenantId }));
  }

  return { ...where, [tenantField]: tenantId };
}

function isTenantAwareRepository(repo: Repository<any>, _input: any): boolean {
  const metadata = repo.metadata;
  if (!metadata) return false;
  if (patchedTenantField == null) return false;

  const tenantField = patchedTenantField;

  return metadata.columns.some(
    (column: any) => column.propertyName === tenantField || column.databaseName === tenantField,
  );
}

/**
 * 모든 prototype 패치를 원복하고 모듈 상태를 초기화한다.
 * e2e 테스트의 afterAll에서 호출해 테스트 간 오염을 방지한다.
 */
export function unpatch(): void {
  if (_origGetMany) { SelectQueryBuilder.prototype.getMany = _origGetMany; _origGetMany = null; }
  if (_origGetOne) { SelectQueryBuilder.prototype.getOne = _origGetOne; _origGetOne = null; }
  if (_origGetManyAndCount) { SelectQueryBuilder.prototype.getManyAndCount = _origGetManyAndCount; _origGetManyAndCount = null; }
  if (_origGetCount) { SelectQueryBuilder.prototype.getCount = _origGetCount; _origGetCount = null; }
  if (_origGetRawMany) { SelectQueryBuilder.prototype.getRawMany = _origGetRawMany; _origGetRawMany = null; }
  if (_origGetRawOne) { SelectQueryBuilder.prototype.getRawOne = _origGetRawOne; _origGetRawOne = null; }
  if (_origUpdateExecute) { UpdateQueryBuilder.prototype.execute = _origUpdateExecute; _origUpdateExecute = null; }
  if (_origDeleteExecute) { DeleteQueryBuilder.prototype.execute = _origDeleteExecute; _origDeleteExecute = null; }
  if (_origFind) { Repository.prototype.find = _origFind; _origFind = null; }
  if (_origFindOne) { Repository.prototype.findOne = _origFindOne; _origFindOne = null; }
  if (_origFindBy) { Repository.prototype.findBy = _origFindBy; _origFindBy = null; }
  if (_origFindOneBy) { Repository.prototype.findOneBy = _origFindOneBy; _origFindOneBy = null; }
  if (_origCount) { Repository.prototype.count = _origCount; _origCount = null; }
  if (_origSave) { Repository.prototype.save = _origSave; _origSave = null; }

  isQueryBuilderPatched = false;
  isRepositoryPatched = false;
  patchedTenantField = null;
  patchedOptions = null;
}
