/**
 * Tenant 컨텍스트가 설정되지 않은 상태에서
 * @RequireTenant()가 적용된 메서드를 호출했을 때 throw 되는 에러.
 *
 * 발생 원인:
 *  1) 미들웨어가 동작하지 않은 경로 (정적 파일, public 라우트 등)
 *  2) 백그라운드 작업에서 컨텍스트 전파 누락
 *  3) 테스트 코드에서 runWithTenant() 누락
 *
 * 처리 권장:
 *  - NestJS Exception Filter에서 잡아 401 또는 500으로 응답
 *  - 로그에 source(어디서 추출 시도했는지) 기록해 디버깅 시간 단축
 */
export class MissingTenantContextError extends Error {
  /**
   * @param message - 에러 메시지 (한국어/영어 자유)
   * @param source  - tenant 추출을 시도한 위치 (header/jwt/subdomain/custom)
   */
  constructor(
    message: string,
    public readonly source: string,
  ) {
    super(message);

    // V8 엔진(Node.js) 스택 트레이스에서 이 클래스 이름이 정확히 보이도록 설정.
    // 이게 없으면 인스턴스 검사가 깨질 수 있고, 디버깅 시 스택이 어색하게 찍힘.
    this.name = 'MissingTenantContextError';
    Object.setPrototypeOf(this, MissingTenantContextError.prototype);
  }
}
