/**
 * Thrown when TenantShieldModule.forRoot() configuration is invalid.
 * Fails fast at boot time before the app accepts traffic.
 *
 * TenantShieldModule.forRoot() 설정이 잘못됐을 때 throw 됩니다.
 * 잘못된 설정의 앱이 트래픽을 받기 전에 즉시 실패합니다.
 *
 * Examples / 예시:
 *  - tenantSource: 'custom' without customResolver
 *  - tenantSource: 'subdomain' without subdomainPattern
 *  - strategy: 'schema' (not supported in v0.1)
 */
export class InvalidTenantSourceError extends Error {
  /** Default English message. */
  static readonly DEFAULT_MESSAGE =
    'Invalid tenant source configuration. ' +
    'Check your TenantShieldModule.forRoot() options. ' +
    '/ 잘못된 tenant 소스 설정입니다. TenantShieldModule.forRoot() 옵션을 확인하세요.';

  constructor(
    message = InvalidTenantSourceError.DEFAULT_MESSAGE,
    public readonly source: string = 'unknown',
  ) {
    super(message);
    this.name = 'InvalidTenantSourceError';
    Object.setPrototypeOf(this, InvalidTenantSourceError.prototype);
  }
}
