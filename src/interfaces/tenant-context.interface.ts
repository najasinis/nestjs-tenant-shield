/**
 * AsyncLocalStorage에 저장되는 컨텍스트의 형태.
 *
 * 요청 하나당 하나의 TenantContext가 생성되고,
 * 비동기 호출 체인 끝까지 동일한 인스턴스가 공유됩니다.
 *
 * 비유: 손님 한 명에게 발급되는 일회용 출입 카드.
 *      어느 부서를 거치든 카드의 정보(어느 회사 손님인지)는 유지됨.
 */
export interface TenantContext {
  /**
   * 현재 요청의 tenant ID.
   * null이면 시스템 작업 또는 컨텍스트 미설정 상태.
   */
  tenantId: string | null;

  /**
   * 이 요청이 명시적으로 "시스템 작업"으로 표시됐는지.
   *
   * true: @SystemAction()이 적용된 경로 또는 runWithoutTenant()로 진입.
   *       tenantId가 null이어도 strict mode가 throw하지 않음.
   *
   * 일반 요청에서는 false 또는 undefined.
   */
  isSystemAction?: boolean;
}
