/**
 * 한 tenant가 다른 tenant의 데이터에 접근을 시도했을 때 throw 되는 에러.
 *
 * 이 에러가 나면 그 자체로 보안 사고 신호입니다.
 * 정상 흐름에서는 절대 발생하지 않아야 합니다 (Subscriber가 자동 WHERE를 주입하므로).
 *
 * 발생 가능 시나리오:
 *  - 어딘가에서 escape hatch(raw SQL, getManager 직접 사용)로 우회한 경우
 *  - Subscriber가 등록되지 않은 entity를 사용한 경우
 *  - 캐시 키 분리가 안 된 상태에서 다른 tenant 데이터가 응답된 경우
 *
 * 처리 권장:
 *  - 즉시 알림 (Slack, Sentry, PagerDuty 등)
 *  - 해당 요청 ID, 사용자, IP 함께 기록
 *  - 코드 리뷰로 우회 경로 점검
 */
export class CrossTenantAccessError extends Error {
  /**
   * @param message         - 에러 메시지
   * @param currentTenant   - 현재 요청의 tenant ID
   * @param attemptedTenant - 접근 시도한 데이터의 tenant ID
   * @param entityName      - 해당 entity 클래스 이름 (선택)
   */
  constructor(
    message: string,
    public readonly currentTenant: string,
    public readonly attemptedTenant: string,
    public readonly entityName?: string,
  ) {
    super(message);
    this.name = 'CrossTenantAccessError';
    Object.setPrototypeOf(this, CrossTenantAccessError.prototype);
  }
}
