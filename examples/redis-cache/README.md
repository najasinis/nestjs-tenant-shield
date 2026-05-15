# Redis Cache Adapter Example

`TenantAwareCacheService`를 Redis로 구현해 `TenantShieldModule.forRoot()`의
`cache` 옵션에 끼우는 패턴입니다.

라이브러리는 Redis SDK에 의존하지 않습니다 — 사용자가 자기 회사가 쓰는
SDK(ioredis, redis, upstash 등) 위에 어댑터를 얇게 작성하면 됩니다.

## 어댑터 구현

`src/redis-cache.adapter.ts` 참고. 핵심은 `get/set/del` 세 메서드만
구현하면 끝입니다.

## 모듈 등록

세 가지 형태 모두 가능:

```ts
// 1) useFactory — Redis 클라이언트를 ConfigService로 초기화하는 일반적인 케이스
TenantShieldModule.forRoot({
  strategy: 'discriminator',
  tenantIdField: 'tenantId',
  tenantSource: 'header',
  cache: {
    useFactory: (config: ConfigService) =>
      new RedisCacheAdapter(new Redis(config.get('REDIS_URL'))),
    inject: [ConfigService],
  },
}),

// 2) useValue — 이미 만들어진 싱글톤이 있을 때
const adapter = new RedisCacheAdapter(global.redisClient);
TenantShieldModule.forRoot({
  ...,
  cache: { useValue: adapter },
}),

// 3) useClass — 무인자 생성자로 동작하는 단순 경우
TenantShieldModule.forRoot({
  ...,
  cache: { useClass: RedisCacheAdapter },
}),
```

## 캐시 키 형태

`@Cacheable({ tenantScoped: true })`이 만들어내는 키 형태:

```
<tenantId>:<ClassName>.<methodName>:<JSON.stringify(args)>
```

예: `academy-A:StudentsService.getRoster:[]`

따라서 Redis에서 학원 A 데이터만 일괄 삭제하려면 `academy-A:*` 패턴
삭제(SCAN + DEL)로 처리할 수 있습니다.
