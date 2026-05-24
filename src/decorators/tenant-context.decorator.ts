import { TenantContextOptions } from '../interfaces/tenant-context-options.interface';
import { tenantContextStorage } from '../context/tenant-context.storage';
import { MissingTenantContextError } from '../errors/missing-tenant-context.error';

/**
 * ─────────────────────────────────────────────────────────────
 * @TenantContext() — 백그라운드 큐 작업용 tenant 컨텍스트 복원 데코레이터.
 *
 * 동작:
 *   BullMQ/Bull의 @Process 핸들러에 붙이면, job payload에서 tenant ID를
 *   꺼내 AsyncLocalStorage.run()으로 컨텍스트를 만든 채 핸들러를 실행.
 *
 *   결과적으로 HTTP 요청과 동일한 보호망(@RequireTenant, Subscriber 등)이
 *   백그라운드 작업에서도 그대로 동작합니다.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [예시]
 *
 *   @Processor('reports')
 *   export class ReportProcessor {
 *     @Process('monthly')
 *     @TenantContext()                                 // job.data.tenantId 자동 추출
 *     async generateMonthlyReport(job: Job) { ... }
 *
 *     @Process('quarterly')
 *     @TenantContext({ extractFrom: j => j.data.orgId })  // 커스텀 추출
 *     async generateQuarterly(job: Job) { ... }
 *   }
 *
 * ─────────────────────────────────────────────────────────────
 */
export function TenantContext(options: TenantContextOptions = {}): MethodDecorator {
  return function (
    _target: any,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const extract =
      options.extractFrom ?? ((job: any) => job?.data?.tenantId as string);

    descriptor.value = async function (this: any, ...args: unknown[]) {
      // BullMQ는 핸들러 첫 번째 인자로 Job 객체를 넘깁니다.
      const tenantId = extract(args[0]);

      if (!tenantId) {
        return Promise.reject(
          new MissingTenantContextError(
            '@TenantContext: job payload에서 tenant ID를 추출하지 못했습니다. extractFrom 옵션을 확인하세요.',
            'bull',
          ),
        );
      }

      return tenantContextStorage.run({ tenantId, isSystemAction: false }, () =>
        originalMethod.apply(this, args),
      );
    };

    return descriptor;
  };
}
