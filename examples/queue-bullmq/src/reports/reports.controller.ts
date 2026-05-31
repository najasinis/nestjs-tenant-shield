import { Controller, Post, Body } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('schedule')
  schedule(@Body() body: { month: string }) {
    return this.reportsService.scheduleMonthlyReport(body.month);
  }
}
