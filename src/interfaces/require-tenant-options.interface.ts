/**
 * @RequireTenant() 데코레이터에 넘기는 옵션.
 *
 * 대부분의 경우 옵션 없이 그냥 @RequireTenant() 형태로 사용하면 됩니다.
 * 옵션은 forRoot의 전역 설정을 메서드 단위로 오버라이드하고 싶을 때만 사용.
 */
export interface RequireTenantOptions {
  /**
   * 이 메서드에 한해 tenant 없이 실행을 허용할지.
   *
   * forRoot.allowSystemActions와 무관하게 메서드별 허용 가능.
   * 다만 권장하지 않음 — 가능하면 @SystemAction()을 사용하세요.
   */
  allowSystem?: boolean;

  /**
   * Strict mode 메서드별 오버라이드.
   * 미지정 시 forRoot의 strictMode 따름.
   *
   * 예: 마이그레이션 중인 특정 메서드만 임시로 strict를 끄고 싶을 때.
   */
  strictMode?: boolean;
}
