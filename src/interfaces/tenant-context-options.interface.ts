/**
 * @TenantContext() 데코레이터 옵션 (v0.2 — 큐 통합).
 *
 * BullMQ/Bull 같은 백그라운드 큐 워커에서 job을 처리할 때,
 * job payload에 들어있는 tenant ID로 AsyncLocalStorage 컨텍스트를
 * 자동 설정해주는 데코레이터입니다.
 */
export interface TenantContextOptions {
  /**
   * 큐 페이로드에서 tenant ID를 추출하는 함수.
   *
   * 미지정 시 기본값: job.data.tenantId
   *
   * payload 구조가 다르면 명시:
   *   extractFrom: (job) => job.data.organizationId
   */
  extractFrom?: (job: unknown) => string;
}
