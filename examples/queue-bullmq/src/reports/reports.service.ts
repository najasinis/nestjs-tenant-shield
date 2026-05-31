import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RequireTenant, withTenantPayload } from 'nestjs-tenant-shield';

@Injectable()
@RequireTenant()
export class ReportsService {
  constructor(@InjectQueue('reports') private readonly queue: Queue) {}

  async scheduleMonthlyReport(month: string) {
    const job = await this.queue.add('monthly', withTenantPayload({ month }));
    return { jobId: job.id, month };
  }
}
