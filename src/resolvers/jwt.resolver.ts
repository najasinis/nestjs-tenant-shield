import { TenantResolver } from './tenant-resolver.interface';

/**
 * JWT 페이로드의 claim에서 tenant ID를 추출하는 resolver.
 *
 * 동작 전제:
 *  사용자의 인증 미들웨어(예: Passport, @nestjs/jwt)가 이미
 *  JWT를 검증하고 페이로드를 request.user 또는 request.jwt에
 *  넣어 둔 상태여야 합니다.
 *
 *  이 resolver는 그 객체에서 특정 키만 읽어옵니다.
 *  즉, JWT 자체 검증은 이 라이브러리의 책임이 아님.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [예시 JWT 페이로드]
 *
 *   {
 *     "sub": "user-123",
 *     "tenant_id": "academy-A",
 *     "exp": 1700000000
 *   }
 *
 * → jwtClaim: 'tenant_id'로 설정하면 'academy-A'를 추출.
 *
 * ─────────────────────────────────────────────────────────────
 */
export class JwtTenantResolver implements TenantResolver {
  /**
   * @param claimName - JWT 페이로드에서 읽을 키 이름. 기본 'tenant_id'.
   */
  constructor(private readonly claimName: string = 'tenant_id') {}

  resolve(request: unknown): string | null {
    // 인증 미들웨어가 request.user 또는 request.jwt에 페이로드를 넣어 둔다는 가정.
    // 두 위치 모두 확인하여 호환성 확보.
    const req = request as {
      user?: Record<string, unknown>;
      jwt?: Record<string, unknown>;
    };

    const payload = req.user ?? req.jwt;
    if (!payload) return null;

    const value = payload[this.claimName];

    // tenant ID는 문자열로만 받음. 숫자/객체 등은 보안상 거부.
    if (typeof value !== 'string' || value.length === 0) return null;

    return value;
  }
}
