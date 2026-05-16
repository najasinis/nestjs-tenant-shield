import { TenantResolver } from './tenant-resolver.interface';

/**
 * 사용자가 직접 제공한 함수를 그대로 호출해 tenant ID를 얻는 resolver.
 *
 * Header/JWT/Subdomain 셋 어디에도 안 맞는 특수한 경우를 위한 탈출구입니다.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [예시 — multi-source 인증]
 *
 *   customResolver: (req) => {
 *     // 모바일 앱은 헤더로, 웹은 JWT로, 외부 통합은 API 키로 보낼 때
 *     return req.user?.organizationId
 *         ?? req.headers['x-tenant-id']
 *         ?? req.apiKey?.tenantId
 *         ?? null;
 *   }
 *
 * ─────────────────────────────────────────────────────────────
 */
export class CustomTenantResolver implements TenantResolver {
  /**
   * @param fn - 사용자가 forRoot에서 제공한 customResolver 함수.
   */
  constructor(private readonly fn: (request: unknown) => string | null) {}

  resolve(request: unknown): string | null {
    // 사용자 함수 호출 후 결과 검증.
    // 빈 문자열, 잘못된 타입은 null로 정규화.
    try {
      const result = this.fn(request);
      if (typeof result !== 'string' || result.length === 0) return null;
      return result;
    } catch {
      // 사용자 함수가 throw해도 라이브러리 전체가 죽으면 안 됨.
      // 추출 실패로 간주하고 미들웨어가 strict mode 정책에 따라 처리하도록 위임.
      return null;
    }
  }
}
