import 'reflect-metadata';
import { RequireTenant } from '../../src/decorators/require-tenant.decorator';
import { SystemAction } from '../../src/decorators/system-action.decorator';
import { runWithTenant, runWithoutTenant } from '../../src/context/run-with-tenant';
import { MissingTenantContextError } from '../../src/errors/missing-tenant-context.error';

/**
 * ─────────────────────────────────────────────────────────────
 * @RequireTenant() 데코레이터 동작 검증.
 *
 * 검증할 시나리오:
 *  1) 컨텍스트 없으면 throw (strict mode 기본 동작)
 *  2) 컨텍스트 있으면 정상 실행
 *  3) 클래스 레벨 적용 시 모든 메서드가 보호됨
 *  4) @SystemAction이 붙은 메서드는 클래스 레벨 보호에서도 통과
 *  5) options.allowSystem: true면 컨텍스트 없어도 통과
 * ─────────────────────────────────────────────────────────────
 */
describe('@RequireTenant()', () => {
  // ─── 메서드 레벨 ───────────────────────────────
  describe('메서드 데코레이터', () => {
    class SampleService {
      @RequireTenant()
      async findAll() {
        return 'ok';
      }
    }

    it('컨텍스트 없이 호출하면 MissingTenantContextError를 throw', async () => {
      const svc = new SampleService();
      await expect(svc.findAll()).rejects.toBeInstanceOf(MissingTenantContextError);
    });

    it('컨텍스트가 있으면 원본 메서드를 정상 실행', async () => {
      const svc = new SampleService();
      const result = await runWithTenant('A', () => svc.findAll());
      expect(result).toBe('ok');
    });
  });

  // ─── 클래스 레벨 ───────────────────────────────
  describe('클래스 데코레이터', () => {
    @RequireTenant()
    class WholeClassService {
      async one() {
        return 1;
      }
      async two() {
        return 2;
      }

      // 의도적으로 보호 제외
      @SystemAction()
      async maintenance() {
        return 'system';
      }
    }

    it('모든 일반 메서드가 컨텍스트 없으면 throw', async () => {
      const svc = new WholeClassService();
      await expect(svc.one()).rejects.toBeInstanceOf(MissingTenantContextError);
      await expect(svc.two()).rejects.toBeInstanceOf(MissingTenantContextError);
    });

    it('@SystemAction이 붙은 메서드는 컨텍스트 없이도 동작', async () => {
      const svc = new WholeClassService();
      // 클래스 레벨 보호의 자동 wrapping에서 제외되어야 함.
      await expect(runWithoutTenant(() => svc.maintenance())).resolves.toBe('system');
    });
  });

  // ─── allowSystem 옵션 ─────────────────────────
  describe('옵션 allowSystem: true', () => {
    class FlexibleService {
      @RequireTenant({ allowSystem: true })
      async something() {
        return 'done';
      }
    }

    it('컨텍스트 없이 호출해도 throw하지 않음', async () => {
      const svc = new FlexibleService();
      await expect(svc.something()).resolves.toBe('done');
    });
  });
});
