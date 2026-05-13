import { tenantContextStorage } from '../context/tenant-context.storage';

/**
 * ─────────────────────────────────────────────────────────────
 * 라이브러리 사용자가 테스트 코드에서 쓰는 헬퍼 모음.
 *
 * 핵심 철학:
 *   "다른 tenant의 데이터를 실수로 만지는 일을, 테스트 단계에서부터
 *    절대 일어나지 않게 강제한다."
 *
 * runWithTenant / runWithoutTenant 는 이미 src/context/에 정의되어 있고
 * 여기서는 그대로 재-export 합니다 (사용자 import 경로 통일).
 *
 * 추가로 테스트 전용 헬퍼:
 *  - expectCurrentTenant   : 현재 컨텍스트의 tenant ID 단정
 *  - clearTenantContext    : 테스트 간 컨텍스트 강제 초기화 (특수 케이스)
 *  - mockTenantContext     : 동기적으로 컨텍스트만 깔아두기
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [기본 사용 패턴]
 *
 *   describe('StudentsService', () => {
 *     it('A 학원 컨텍스트에서는 A 학생만 조회', async () => {
 *       await runWithTenant('academy-A', async () => {
 *         const students = await service.findAll();
 *         expect(students.every(s => s.tenantId === 'academy-A')).toBe(true);
 *       });
 *     });
 *
 *     it('컨텍스트 없이 호출하면 throw', async () => {
 *       await expect(service.findAll()).rejects.toThrow(MissingTenantContextError);
 *     });
 *   });
 *
 * ─────────────────────────────────────────────────────────────
 */

// runWithTenant / runWithoutTenant 는 'nestjs-tenant-shield'의 메인 진입점
// (src/context를 통해 자동 export) 에서 그대로 가져다 쓰면 됩니다.
// 여기서 또 export 하면 중복 export 충돌이 발생하므로 제외했습니다.

/**
 * 현재 AsyncLocalStorage에 깔린 tenant ID가 예상과 같은지 단정.
 *
 * Jest assertion API와 호환되도록 throw 기반으로 작성.
 * (expect(...).toBe 대신 직접 던지는 이유 — Jest matcher import 없이 동작)
 */
export function expectCurrentTenant(expected: string | null): void {
  const actual = tenantContextStorage.getStore()?.tenantId ?? null;
  if (actual !== expected) {
    throw new Error(
      `expectCurrentTenant: expected "${expected}" but got "${actual}". ` +
        '테스트 셋업의 runWithTenant 호출 위치를 확인하세요.',
    );
  }
}

/**
 * 동기적으로 임시 tenant 컨텍스트를 깔고 콜백을 실행.
 *
 * 비동기 콜백을 쓸 수 없는 특수한 동기 헬퍼/유틸을 테스트할 때만 사용.
 * 일반 케이스는 항상 runWithTenant(비동기 버전)를 우선 사용하세요.
 */
export function mockTenantContext<T>(tenantId: string, fn: () => T): T {
  return tenantContextStorage.run({ tenantId, isSystemAction: false }, fn);
}
