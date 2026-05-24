# FAQ — nestjs-tenant-shield

## Prisma

### Q. `findUnique`에서 WHERE tenantId가 안 들어가요

의도된 동작입니다.

Prisma의 `findUnique`는 unique 제약(PK 또는 `@@unique` 필드)으로만 조회합니다. unique 조건에 tenantId를 추가하면 "두 unique 필드가 모두 일치해야 하는가?"로 해석되어 의도와 다르게 동작할 수 있습니다.

대신 `createTenantAwarePrisma`는 **결과 사후 검증** 방식을 사용합니다:
1. 원래 쿼리 그대로 실행
2. 결과의 `tenantId`가 현재 tenant와 다르면 → `CrossTenantAccessError` throw

이 방식으로 cross-tenant PK 접근을 차단합니다.

---

## 데코레이터

### Q. `@SystemAction`과 `@RequireTenant`를 같이 쓸 때 순서가 중요한가요?

네, 중요합니다. **`@RequireTenant`를 위에, `@SystemAction`을 아래에** 써야 합니다.

```typescript
// ✅ 올바른 순서
@RequireTenant()
@SystemAction()
async dailyCron() { ... }

// ❌ 잘못된 순서 — allowSystemActions: true여도 우회 안 됨
@SystemAction()
@RequireTenant()
async dailyCron() { ... }
```

TypeScript 메서드 데코레이터는 아래에서 위로 적용되기 때문입니다.
클래스 레벨 `@RequireTenant()` + 메서드 레벨 `@SystemAction()`은 순서 문제 없습니다.

---

## AsyncLocalStorage / 컨텍스트

### Q. EventEmitter / setTimeout에서 tenantId가 null로 나옵니다

AsyncLocalStorage 컨텍스트가 일부 비동기 패턴에서 끊길 수 있습니다.

Node.js 18+의 native Promise/async-await는 자동 전파되지만, `EventEmitter`, `setTimeout`, `setInterval`에서는 끊길 수 있습니다.

해결책: 진입 시점에 tenantId를 캡처하고 `runWithTenant()`로 재진입하세요.

```typescript
const tenantId = getCurrentTenantId(); // 컨텍스트 있는 곳에서 캡처

setTimeout(() => {
  if (!tenantId) return;
  runWithTenant(tenantId, () => {
    // 이 안에서 getCurrentTenantId() 정상 동작
  });
}, 1000);
```

---

## BullMQ / 큐

### Q. BullMQ processor에서 tenantId를 어떻게 전달하나요?

**방법 1 — `withTenantPayload()` (권장):** enqueue 시 현재 컨텍스트의 tenantId를 payload에 자동 첨부.

```typescript
// 요청 컨텍스트 안에서 enqueue
await queue.add('report', withTenantPayload({ month: '2026-05' }));
// → job.data = { month: '2026-05', tenantId: 'academy-A' }
```

**방법 2 — 수동 명시:**
```typescript
await queue.add('report', {
  tenantId: getCurrentTenantId()!,
  month: '2026-05',
});
```

processor에서는 `@TenantContext()` 데코레이터를 붙이면 `job.data.tenantId`에서 자동으로 컨텍스트를 복원합니다.

---

## strictMode

### Q. `strictMode: false`로 설정하면 어떻게 되나요?

tenant 컨텍스트가 없을 때 `MissingTenantContextError`를 throw하지 않고 쿼리를 그대로 실행합니다.

이 설정은 **점진적 마이그레이션**이나 **개발 초기**에만 사용하세요. 프로덕션에서는 `strictMode: true`(기본값)를 유지하는 것을 강권합니다.

---

## 시스템 작업

### Q. `runWithoutTenant()`와 `@SystemAction()`은 언제 각각 써야 하나요?

|  | `runWithoutTenant()` | `@SystemAction()` |
|---|---|---|
| 사용 위치 | 코드 안 (programmatic) | 메서드 데코레이터 |
| 쓰임 | 런타임에 tenant 없이 블록 실행 | 특정 메서드가 항상 시스템 작업임을 선언 |
| 예 | cron 내부, 마이그레이션 스크립트 | `dailyCleanup()`, `aggregateAll()` |

`allowSystemActions: true`를 `forRoot`에 설정해야 `@SystemAction()`이 동작합니다.

```typescript
TenantShieldModule.forRoot({
  allowSystemActions: true,  // @SystemAction() 사용 시 필수
  ...
})
```

---

## TypeORM

### Q. TypeORM raw SQL (`repo.query()`)은 자동 보호가 안 되나요?

맞습니다. `repo.query(sql)`, `queryRunner.query(sql)` 같은 raw SQL은 WHERE가 자동 주입되지 않습니다.

수동으로 tenant 조건을 추가해야 합니다:

```typescript
const tenantId = getCurrentTenantId();
if (!tenantId) throw new MissingTenantContextError('raw SQL', 'custom');

const result = await this.repo.query(
  `SELECT * FROM student WHERE tenant_id = $1 AND active = true`,
  [tenantId],
);
```

---

질문이 더 있으면 [GitHub Issues](https://github.com/jinyeongjung/nestjs-tenant-shield/issues)에 남겨주세요.
