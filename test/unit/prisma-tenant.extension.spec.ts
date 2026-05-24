import 'reflect-metadata';
import { createTenantAwarePrisma } from '../../src/prisma/prisma-tenant.extension';
import { runWithTenant, runWithoutTenant } from '../../src/context/run-with-tenant';
import { MissingTenantContextError } from '../../src/errors/missing-tenant-context.error';
import { CrossTenantAccessError } from '../../src/errors/cross-tenant-access.error';

/**
 * ─────────────────────────────────────────────────────────────
 * Prisma 어댑터 — createTenantAwarePrisma 동작 검증.
 *
 * 실제 PrismaClient 없이 $extends duck-type mock으로 테스트한다.
 * 검증 시나리오:
 *  1) tenant 컨텍스트 없으면 MissingTenantContextError
 *  2) 시스템 작업(isSystemAction)이면 WHERE 수정 없이 통과
 *  3) READ 작업(findMany 등) — WHERE tenantId 자동 주입
 *  4) WRITE 작업(create/createMany/update/delete/upsert) — 자동 주입
 *  5) findUnique — 결과 사후 검증으로 cross-tenant 차단
 *  6) 집계(count/aggregate) — WHERE 주입, 결과 검증 생략
 *  7) 결과에 다른 tenant row 있으면 CrossTenantAccessError
 *  8) strictMode: false 이면 tenant 없어도 통과
 * ─────────────────────────────────────────────────────────────
 */

const OPTIONS = {
  tenantIdField: 'tenantId',
  strictMode: true as const,
};

/**
 * $extends duck-type mock.
 * 확장 함수에 등록된 $allOperations를 직접 호출할 수 있는 헬퍼(_callOp)를 반환한다.
 */
function makeMockClient(queryFn: jest.Mock) {
  return {
    $extends(extension: any) {
      return {
        _callOp: (operation: string, args: any) =>
          extension.query.$allModels.$allOperations({
            model: 'TestModel',
            operation,
            args,
            query: queryFn,
          }),
      };
    },
  };
}

