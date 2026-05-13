import { TenantResolver } from './tenant-resolver.interface';

/**
 * 호스트 이름의 서브도메인 부분에서 tenant ID를 추출하는 resolver.
 *
 * 사용 예:
 *   pattern  : '*.yourapp.com'
 *   요청 host: 'academy-a.yourapp.com'
 *   → tenant : 'academy-a'
 *
 * ─────────────────────────────────────────────────────────────
 *
 * 장점:
 *  - URL만 봐도 어느 tenant인지 명확 (브랜딩 효과)
 *  - 클라이언트가 명시적으로 헤더를 보낼 필요 없음
 *
 * 단점/주의:
 *  - DNS 와일드카드 + TLS 인증서 와일드카드 설정 필요
 *  - 로컬 개발 환경에서 /etc/hosts 또는 *.localtest.me 같은 도메인 필요
 *  - x-forwarded-host 같은 프록시 헤더 신뢰 정책 사전 점검 필수
 *
 * ─────────────────────────────────────────────────────────────
 */
export class SubdomainTenantResolver implements TenantResolver {
  /**
   * 사용자가 넘긴 pattern에서 와일드카드 자리를 찾아낸 정규식.
   * 생성 시점에 한 번만 컴파일해 둡니다 (요청마다 새로 만들면 느림).
   */
  private readonly matcher: RegExp;

  /**
   * @param pattern - 와일드카드 도메인 패턴.
   *                  '*' 자리에 들어가는 부분이 tenant ID로 사용됩니다.
   *                  예: '*.yourapp.com', '*.staging.yourapp.com'
   */
  constructor(private readonly pattern: string) {
    // '*.yourapp.com' → '^([^.]+)\.yourapp\.com$' 형태로 변환.
    //  - '*' → '([^.]+)' (도트가 아닌 한 글자 이상, 캡처 그룹)
    //  - '.' → '\.'      (정규식에서 '.' 이스케이프)
    const escaped = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '([^.]+)');
    this.matcher = new RegExp(`^${escaped}$`);
  }

  resolve(request: unknown): string | null {
    // Express는 req.hostname, Fastify는 req.hostname 또는 req.headers.host를 사용.
    // 둘 모두를 fallback으로 시도해 호환성 확보.
    const req = request as {
      hostname?: string;
      headers?: { host?: string };
    };

    const host = req.hostname ?? req.headers?.host;
    if (!host) return null;

    // 포트가 붙어 있으면 (예: localhost:3000) 제거.
    const hostWithoutPort = host.split(':')[0];

    const match = this.matcher.exec(hostWithoutPort);
    if (!match) return null;

    // 첫 번째 캡처 그룹이 tenant 부분.
    return match[1] ?? null;
  }
}
