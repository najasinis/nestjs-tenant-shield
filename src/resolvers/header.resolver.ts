import { TenantResolver } from './tenant-resolver.interface';

/**
 * HTTP 헤더에서 tenant ID를 추출하는 resolver.
 *
 * 가장 단순하고 흔한 방식. 클라이언트(웹/모바일/API)가
 * 매 요청마다 X-Tenant-Id 같은 헤더를 보냅니다.
 *
 * ⚠️ 헤더 값은 클라이언트가 자유롭게 위조할 수 있습니다.
 *    따라서 반드시 인증 미들웨어가 "이 사용자가 진짜 이 tenant 소속인지"
 *    검증한 뒤에 이 resolver를 사용해야 합니다.
 *    (이 라이브러리는 격리만 담당하고, 인증 자체는 책임지지 않음)
 */
export class HeaderTenantResolver implements TenantResolver {
  /**
   * @param headerName - 어떤 헤더 이름을 읽을지. 기본 'x-tenant-id'
   *                     (HTTP 헤더 이름은 대소문자 무시이지만, 노드는 보통 소문자로 정규화)
   */
  constructor(private readonly headerName: string = 'x-tenant-id') {}

  resolve(request: unknown): string | null {
    // Express/Fastify 모두 req.headers를 통해 헤더 dict에 접근 가능.
    // 타입은 라이브러리 호환성을 위해 unknown으로 받고 안에서 좁힙니다.
    const req = request as { headers?: Record<string, string | string[] | undefined> };

    // 헤더가 아예 없으면 null 반환.
    const raw = req.headers?.[this.headerName.toLowerCase()];
    if (!raw) return null;

    // 헤더는 같은 키로 여러 값이 올 수 있어 배열일 수 있음 → 첫 번째 값 사용.
    const value = Array.isArray(raw) ? raw[0] : raw;

    // 빈 문자열도 null로 간주 (의미 있는 tenant ID로 보지 않음).
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
