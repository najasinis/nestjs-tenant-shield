import { tenantContextStorage } from './tenant-context.storage';

/**
 * 명시적으로 tenant 컨텍스트를 설정한 채 비동기 함수를 실행합니다.
 *
 * 주 용도:
 *  1) 테스트: 매 테스트 케이스마다 어떤 tenant인지 명시
 *  2) 시스템 작업: 모든 tenant를 순회하는 cron 등
 *  3) 마이그레이션 스크립트: 특정 tenant에 대해 직접 작업
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [예시 1 — 테스트]
 *
 *   await runWithTenant('academy-A', async () => {
 *     const students = await service.findAll();
 *     expect(students.every(s => s.tenantId === 'academy-A')).toBe(true);
 *   });
 *
 * [예시 2 — 모든 tenant 순회]
 *
 *   for (const t of await tenantRegistry.findAll()) {
 *     await runWithTenant(t.id, async () => {
 *       await this.dailyCleanupService.run();
 *     });
 *   }
 *
 * ─────────────────────────────────────────────────────────────
 */
export function runWithTenant<T>(
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  // storage.run()의 첫 번째 인자가 이 비동기 흐름의 store가 됩니다.
  // 콜백 안에서 호출되는 모든 await/Promise 체인은 같은 store를 공유.
  return tenantContextStorage.run({ tenantId, isSystemAction: false }, fn);
}

/**
 * tenant 없이 시스템 작업을 실행합니다.
 *
 * forRoot.allowSystemActions가 true여야 의미가 있습니다.
 * 컨텍스트에 isSystemAction: true 플래그를 박아 두어
 * Subscriber/데코레이터가 "이건 의도된 무-tenant 실행"임을 알 수 있게 함.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * 🚨 보안 경고
 *
 *   이 함수는 라이브러리의 모든 자동 격리 보호를 의도적으로 해제합니다.
 *   잘못 쓰면 단 한 번의 호출로 전 tenant 데이터가 한 결과 셋에 섞여 나올 수
 *   있고, 그 결과가 사용자에게 노출되면 회사가 멈춥니다.
 *
 *   ✅ 쓰는 게 정당한 경우
 *     - 시스템 테이블(tenant_id 컬럼이 없는 메타 테이블) 접근
 *     - "모든 tenant 한 번에 집계"가 진짜 비즈니스 요구인 운영 통계
 *     - 마이그레이션/데이터 보정 스크립트 (운영자 직접 실행)
 *
 *   ❌ 절대 쓰면 안 되는 경우
 *     - HTTP 요청 핸들러 (사용자 요청 안에서 호출되면 그 사용자에게 다른
 *       tenant 데이터가 흘러갈 가능성이 즉시 생김)
 *     - "테스트가 빨리 지나가게 하려고" 임시 우회
 *     - tenant ID 추출이 귀찮아서 우회 — 99%는 runWithTenant 루프가 정답
 *
 *   📋 운영 권장 사항
 *     - 호출 위치마다 보안 로그를 남길 것 (누가/언제/왜 실행했는지)
 *     - 가능하면 runWithTenant(t.id, ...) 루프로 대체할 수 있는지 먼저 검토
 *     - 코드 리뷰에서 이 함수 호출은 반드시 검토 대상으로 표시
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [올바른 예시 — 시스템 테이블 접근]
 *
 *   await runWithoutTenant(async () => {
 *     // tenant_id 컬럼이 없는 메타 테이블. 정당한 무-tenant 접근.
 *     return this.featureFlagsService.loadAll();
 *   });
 *
 * [잘못된 패턴 — 게으른 우회]
 *
 *   // ❌ 이렇게 쓰지 마세요.
 *   await runWithoutTenant(async () => {
 *     return this.studentsService.findAll(); // 전 학원 학생 다 나옴
 *   });
 *
 *   // ✅ 올바른 패턴 — 명시적 tenant 루프
 *   for (const t of await tenantRegistry.findAll()) {
 *     await runWithTenant(t.id, () => this.studentsService.cleanup());
 *   }
 *
 * ─────────────────────────────────────────────────────────────
 */
export function runWithoutTenant<T>(fn: () => Promise<T>): Promise<T> {
  return tenantContextStorage.run({ tenantId: null, isSystemAction: true }, fn);
}
