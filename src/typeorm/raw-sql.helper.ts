import { getCurrentTenantId } from '../context/get-current-tenant-id';
import { MissingTenantContextError } from '../errors/missing-tenant-context.error';

/**
 * ─────────────────────────────────────────────────────────────
 * withTenantWhere — Raw SQL 쿼리에 안전하게 tenant 조건을 부착하는 헬퍼.
 *
 * TenantSubscriber는 ORM(Repository, QueryBuilder)을 통한 호출만 보호합니다.
 * 사용자가 어쩔 수 없이 repository.query()로 raw SQL을 직접 실행할 때는
 * 라이브러리가 자동 주입을 해줄 수 없으므로, 이 헬퍼로 명시적으로 감싸세요.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [사용 예시]
 *
 *   // 위험: tenant 조건이 빠져있음 (보호 X)
 *   await repo.query('SELECT * FROM students');
 *
 *   // 권장: 헬퍼가 자동으로 WHERE 추가
 *   const sql = withTenantWhere('SELECT * FROM students', 'tenant_id');
 *   await repo.query(sql.text, sql.params);
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [반환 구조]
 *   {
 *     text:   'SELECT * FROM students WHERE tenant_id = $1',
 *     params: ['academy-A'],
 *   }
 *
 * SQL injection 방지를 위해 반드시 parameterized query로 반환합니다.
 */
export interface WithTenantWhereResult {
  text: string;
  params: unknown[];
}

export function withTenantWhere(
  sql: string,
  tenantColumn: string,
  existingParams: unknown[] = [],
): WithTenantWhereResult {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new MissingTenantContextError(
      'withTenantWhere: 현재 tenant 컨텍스트가 없습니다. raw SQL 사용 전 컨텍스트를 설정하세요.',
      'raw-sql',
    );
  }

  // SQL에 이미 WHERE가 있는지 단순 검사.
  // (정확한 SQL 파서는 v0.2에서 도입 검토)
  const hasWhere = /\bWHERE\b/i.test(sql);
  const placeholder = `$${existingParams.length + 1}`;
  const clause = `${tenantColumn} = ${placeholder}`;

  const text = hasWhere
    ? `${sql} AND ${clause}`
    : `${sql} WHERE ${clause}`;

  return {
    text,
    params: [...existingParams, tenantId],
  };
}
