/**
 * Thrown when cross-tenant data access is detected.
 * This error is a security incident signal — it should never occur in normal flow.
 *
 * 한 tenant가 다른 tenant의 데이터에 접근을 시도했을 때 throw 됩니다.
 * 이 에러는 보안 사고 신호입니다 — 정상 흐름에서는 절대 발생하지 않아야 합니다.
 *
 * Recommended handling / 처리 권장:
 *  - Immediately alert (Slack, Sentry, PagerDuty) / 즉시 알림
 *  - Log request ID, user, IP alongside / 요청 ID, 사용자, IP 함께 기록
 *  - Audit code for bypass paths / 코드에서 우회 경로 점검
 */
export class CrossTenantAccessError extends Error {
  /** Default English message template. */
  static readonly DEFAULT_MESSAGE =
    'Cross-tenant data access detected and blocked. ' +
    'This is a security incident — audit your code for raw SQL or escape hatches. ' +
    '/ 크로스 테넌트 데이터 접근이 감지되어 차단됐습니다. ' +
    '보안 사고 가능성이 있습니다 — raw SQL 또는 escape hatch를 점검하세요.';

  constructor(
    message = CrossTenantAccessError.DEFAULT_MESSAGE,
    public readonly currentTenant: string = 'unknown',
    public readonly attemptedTenant: string = 'unknown',
    public readonly entityName?: string,
  ) {
    super(message);
    this.name = 'CrossTenantAccessError';
    Object.setPrototypeOf(this, CrossTenantAccessError.prototype);
  }
}
