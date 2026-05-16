import { TenantContextOptions } from '../interfaces/tenant-context-options.interface';
import { tenantContextStorage } from '../context/tenant-context.storage';

/**
 * ─────────────────────────────────────────────────────────────
 * @TenantContext() — 백그라운드 큐 작업용 tenant 컨텍스트 복원 데코레이터.
 *
 * ⚠️ v0.2 정식 출시 예정. v0.1 스켈레톤만 존재.
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

    // 추출 함수 — 미지정 시 job.data.tenantId 기본 사용.
    const extract =
      options.extractFrom ?? ((job: any) => job?.data?.tenantId as string);

    descriptor.value = async function (this: any, ...args: unknown[]) {
      // BullMQ는 핸들러 첫 번째 인자로 Job 객체를 넘깁니다.
      const job = args[0];
      const tenantId = extract(job);

      if (!tenantId) {
        // 추출 실패 — payload 구조를 점검하라는 명확한 에러로.
        throw new Error(
          '@TenantContext: job payload에서 tenant ID를 추출하지 못했습니다. extractFrom 옵션을 확인하세요.',
        );
      }

      // 컨텍스트를 새로 만들어서 원본 핸들러 실행.
      return tenantContextStorage.run({ tenantId, isSystemAction: false }, () =>
        originalMethod.apply(this, args),
      );
    };

    return descriptor;
  };
}
