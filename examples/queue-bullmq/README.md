# BullMQ + nestjs-tenant-shield 통합 예제

`@TenantContext()`와 `withTenantPayload()`를 사용해 BullMQ 큐 작업에 tenant 격리를 적용하는 패턴 가이드.

## 핵심 패턴

### 1. Enqueue — `withTenantPayload()`

HTTP 요청 처리 중에 job을 enqueue할 때, 현재 tenant 컨텍스트를 payload에 자동으로 첨부합니다.

```typescript
import { withTenantPayload } from 'nestjs-tenant-shield';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
@RequireTenant()
export class ReportsService {
  constructor(@InjectQueue('reports') private readonly queue: Queue) {}

  async scheduleMonthlyReport(month: string) {
    // withTenantPayload가 현재 tenant('academy-A' 등)를 payload에 자동 주입
    await this.queue.add('monthly', withTenantPayload({ month }));
    // → job.data = { month: '2026-05', tenantId: 'academy-A' }
  }
}
```

### 2. Processor — `@TenantContext()`

Processor에서 `@TenantContext()`를 붙이면 `job.data.tenantId`를 ALS 컨텍스트로 자동 복원합니다.
이후 `@RequireTenant()`, TypeORM Subscriber, Prisma extension 등 모든 격리 보호가 HTTP 요청과 동일하게 동작합니다.

```typescript
import { TenantContext } from 'nestjs-tenant-shield';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('reports')
export class ReportProcessor extends WorkerHost {
  constructor(private readonly studentsService: StudentsService) {
    super();
  }

  @TenantContext()  // job.data.tenantId → ALS 컨텍스트 자동 복원
  async process(job: Job<{ month: string; tenantId: string }>) {
    // 이 안에서 getCurrentTenantId() === job.data.tenantId
    // 모든 ORM 쿼리에 WHERE tenantId 자동 주입
    const students = await this.studentsService.findAll();
    console.log(`[${job.data.tenantId}] ${students.length}명 리포트 생성`);
  }
}
```

### 3. 커스텀 tenantId 필드

payload의 필드명이 `tenantId`가 아닌 경우:

```typescript
@TenantContext({ extractFrom: (job) => job.data.organizationId })
async process(job: Job) { ... }
```

### 4. 수동 tenantId 첨부 (대안)

`withTenantPayload()` 없이 수동으로 첨부해도 됩니다:

```typescript
await queue.add('task', {
  tenantId: getCurrentTenantId()!,
  payload: { ... },
});
```

## 전체 모듈 설정 예시

```typescript
// app.module.ts
@Module({
  imports: [
    TenantShieldModule.forRoot({
      strategy: 'discriminator',
      tenantIdField: 'tenantId',
      tenantSource: 'header',
      headerName: 'x-tenant-id',
    }),
    BullModule.forRoot({ connection: { host: 'localhost', port: 6379 } }),
    BullModule.registerQueue({ name: 'reports' }),
  ],
  providers: [ReportsService, ReportProcessor],
})
export class AppModule {}
```

## 보안 주의사항

- `@TenantContext()` 없이 processor를 실행하면 `getCurrentTenantId()` → null → `strictMode: true`에서 `MissingTenantContextError`
- `withTenantPayload()`는 enqueue 시점에 컨텍스트가 있어야 합니다. 없으면 즉시 throw (Fail-Loud)
- job.data.tenantId 값은 신뢰할 수 있는 출처(인증된 요청 컨텍스트)에서 왔을 때만 안전합니다

## 실제 실행 예제

실제 실행 가능한 전체 예제는 [examples/academy-saas/](../academy-saas/) 참고.
BullMQ 연동은 Redis가 필요합니다: `docker run -p 6379:6379 redis:7-alpine`
