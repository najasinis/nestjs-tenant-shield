/**
 * @Cacheable() 데코레이터에 넘기는 옵션.
 *
 * 메서드 결과를 캐시에 저장하고, 동일한 인자로 호출하면 캐시된 값을 즉시 반환.
 * tenant 단위 캐시 분리는 이 라이브러리의 핵심 차별점.
 */
export interface CacheableOptions {
  /**
   * 캐시 유효 시간 (초 단위). 필수.
   *
   * 예: 300 → 5분 동안 동일한 결과를 캐시에서 반환.
   * TTL이 지나면 자동으로 메서드를 다시 실행하고 결과를 갱신.
   */
  ttl: number;

  /**
   * 캐시 키에 tenant ID prefix를 자동으로 붙일지 여부 (기본 false).
   *
   * true로 설정 시:
   *   캐시 키 = `${tenantId}:${className}.${methodName}:${args}`
   *
   * → 동일한 메서드를 A학원과 B학원이 호출해도 캐시가 섞이지 않음.
   *
   * 멀티테넌시 환경에서는 거의 항상 true가 정답.
   * false로 두는 경우는 전 tenant 공통 데이터(공지사항 등)일 때만.
   */
  tenantScoped?: boolean;

  /**
   * 커스텀 캐시 키 생성 함수.
   *
   * 미지정 시: 메서드 이름 + 인자 JSON 직렬화로 자동 생성.
   *
   * 인자가 복잡한 객체이거나 일부 필드만 키에 반영하고 싶을 때 사용.
   * 예: keyGenerator: (args) => `student:${args[0].id}`
   */
  keyGenerator?: (args: unknown[]) => string;
}
