/**
 * Tenant ID를 요청에서 추출하는 모든 resolver가 구현해야 하는 공통 인터페이스.
 *
 * 전략 패턴(Strategy Pattern):
 *  - HeaderTenantResolver
 *  - JwtTenantResolver
 *  - SubdomainTenantResolver
 *  - CustomTenantResolver
 *
 * 모두 같은 resolve() 시그니처를 갖기 때문에, 미들웨어는 어떤 구현체인지
 * 신경 쓰지 않고 단일 코드로 처리할 수 있습니다.
 */
export interface TenantResolver {
  /**
   * 들어온 요청 객체에서 tenant ID를 추출합니다.
   *
   * @param request - Express/Fastify의 Request 객체. 라이브러리는 둘 다 지원해야 하므로 unknown.
   * @returns tenant ID 문자열 또는 null (찾지 못한 경우)
   */
  resolve(request: unknown): string | null;
}
