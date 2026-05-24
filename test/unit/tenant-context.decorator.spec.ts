import 'reflect-metadata';
import { TenantContext } from '../../src/decorators/tenant-context.decorator';
import { withTenantPayload } from '../../src/bull/with-tenant-payload';
import { runWithTenant, runWithoutTenant } from '../../src/context/run-with-tenant';
import { getCurrentTenantId } from '../../src/context/get-current-tenant-id';
import { MissingTenantContextError } from '../../src/errors/missing-tenant-context.error';

/**
 * ─────────────────────────────────────────────────────────────
 * @TenantContext() + withTenantPayload() 동작 검증.
 *
 * 시나리오:
 *  1) job.data.tenantId → ALS 컨텍스트 자동 복원
 *  2) tenantId 없는 job → MissingTenantContextError
 *  3) 커스텀 extractFrom 옵션
 *  4) 핸들러 내부에서 getCurrentTenantId() 정상 반환
 *  5) withTenantPayload — tenantId 자동 첨부
 *  6) withTenantPayload — 컨텍스트 없으면 MissingTenantContextError
 * ─────────────────────────────────────────────────────────────
 */

class MockProcessor {
  @TenantContext()
  async process(_job: any): Promise<string | null> {
    return getCurrentTenantId();
  }

  @TenantContext({ extractFrom: (j: any) => j.data.orgId })
  async processWithCustomExtractor(_job: any): Promise<string | null> {
    return getCurrentTenantId();
  }
}

describe('@TenantContext()', () => {
  let proc: MockProcessor;

  beforeEach(() => {
    proc = new MockProcessor();
  });

  describe('1) job.data.tenantId → ALS 컨텍스트 복원', () => {
    it('정상 job → 핸들러 실행 완료', async () => {
      const result = await proc.process({ data: { tenantId: 'acad-A' } });
      expect(result).toBe('acad-A');
    });

    it('핸들러 반환값 그대로 전달', async () => {
      const result = await proc.process({ data: { tenantId: 'acad-B' } });
      expect(result).toBe('acad-B');
    });
  });

  describe('2) tenantId 없는 job → MissingTenantContextError', () => {
    it('job.data.tenantId 없으면 throw', async () => {
      await expect(proc.process({ data: {} })).rejects.toBeInstanceOf(
        MissingTenantContextError,
      );
    });

    it('job.data 자체가 없으면 throw', async () => {
      await expect(proc.process({})).rejects.toBeInstanceOf(MissingTenantContextError);
    });

    it('job 자체가 undefined이면 throw', async () => {
      await expect(proc.process(undefined)).rejects.toBeInstanceOf(MissingTenantContextError);
    });
  });

  describe('3) 커스텀 extractFrom 옵션', () => {
    it('job.data.orgId 추출 → 컨텍스트 복원', async () => {
      const result = await proc.processWithCustomExtractor({ data: { orgId: 'org-X' } });
      expect(result).toBe('org-X');
    });

    it('커스텀 필드 없으면 throw', async () => {
      await expect(
        proc.processWithCustomExtractor({ data: { tenantId: 'acad-A' } }),
      ).rejects.toBeInstanceOf(MissingTenantContextError);
    });
  });

  describe('4) 핸들러 내부에서 getCurrentTenantId()', () => {
    it('중첩 호출에서도 올바른 tenantId 반환', async () => {
      let innerTenantId: string | null = null;

      class InnerProc {
        @TenantContext()
        async run(_job: any): Promise<void> {
          innerTenantId = getCurrentTenantId();
        }
      }

      const p = new InnerProc();
      await p.run({ data: { tenantId: 'inner-tenant' } });
      expect(innerTenantId).toBe('inner-tenant');
    });

    it('@TenantContext 컨텍스트는 핸들러 바깥에 누출되지 않는다', async () => {
      await proc.process({ data: { tenantId: 'acad-A' } });
      // 핸들러 종료 후 컨텍스트 없음 (ALS 스코프 종료)
      expect(getCurrentTenantId()).toBeNull();
    });
  });
});

describe('withTenantPayload()', () => {
  describe('5) tenantId 자동 첨부', () => {
    it('현재 tenant 컨텍스트의 tenantId를 payload에 추가', async () => {
      const result = await runWithTenant('acad-A', async () =>
        withTenantPayload({ month: '2026-05' }),
      );
      expect(result).toEqual({ month: '2026-05', tenantId: 'acad-A' });
    });

    it('원본 data 객체는 변경하지 않는다 (immutable)', async () => {
      const original = { key: 'value' };
      await runWithTenant('acad-A', async () => {
        withTenantPayload(original);
      });
      expect(original).not.toHaveProperty('tenantId');
    });

    it('data에 이미 다른 필드가 있어도 머지됨', async () => {
      const result = await runWithTenant('acad-A', async () =>
        withTenantPayload({ userId: 42, action: 'report' }),
      );
      expect(result).toEqual({ userId: 42, action: 'report', tenantId: 'acad-A' });
    });
  });

  describe('6) 컨텍스트 없으면 MissingTenantContextError', () => {
    it('tenant 컨텍스트 없으면 throw', () => {
      expect(() => withTenantPayload({ key: 'val' })).toThrow(MissingTenantContextError);
    });

    it('runWithoutTenant 안에서도 throw', async () => {
      await runWithoutTenant(async () => {
        expect(() => withTenantPayload({ key: 'val' })).toThrow(MissingTenantContextError);
      });
    });

    it('에러 source가 "bull"', () => {
      try {
        withTenantPayload({ key: 'val' });
      } catch (e) {
        expect(e).toBeInstanceOf(MissingTenantContextError);
        expect((e as MissingTenantContextError).source).toBe('bull');
      }
    });
  });
});
