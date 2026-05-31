# BullMQ + nestjs-tenant-shield 예제

`@TenantContext()`와 `withTenantPayload()`를 사용해 BullMQ 큐 작업에 tenant 격리를 적용하는 실행 가능한 예제.

## 실행 방법

```bash
# 1. Redis 기동
docker run -d -p 6379:6379 redis:7-alpine

# 2. 의존성 설치
pnpm install

# 3. 서버 기동
pnpm start
```

환경변수로 Redis 주소 설정 가능:
```bash
REDIS_HOST=localhost REDIS_PORT=6379 pnpm start
```

## 테스트

```bash
# tenant A 리포트 스케줄 등록 → job.data = { month, tenantId: 'academy-A' }
curl -X POST http://localhost:3002/reports/schedule \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: academy-A" \
  -d '{"month":"2026-05"}'

# tenant 헤더 없이 요청 → MissingTenantContextError
curl -X POST http://localhost:3002/reports/schedule \
  -H "Content-Type: application/json" \
  -d '{"month":"2026-05"}'
```

processor 로그에서 `[academy-A] Generating report for month: 2026-05` 확인.

## 핵심 패턴

```typescript
// Enqueue — withTenantPayload()가 현재 tenant를 payload에 자동 주입
await this.queue.add('monthly', withTenantPayload({ month }));
// → job.data = { month: '2026-05', tenantId: 'academy-A' }

// Processor — @TenantContext()가 job.data.tenantId를 ALS 컨텍스트로 복원
@TenantContext()
async process(job: Job) {
  const tenantId = getCurrentTenantId(); // 'academy-A'
  // 이후 모든 DB 쿼리에 WHERE tenantId = 'academy-A' 자동 주입
}
```
