# Redis Cache Example

`TenantShieldModule.forRoot({ cache: { useFactory } })`로 Redis 어댑터를 주입해 tenant별 캐시를 분리하는 실행 가능한 예제.

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

## 캐시 hit/miss 확인

```bash
# 첫 번째 요청 — 콘솔에 "[cache miss] loading students for tenant: academy-A" 출력
curl -H "x-tenant-id: academy-A" http://localhost:3003/students

# 두 번째 요청 — 콘솔 출력 없음 (Redis에서 캐시 hit)
curl -H "x-tenant-id: academy-A" http://localhost:3003/students

# tenant-B는 별도 캐시 — 다시 cache miss 출력
curl -H "x-tenant-id: academy-B" http://localhost:3003/students
```

Redis CLI로 캐시 키 확인:
```bash
redis-cli keys "*"
# → academy-A:StudentsService.findAll:[]
# → academy-B:StudentsService.findAll:[]
```

## 어댑터 구현

`src/redis-cache.adapter.ts` — `get/set/del` 세 메서드만 구현하면 끝:

```typescript
@Injectable()
export class RedisCacheAdapter implements TenantAwareCacheService {
  constructor(private readonly redis: Redis) {}

  async get(key: string) { /* Redis GET */ }
  async set(key: string, value: unknown, ttlSeconds: number) { /* Redis SET EX */ }
  async del(key: string) { /* Redis DEL */ }
}
```

## 캐시 키 형태

```
<tenantId>:<ClassName>.<methodName>:<JSON.stringify(args)>
```

예: `academy-A:StudentsService.findAll:[]`
