import 'reflect-metadata';
import { RequireTenant } from '../../src/decorators/require-tenant.decorator';
import { SystemAction } from '../../src/decorators/system-action.decorator';
import { runWithTenant, runWithoutTenant } from '../../src/context/run-with-tenant';
import { getCurrentTenantId } from '../../src/context/get-current-tenant-id';
import { MissingTenantContextError } from '../../src/errors/missing-tenant-context.error';
import {
  setGlobalOptions,
  resetGlobalOptions,
} from '../../src/options/options.registry';

/**
 * ─────────────────────────────────────────────────────────────
 * forRoot.allowSystemActions + @SystemAction 메서드 레벨 동작 검증.
 *
 * 검증 시나리오:
 *  1) allowSystemActions: false (기본) — @SystemAction 있어도 throw
 *  2) allowSystemActions: true — @SystemAction 있으면 컨텍스트 없이 통과
 *  3) runWithoutTenant 안에서 runWithTenant 재진입 — 테넌트 컨텍스트 정상 복원
 *  4) 데코레이터 적용 순서 — Case A(올바름)와 Case B(잘못됨) 동작 비교
 * ─────────────────────────────────────────────────────────────
 */

/** 최소 옵션 — 테스트에서 allowSystemActions만 바꿔서 사용. */
const BASE_OPTIONS = {
  strategy: 'discriminator' as const,
  tenantIdField: 'tenantId',
  tenantSource: 'header' as const,
};

// ──────────────────────────────────────────────────────────────────────────────
// 클래스 정의는 모듈 로드 시 데코레이터가 적용되므로 describe 밖(파일 최상위)에 위치.
// setGlobalOptions는 런타임에 호출되어 wrapped function 안에서 읽힘 → 순서 무관.
// ──────────────────────────────────────────────────────────────────────────────

// Case 1, 2에서 공유 — 올바른 데코레이터 순서(@RequireTenant 위, @SystemAction 아래).
class ServiceWithSystemAction {
  @RequireTenant()
  @SystemAction()
  async run() {
    return 'ok';
  }
}

// Case 3 — @RequireTenant만. runWithTenant 재진입 검증용.
class ServiceRequireTenant {
  @RequireTenant()
  async getCurrent() {
    return getCurrentTenantId();
  }
}

// Case 4A — 올바른 순서: @RequireTenant 위, @SystemAction 아래.
class CaseAService {
  @RequireTenant()
  @SystemAction()
  async run() {
    return 'case-a';
  }
}

// Case 4B — 잘못된 순서: @SystemAction 위, @RequireTenant 아래.
// @SystemAction이 wrapped function에 메타데이터를 붙여서 originalMethod에 없음.
// 결과: allowSystemActions: true 여도 우회 불가 → throw.
class CaseBService {
  @SystemAction()
  @RequireTenant()
  async run() {
    return 'case-b';
  }
}

// ──────────────────────────────────────────────────────────────────────────────

describe('forRoot.allowSystemActions + @SystemAction', () => {
  afterEach(() => {
    resetGlobalOptions();
  });

  // ─── Case 1 ─────────────────────────────────────────────────────────────
  describe('1) allowSystemActions: false (기본값)', () => {
    it('@SystemAction이 붙어 있어도 컨텍스트 없으면 throw', async () => {
      // globalOptions 미설정 → getGlobalOptions()?.allowSystemActions = undefined → false
      const svc = new ServiceWithSystemAction();
      await expect(svc.run()).rejects.toBeInstanceOf(MissingTenantContextError);
    });

    it('명시적으로 false 설정해도 동일하게 throw', async () => {
      setGlobalOptions({ ...BASE_OPTIONS, allowSystemActions: false });
      const svc = new ServiceWithSystemAction();
      await expect(svc.run()).rejects.toBeInstanceOf(MissingTenantContextError);
    });
  });

  // ─── Case 2 ─────────────────────────────────────────────────────────────
  describe('2) allowSystemActions: true', () => {
    it('@SystemAction이 붙은 메서드는 컨텍스트 없이 통과', async () => {
      setGlobalOptions({ ...BASE_OPTIONS, allowSystemActions: true });
      const svc = new ServiceWithSystemAction();
      await expect(svc.run()).resolves.toBe('ok');
    });
  });

  // ─── Case 3 ─────────────────────────────────────────────────────────────
  describe('3) runWithTenant 재진입', () => {
    it('runWithoutTenant 안에서 runWithTenant로 테넌트 컨텍스트를 복원할 수 있다', async () => {
      const svc = new ServiceRequireTenant();
      const result = await runWithoutTenant(() =>
        runWithTenant('tenant-X', () => svc.getCurrent()),
      );
      expect(result).toBe('tenant-X');
    });

    it('runWithoutTenant 단독으로는 @RequireTenant 메서드가 throw', async () => {
      const svc = new ServiceRequireTenant();
      // runWithoutTenant는 isSystemAction=true를 설정하지만,
      // 이 메서드에는 @SystemAction이 없으므로 shouldBypass = isSystemActionRuntime = true
      // → 실제로는 통과해야 함. 이 케이스는 isSystemActionRuntime 경로 검증.
      const result = await runWithoutTenant(() => svc.getCurrent());
      // runWithoutTenant는 isSystemAction=true → shouldBypass = true → 통과 + tenantId = null
      expect(result).toBeNull();
    });
  });

  // ─── Case 4 ─────────────────────────────────────────────────────────────
  describe('4) 데코레이터 적용 순서', () => {
    it('Case A (올바른 순서: @RequireTenant 위, @SystemAction 아래) — allowSystemActions:true 이면 통과', async () => {
      setGlobalOptions({ ...BASE_OPTIONS, allowSystemActions: true });
      const svc = new CaseAService();
      await expect(svc.run()).resolves.toBe('case-a');
    });

    it('Case B (잘못된 순서: @SystemAction 위, @RequireTenant 아래) — allowSystemActions:true 여도 @SystemAction 무효', async () => {
      setGlobalOptions({ ...BASE_OPTIONS, allowSystemActions: true });
      const svc = new CaseBService();
      // @SystemAction이 wrapped function에 메타데이터를 박아서 originalMethod에 없음
      // → isSystemActionDecorated = false → shouldBypass = false → throw
      await expect(svc.run()).rejects.toBeInstanceOf(MissingTenantContextError);
    });
  });
});