describe('createTenantAwarePrisma', () => {
  let queryFn: jest.Mock;
  let client: ReturnType<typeof makeMockClient>;
  let extended: { _callOp: (op: string, args: any) => Promise<any> };

  beforeEach(() => {
    queryFn = jest.fn();
    client = makeMockClient(queryFn);
    extended = createTenantAwarePrisma(client, OPTIONS) as any;
  });

  // ─── Case 1 ────────────────────────────────────────────────────────────
  describe('1) tenant 컨텍스트 없음 + strictMode: true', () => {
    it('findMany — MissingTenantContextError', async () => {
      await expect(extended._callOp('findMany', {})).rejects.toBeInstanceOf(
        MissingTenantContextError,
      );
      expect(queryFn).not.toHaveBeenCalled();
    });

    it('create — MissingTenantContextError', async () => {
      await expect(extended._callOp('create', { data: {} })).rejects.toBeInstanceOf(
        MissingTenantContextError,
      );
    });
  });

  // ─── Case 2 ────────────────────────────────────────────────────────────
  describe('2) 시스템 작업(runWithoutTenant) — WHERE 수정 없이 통과', () => {
    it('findMany args 그대로 query 호출', async () => {
      queryFn.mockResolvedValue([]);
      const originalArgs = { where: { name: 'test' } };
      await runWithoutTenant(() => extended._callOp('findMany', originalArgs));
      expect(queryFn).toHaveBeenCalledWith(originalArgs);
    });
  });

  // ─── Case 3 ────────────────────────────────────────────────────────────
  describe('3) READ 작업 — WHERE tenantId 자동 주입', () => {
    it('findMany — where에 tenantId 머지', async () => {
      queryFn.mockResolvedValue([]);
      await runWithTenant('acad-A', () =>
        extended._callOp('findMany', { where: { name: 'kim' } }),
      );
      expect(queryFn).toHaveBeenCalledWith({
        where: { name: 'kim', tenantId: 'acad-A' },
      });
    });

    it('findFirst — where 없어도 tenantId 주입', async () => {
      queryFn.mockResolvedValue(null);
      await runWithTenant('acad-A', () => extended._callOp('findFirst', {}));
      expect(queryFn).toHaveBeenCalledWith({ where: { tenantId: 'acad-A' } });
    });

    it('count — where에 tenantId 머지', async () => {
      queryFn.mockResolvedValue(5);
      await runWithTenant('acad-A', () => extended._callOp('count', {}));
      expect(queryFn).toHaveBeenCalledWith({ where: { tenantId: 'acad-A' } });
    });
  });

  // ─── Case 4 ────────────────────────────────────────────────────────────
  describe('4) WRITE 작업', () => {
    it('create — data에 tenantId 주입', async () => {
      queryFn.mockResolvedValue({ id: 1, tenantId: 'acad-A', name: 'kim' });
      await runWithTenant('acad-A', () =>
        extended._callOp('create', { data: { name: 'kim' } }),
      );
      expect(queryFn).toHaveBeenCalledWith({ data: { name: 'kim', tenantId: 'acad-A' } });
    });

    it('createMany — data 배열 각 항목에 tenantId 주입', async () => {
      queryFn.mockResolvedValue({ count: 2 });
      await runWithTenant('acad-A', () =>
        extended._callOp('createMany', {
          data: [{ name: 'kim' }, { name: 'lee' }],
        }),
      );
      expect(queryFn).toHaveBeenCalledWith({
        data: [
          { name: 'kim', tenantId: 'acad-A' },
          { name: 'lee', tenantId: 'acad-A' },
        ],
      });
    });

    it('update — where에 tenantId 주입', async () => {
      queryFn.mockResolvedValue({ id: 1, tenantId: 'acad-A' });
      await runWithTenant('acad-A', () =>
        extended._callOp('update', { where: { id: 1 }, data: { name: 'park' } }),
      );
      expect(queryFn).toHaveBeenCalledWith({
        where: { id: 1, tenantId: 'acad-A' },
        data: { name: 'park' },
      });
    });

    it('delete — where에 tenantId 주입', async () => {
      queryFn.mockResolvedValue({ id: 1, tenantId: 'acad-A' });
      await runWithTenant('acad-A', () =>
        extended._callOp('delete', { where: { id: 1 } }),
      );
      expect(queryFn).toHaveBeenCalledWith({ where: { id: 1, tenantId: 'acad-A' } });
    });

    it('upsert — where + create 양쪽에 tenantId 주입', async () => {
      queryFn.mockResolvedValue({ id: 1, tenantId: 'acad-A' });
      await runWithTenant('acad-A', () =>
        extended._callOp('upsert', {
          where: { id: 1 },
          create: { name: 'kim' },
          update: { name: 'kim' },
        }),
      );
      expect(queryFn).toHaveBeenCalledWith({
        where: { id: 1, tenantId: 'acad-A' },
        create: { name: 'kim', tenantId: 'acad-A' },
        update: { name: 'kim' },
      });
    });
  });

  // ─── Case 5 ────────────────────────────────────────────────────────────
  describe('5) findUnique — 결과 사후 검증', () => {
    it('결과 tenantId가 다르면 CrossTenantAccessError', async () => {
      queryFn.mockResolvedValue({ id: 99, tenantId: 'acad-B' });
      await expect(
        runWithTenant('acad-A', () =>
          extended._callOp('findUnique', { where: { id: 99 } }),
        ),
      ).rejects.toBeInstanceOf(CrossTenantAccessError);
    });

    it('결과 tenantId가 같으면 정상 반환', async () => {
      const row = { id: 1, tenantId: 'acad-A', name: 'kim' };
      queryFn.mockResolvedValue(row);
      const result = await runWithTenant('acad-A', () =>
        extended._callOp('findUnique', { where: { id: 1 } }),
      );
      expect(result).toEqual(row);
    });

    it('결과 null이면 CrossTenantAccessError 없음', async () => {
      queryFn.mockResolvedValue(null);
      const result = await runWithTenant('acad-A', () =>
        extended._callOp('findUnique', { where: { id: 999 } }),
      );
      expect(result).toBeNull();
    });
  });

  // ─── Case 6 ────────────────────────────────────────────────────────────
  describe('6) 집계(count/aggregate) — WHERE 주입하되 결과 검증 생략', () => {
    it('count — 숫자 결과에 CrossTenantAccessError 안 던짐', async () => {
      queryFn.mockResolvedValue(42);
      const result = await runWithTenant('acad-A', () =>
        extended._callOp('count', {}),
      );
      expect(result).toBe(42);
    });

    it('aggregate — 집계 객체 결과에 CrossTenantAccessError 안 던짐', async () => {
      queryFn.mockResolvedValue({ _count: { id: 10 }, _avg: { grade: 85 } });
      const result = await runWithTenant('acad-A', () =>
        extended._callOp('aggregate', {}),
      );
      expect(result).toMatchObject({ _count: { id: 10 } });
    });
  });

  // ─── Case 7 ────────────────────────────────────────────────────────────
  describe('7) 결과에 다른 tenant row — CrossTenantAccessError', () => {
    it('findMany 결과 배열에 타 tenant row 있으면 throw', async () => {
      queryFn.mockResolvedValue([
        { id: 1, tenantId: 'acad-A' },
        { id: 2, tenantId: 'acad-B' },
      ]);
      await expect(
        runWithTenant('acad-A', () => extended._callOp('findMany', {})),
      ).rejects.toBeInstanceOf(CrossTenantAccessError);
    });

    it('findFirst 단건 결과가 타 tenant면 throw', async () => {
      queryFn.mockResolvedValue({ id: 5, tenantId: 'acad-B' });
      await expect(
        runWithTenant('acad-A', () => extended._callOp('findFirst', {})),
      ).rejects.toBeInstanceOf(CrossTenantAccessError);
    });
  });

  // ─── Case 8 ────────────────────────────────────────────────────────────
  describe('8) strictMode: false — tenant 없어도 통과', () => {
    it('findMany — query 그대로 호출됨', async () => {
      const lenientClient = makeMockClient(queryFn);
      const lenient = createTenantAwarePrisma(lenientClient, {
        tenantIdField: 'tenantId',
        strictMode: false,
      }) as any;
      queryFn.mockResolvedValue([]);
      await lenient._callOp('findMany', { where: {} });
      expect(queryFn).toHaveBeenCalledWith({ where: {} });
    });
  });
});
