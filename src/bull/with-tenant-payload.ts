import { getCurrentTenantId } from '../context/get-current-tenant-id';
import { MissingTenantContextError } from '../errors/missing-tenant-context.error';

/**
 * BullMQ job을 enqueue할 때 현재 tenant 컨텍스트의 tenantId를 payload에 자동 첨부.
 *
 * HTTP 요청 처리 중(또는 runWithTenant() 안)에서 호출해야 합니다.
 * tenant 컨텍스트가 없으면 MissingTenantContextError를 throw합니다 (Fail-Loud).
 *
 * @example
 *   // StudentsService (HTTP 요청 컨텍스트 안)
 *   await reportQueue.add('monthly', withTenantPayload({ month: '2026-05' }));
 *   // → job.data = { month: '2026-05', tenantId: 'academy-A' }
 *
 *   // Processor에서
 *   @TenantContext()                     // job.data.tenantId → ALS 컨텍스트 자동 복원
 *   async process(job: Job) {
 *     await studentsService.findAll();  // WHERE tenantId = 'academy-A' 자동 주입
 *   }
 */
export function withTenantPayload<T extends object>(data: T): T & { tenantId: string } {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new MissingTenantContextError(
      'withTenantPayload: job을 enqueue하는 시점에 tenant 컨텍스트가 없습니다. ' +
        'HTTP 요청 컨텍스트 또는 runWithTenant() 안에서 호출하세요.',
      'bull',
    );
  }
  return { ...data, tenantId };
}
