/**
 * TenantShieldModule.forRoot() 설정이 잘못됐을 때 throw 되는 에러.
 *
 * 예시 케이스:
 *  - tenantSource: 'custom' 인데 customResolver가 없음
 *  - tenantSource: 'subdomain' 인데 subdomainPattern이 없음
 *  - strategy: 'schema' (v0.1에서는 미지원)
 *
 * 이 에러는 앱 부팅 단계(@Module 초기화)에서 발생해
 * 잘못된 설정의 앱이 트래픽을 받기 전에 즉시 실패하도록 합니다.
 */
export class InvalidTenantSourceError extends Error {
  /**
   * @param message - 사용자에게 어떤 설정이 잘못됐는지 알려주는 메시지
   * @param source  - 문제가 발생한 source 타입 (header/jwt/...)
   */
  constructor(
    message: string,
    public readonly source: string,
  ) {
    super(message);
    this.name = 'InvalidTenantSourceError';
    Object.setPrototypeOf(this, InvalidTenantSourceError.prototype);
  }
}
