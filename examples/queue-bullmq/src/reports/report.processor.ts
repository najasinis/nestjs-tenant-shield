import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TenantContext, getCurrentTenantId } from 'nestjs-tenant-shield';

@Processor('reports')
export class ReportProcessor extends WorkerHost {
  @TenantContext()
  async process(job: Job<{ month: string; tenantId: string }>) {
    const tenantId = getCurrentTenantId();
    console.log(`[${tenantId}] Generating report for month: ${job.data.month}`);
    // 이 안에서 모든 ORM 쿼리에 WHERE tenantId = ? 자동 주입
    return { tenantId, month: job.data.month, generated: true };
  }
}
