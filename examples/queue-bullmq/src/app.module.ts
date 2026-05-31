import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TenantShieldModule } from 'nestjs-tenant-shield';
import { ReportsService } from './reports/reports.service';
import { ReportProcessor } from './reports/report.processor';
import { ReportsController } from './reports/reports.controller';

@Module({
  imports: [
    TenantShieldModule.forRoot({
      strategy: 'discriminator',
      tenantIdField: 'tenantId',
      tenantSource: 'header',
      headerName: 'x-tenant-id',
      strictMode: true,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    BullModule.registerQueue({ name: 'reports' }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportProcessor],
})
export class AppModule {}
