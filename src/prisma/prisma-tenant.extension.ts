import { getCurrentTenantId } from '../context/get-current-tenant-id';
import { tenantContextStorage } from '../context/tenant-context.storage';
import { CrossTenantAccessError } from '../errors/cross-tenant-access.error';
import { MissingTenantContextError } from '../errors/missing-tenant-context.error';
import { SecurityViolationEvent, TenantShieldOptions } from '../interfaces/tenant-shield-options.interface';

// WHERE를 추가할 수 있는 읽기 작업 (findUnique/findUniqueOrThrow는 unique 제약 때문에 별도 처리)
const WHERE_INJECTABLE_READ_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

// unique 제약으로 WHERE 주입이 불가능한 읽기 작업 → 결과 사후 검증으로 대체
const UNIQUE_READ_OPS = new Set(['findUnique', 'findUniqueOrThrow']);

// WHERE만 추가하면 되는 쓰기 작업
const WHERE_ONLY_WRITE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

// 집계 결과는 entity row가 아니므로 사후 tenantId 검증 건너뜀
const AGGREGATE_OPS = new Set(['count', 'aggregate', 'groupBy']);

function fireAuditCallback(
  onViolation: ((event: SecurityViolationEvent) => void) | undefined,
  event: SecurityViolationEvent,
): void {
  if (!onViolation) return;
  try {
    onViolation(event);
  } catch {
    // Never let audit callback errors mask the original security error.
  }
}

/**
 * Prisma Client를 tenant-aware하게 확장하는 함수.
 *
 * @prisma/client를 직접 import하지 않고 duck-type으로 $extends를 호출한다.
 * 이렇게 하면 Prisma를 쓰지 않는 사용자(TypeORM only 등)의 앱이 빌드 시 깨지지 않는다.
 *
 * 사용 예시:
 *   const prisma = createTenantAwarePrisma(new PrismaClient(), options);
 *   // 이후 prisma.student.findMany()는 자동으로 WHERE tenantId = <현재 tenant> 적용
 */
export function createTenantAwarePrisma<
  TClient extends { $extends: (...args: any[]) => any },
>(
  client: TClient,
  options: Pick<TenantShieldOptions, 'tenantIdField' | 'strictMode' | 'onSecurityViolation'>,
): ReturnType<TClient['$extends']> {
  const tenantField = options.tenantIdField;
  const strict = options.strictMode !== false;

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: any;
          query: (args: any) => Promise<any>;
        }): Promise<any> {
          const tenantId = getCurrentTenantId();
          const isSystemAction =
            tenantContextStorage.getStore()?.isSystemAction === true;

          if (!tenantId) {
            if (!isSystemAction && strict) {
              fireAuditCallback(options.onSecurityViolation, {
                type: 'missing-context',
                currentTenantId: null,
                operation: `prisma-${operation}`,
              });
              return Promise.reject(
                new MissingTenantContextError(
                  `Prisma ${operation} 실행 시 tenant 컨텍스트가 없습니다. ` +
                    `runWithTenant() 또는 미들웨어 설정을 확인하세요.`,
                  'prisma',
                ),
              );
            }
            return query(args);
          }

          if (isSystemAction) return query(args);

          // unique 읽기: WHERE 수정 불가 → 실행 후 결과 검증
          if (UNIQUE_READ_OPS.has(operation)) {
            const result = await query(args);
            if (result !== null && result !== undefined) {
              validateEntityTenant(result, tenantId, tenantField, operation, options.onSecurityViolation);
            }
            return result;
          }

          const modifiedArgs = injectTenant(operation, args, tenantField, tenantId);
          const result = await query(modifiedArgs);

          // 집계 결과는 row가 아니므로 검증 불필요
          if (!AGGREGATE_OPS.has(operation)) {
            validateResult(result, tenantId, tenantField, operation, options.onSecurityViolation);
          }

          return result;
        },
      },
    },
  }) as ReturnType<TClient['$extends']>;
}

function injectTenant(
  operation: string,
  args: any,
  tenantField: string,
  tenantId: string,
): any {
  if (WHERE_INJECTABLE_READ_OPS.has(operation) || WHERE_ONLY_WRITE_OPS.has(operation)) {
    return { ...args, where: { ...(args.where ?? {}), [tenantField]: tenantId } };
  }

  if (operation === 'create') {
    return { ...args, data: { ...(args.data ?? {}), [tenantField]: tenantId } };
  }

  if (operation === 'createMany') {
    const data = Array.isArray(args.data)
      ? args.data.map((item: any) => ({ ...item, [tenantField]: tenantId }))
      : { ...(args.data ?? {}), [tenantField]: tenantId };
    return { ...args, data };
  }

  if (operation === 'upsert') {
    return {
      ...args,
      where: { ...(args.where ?? {}), [tenantField]: tenantId },
      create: { ...(args.create ?? {}), [tenantField]: tenantId },
    };
  }

  return args;
}

function validateResult(
  result: any,
  tenantId: string,
  tenantField: string,
  operation: string,
  onViolation?: (event: SecurityViolationEvent) => void,
): void {
  if (result === null || result === undefined) return;

  if (Array.isArray(result)) {
    for (const item of result) {
      validateEntityTenant(item, tenantId, tenantField, operation, onViolation);
    }
  } else if (typeof result === 'object') {
    validateEntityTenant(result, tenantId, tenantField, operation, onViolation);
  }
}

function validateEntityTenant(
  entity: any,
  tenantId: string,
  tenantField: string,
  operation: string,
  onViolation?: (event: SecurityViolationEvent) => void,
): void {
  if (!entity || typeof entity !== 'object') return;
  const entityTenant = entity[tenantField];
  if (entityTenant !== undefined && entityTenant !== null && entityTenant !== tenantId) {
    fireAuditCallback(onViolation, {
      type: 'cross-tenant',
      currentTenantId: tenantId,
      attemptedTenantId: String(entityTenant),
      operation,
      entityName: 'PrismaModel',
    });
    throw new CrossTenantAccessError(
      `[SECURITY] Prisma ${operation} 결과의 ${tenantField}(${entityTenant})가 ` +
        `현재 tenant(${tenantId})와 다릅니다. / ` +
        `Cross-tenant data detected in Prisma ${operation}: ` +
        `${tenantField}=${entityTenant} does not match current tenant ${tenantId}.`,
      tenantId,
      String(entityTenant),
      'PrismaModel',
    );
  }
}
