import 'reflect-metadata';
import { getCurrentTenantId } from '../../src/context/get-current-tenant-id';
import { runWithTenant, runWithoutTenant } from '../../src/context/run-with-tenant';

/**
 * ─────────────────────────────────────────────────────────────
 * AsyncLocalStorage 컨텍스트 동작 단위 테스트.
 *
 * 이 테스트는 라이브러리의 "심장"인 컨텍스트 메커니즘이 다음 시나리오에서
 * 정확히 동작하는지 검증합니다:
 *
 *  1) runWithTenant 안에서는 getCurrentTenantId가 올바른 값을 돌려준다
 *  2) 중첩된 runWithTenant는 내부 컨텍스트가 외부를 덮어쓴다 (요청 안 큐 처리 등)
 *  3) 동시 실행되는 두 비동기 흐름이 서로의 컨텍스트를 침범하지 않는다
 *  4) runWithoutTenant는 tenantId=null, isSystemAction=true로 진입
 *
 * 모든 검증은 sudo-test 형태 — 실제 expect 호출 위치만 남기고 로직은 정의.
 * ─────────────────────────────────────────────────────────────
 */
describe('TenantContextStorage', () => {
  // ─────────────────────────────────────────────
  // 시나리오 1
  // ─────────────────────────────────────────────
  it('runWithTenant 콜백 내부에서 getCurrentTenantId는 해당 tenant를 반환한다', async () => {
    // GIVEN: runWithTenant('academy-A', ...)로 진입
    // WHEN: 콜백 안에서 getCurrentTenantId() 호출
    // THEN: 'academy-A' 반환

    // TODO: 실제 단언 작성
    await runWithTenant('academy-A', async () => {
      const result = getCurrentTenantId();
      expect(result).toBe('academy-A');
    });
  });

  // ─────────────────────────────────────────────
  // 시나리오 2 — 중첩 (동기 코드의 stack과 동일하게 동작해야 함)
  // ─────────────────────────────────────────────
  it('중첩 runWithTenant 시 내부 컨텍스트가 우선한다', async () => {
    // GIVEN: 외부 'A', 내부 'B'
    // WHEN: 내부 콜백에서 getCurrentTenantId()
    // THEN: 'B'
    // AND : 내부 콜백 종료 후 외부에서 getCurrentTenantId() === 'A'

    // TODO: 단언 작성
    await runWithTenant('A', async () => {
      await runWithTenant('B', async () => {
        expect(getCurrentTenantId()).toBe('B');
      });
      expect(getCurrentTenantId()).toBe('A');
    });
  });

  // ─────────────────────────────────────────────
  // 시나리오 3 — 동시성 (이게 깨지면 라이브러리 존재 가치 X)
  // ─────────────────────────────────────────────
  it('동시 실행되는 두 흐름의 컨텍스트는 서로 침범하지 않는다', async () => {
    // GIVEN: A와 B를 Promise.all로 동시 실행
    // WHEN: 각 흐름이 getCurrentTenantId 여러 번 호출
    // THEN: A 흐름은 항상 'A', B 흐름은 항상 'B'

    // TODO: 단언 작성 — 흐름마다 setTimeout/Promise를 섞어 비동기 끼어듦 시뮬레이션
    const promiseA = runWithTenant('A', async () => {
      await new Promise((r) => setTimeout(r, 10));
      return getCurrentTenantId();
    });
    const promiseB = runWithTenant('B', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return getCurrentTenantId();
    });

    const [a, b] = await Promise.all([promiseA, promiseB]);
    expect(a).toBe('A');
    expect(b).toBe('B');
  });

  // ─────────────────────────────────────────────
  // 시나리오 4
  // ─────────────────────────────────────────────
  it('runWithoutTenant 안에서 getCurrentTenantId는 null을 반환한다', async () => {
    // TODO: 단언 작성. isSystemAction 플래그 검증은 Subscriber 테스트에서.
    await runWithoutTenant(async () => {
      expect(getCurrentTenantId()).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // 시나리오 5 — 컨텍스트 미설정
  // ─────────────────────────────────────────────
  it('아무 컨텍스트도 없으면 getCurrentTenantId는 null을 반환한다 (throw 금지)', () => {
    // getCurrentTenantId는 절대 throw하지 않는 게 계약.
    expect(getCurrentTenantId()).toBeNull();
  });
});
