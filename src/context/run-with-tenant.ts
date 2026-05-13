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
 * ⚠️ 모든 tenant의 데이터를 만질 수 있으므로 신중하게 사용.
 *    가능한 한 runWithTenant() 루프로 대체하세요.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [예시]
 *
 *   await runWithoutTenant(async () => {
 *     // tenant_id 컬럼이 없는 시스템 테이블에 접근하거나,
 *     // 다른 tenant들 전체를 한 번에 다루는 작업.
 *     await this.systemMaintenance.runFullSweep();
 *   });
 *
 * ─────────────────────────────────────────────────────────────
 */
export function runWithoutTenant<T>(fn: () => Promise<T>): Promise<T> {
  return tenantContextStorage.run({ tenantId: null, isSystemAction: true }, fn);
}
