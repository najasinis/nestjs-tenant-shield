import {
  getCurrentTenantId,
  runWithTenant,
  runWithoutTenant,
} from '../../src/context';

/**
 * ─────────────────────────────────────────────────────────────
 * AsyncLocalStorage 기반 컨텍스트의 핵심 동작 검증.
 *
 * 검증 포인트:
 *  - 컨텍스트 외부에서는 null
 *  - runWithTenant 내부에서는 해당 tenant
 *  - 중첩 호출 시 안쪽 컨텍스트가 우선
 *  - 비동기 체인을 거쳐도 컨텍스트가 유지
 *  - 동시 실행(병렬 Promise) 컨텍스트가 안 섞임 — 가장 중요한 안전성
 * ─────────────────────────────────────────────────────────────
 */
describe('TenantContext (AsyncLocalStorage)', () => {
  it('컨텍스트 외부에서는 null을 반환해야 한다', () => {
    expect(getCurrentTenantId()).toBeNull();
  });

  it('runWithTenant 내부에서 tenant ID를 반환해야 한다', async () => {
    // TODO: 구현 후 실제 검증
    await runWithTenant('academy-A', async () => {
      expect(getCurrentTenantId()).toBe('academy-A');
    });
  });

  it('중첩 호출에서 안쪽 tenant가 우선되어야 한다', async () => {
    await runWithTenant('academy-A', async () => {
      await runWithTenant('academy-B', async () => {
        expect(getCurrentTenantId()).toBe('academy-B');
      });
      // 다시 바깥 컨텍스트로 복귀
      expect(getCurrentTenantId()).toBe('academy-A');
    });
  });

  it('비동기 체인을 거쳐도 컨텍스트가 유지되어야 한다', async () => {
    await runWithTenant('academy-A', async () => {
      await delay(10);
      await Promise.resolve();
      expect(getCurrentTenantId()).toBe('academy-A');
    });
  });

  it('병렬 실행 시 컨텍스트가 서로 섞이지 않아야 한다 (격리 안전성)', async () => {
    // 두 비동기 흐름을 동시에 시작해도 각자의 tenant만 보여야 함.
    // 이게 깨지면 멀티테넌시의 근간이 무너지므로 반드시 통과해야 하는 테스트.
    const results = await Promise.all([
      runWithTenant('academy-A', async () => {
        await delay(20);
        return getCurrentTenantId();
      }),
      runWithTenant('academy-B', async () => {
        await delay(10);
        return getCurrentTenantId();
      }),
    ]);
    expect(results).toEqual(['academy-A', 'academy-B']);
  });

  it('runWithoutTenant 내부에서는 tenantId가 null이고 시스템 작업 플래그가 켜져 있어야 한다', async () => {
    // TODO: isSystemAction 플래그를 확인하는 helper 추가 후 활성화
    await runWithoutTenant(async () => {
      expect(getCurrentTenantId()).toBeNull();
    });
  });
});

/** 비동기 흐름 시뮬레이션용 유틸. */
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
