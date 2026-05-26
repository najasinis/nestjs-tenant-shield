/**
 * Thrown when a method decorated with @RequireTenant() is called without a tenant context.
 *
 * @RequireTenant()가 적용된 메서드가 tenant 컨텍스트 없이 호출됐을 때 throw 됩니다.
 *
 * Causes / 발생 원인:
 *  1) Middleware not applied to this route / 미들웨어가 이 라우트에 미적용
 *  2) Missing runWithTenant() in background jobs / 백그라운드 작업에서 컨텍스트 전파 누락
 *  3) Missing runWithTenant() in test code / 테스트 코드에서 runWithTenant() 누락
 *
 * Recommended handling / 처리 권장:
 *  - Catch in NestJS Exception Filter, respond 401 or 500
 *  - NestJS Exception Filter에서 잡아 401 또는 500으로 응답
 */
export class MissingTenantContextError extends Error {
  /** Default English message used when no message is provided. */
  static readonly DEFAULT_MESSAGE =
    'Tenant context is required but was not found. ' +
    'Ensure TenantContextMiddleware is applied or wrap the call with runWithTenant(). ' +
    '/ tenant 컨텍스트가 필요하지만 설정되지 않았습니다. ' +
    'TenantContextMiddleware가 적용됐는지, 또는 runWithTenant()로 감쌌는지 확인하세요.';

  constructor(
    message = MissingTenantContextError.DEFAULT_MESSAGE,
    public readonly source: string = 'unknown',
  ) {
    super(message);
    this.name = 'MissingTenantContextError';
    Object.setPrototypeOf(this, MissingTenantContextError.prototype);
  }
}
