# 매우 중요한 유의사항 (Critical Notes)

> 이 프로젝트에서 **이미 발생한 함정**과 **반드시 지켜야 할 격리 규칙**을 모은다.
> 새로운 항목은 실제 사고/실패에서만 추가한다. "이러면 위험할 것 같다" 추측은 넣지 않는다.
> 항목마다 **증상 → 원인 → 올바른 패턴 → 출처** 4단으로 기록.

---

## 0. 최우선 원칙 (절대선)

### 0.1 Cross-tenant 누출은 회사를 망하게 한다

이 라이브러리의 존재 이유. 다음 시나리오를 만들면 **즉시 throw**해야 한다.

- A tenant 컨텍스트에서 B tenant 데이터 조회
- tenant 컨텍스트 없이 일반 비즈니스 메서드 호출 (strict mode)
- 캐시 키에서 tenant prefix 누락

"잘 동작하는 것처럼 보이지만 격리가 깨졌다"는 코드는 **버그가 아니라 보안 사고**다.
빌드 그린이라도 격리 테스트 케이스 추가 없이는 머지하지 않는다.

### 0.2 Fail-Loud, Never-Silent

조용히 빈 배열·null·undefined를 반환하지 않는다. 격리가 깨질 가능성이 있으면 즉시 throw.
silent fallback은 [tenant-shield-PRD.md](./tenant-shield-PRD.md) §3 설계 원칙 위반.

---

## 1. 멀티테넌시 격리 함정

### 1.1 `applyTenantToFindOptions` 머지 버그

**증상**: `runWithoutTenant` 블록 안에서도 `WHERE tenantId = null`이 박혀 쿼리가 데이터 0건 반환.

**원인**: 머지 함수가 "tenant 없음"을 단순히 `null`로 치환하고 그대로 머지 진행.
시스템 작업 / strict-off / 일반 케이스가 한 분기로 안 묶여 있었음.

**올바른 패턴**:
- tenant 컨텍스트 없는 모든 케이스 (시스템 작업 + strict-off + runWithoutTenant)는 **단일 분기**로 묶고
- 그 분기에서는 **원본 옵션을 그대로 통과**시킨다. 머지 자체를 시도하지 않는다.

**출처**: 커밋 `7567670` (To-Do 1번 작업 중 발견)

---

### 1.2 `runWithoutTenant`의 정당한 사용

**증상**: 일반 비즈니스 메서드에서 격리를 우회하려고 `runWithoutTenant`를 호출 → cross-tenant 누출.

**원인**: `runWithoutTenant`는 escape hatch이지 편의 도구가 아닌데, JSDoc 부족으로 사용자가 오해.

**올바른 패턴**:
- **정당한 사용**: 시스템 cron, 마이그레이션 스크립트, 모든 tenant 순회 작업.
- **금지 사용**: 일반 비즈니스 로직, 컨트롤러, 사용자 요청 처리 경로.
- 모든 tenant 순회가 필요하면 `runWithTenant(tenantId, fn)` 루프 패턴을 쓴다.

```typescript
// ✅ 올바름
for (const tenantId of allTenantIds) {
  await runWithTenant(tenantId, async () => {
    await service.dailyAggregation();
  });
}

// ❌ 금지
await runWithoutTenant(async () => {
  await service.findAll(); // 어느 tenant 것인지 불명
});
```

**출처**: 커밋 `06f3e73` (runWithoutTenant JSDoc 보강)

---

### 1.3 `@SystemAction` + `@RequireTenant` 데코레이터 적용 순서

**증상**: `@SystemAction`과 `@RequireTenant`를 역순으로 적용하면 `forRoot.allowSystemActions: true`여도 우회가 작동하지 않는다.

**원인**: TypeScript 메서드 데코레이터는 **아래(소스에서 가까운 쪽)부터 적용**된다.

```typescript
// ✅ Case A — 올바른 순서: @RequireTenant 위, @SystemAction 아래
@RequireTenant()   // 2번째 적용 → originalMethod 에 메타데이터가 있어서 isSystemActionDecorated = true
@SystemAction()    // 1번째 적용 → originalMethod 에 SYSTEM_ACTION_METADATA 세팅
async run() {}

// ❌ Case B — 잘못된 순서: @SystemAction 위, @RequireTenant 아래
@SystemAction()    // 2번째 적용 → descriptor.value = wrapMethod이 만든 wrapped fn에 메타데이터 세팅
@RequireTenant()   // 1번째 적용 → originalMethod(메타데이터 없음)를 캡처하고 wrapping
async run() {}
```

Case B에서 `Reflect.getMetadata(SYSTEM_ACTION_METADATA, originalMethod)` = `undefined` →
`isSystemActionDecorated = false` → `allowSystemActions: true`여도 `shouldBypass = false` → throw.

**올바른 패턴**:
- 메서드에 두 데코레이터를 함께 쓸 때는 **반드시 `@RequireTenant` 위, `@SystemAction` 아래** 순서.
- 클래스 레벨 `@RequireTenant` + 메서드 레벨 `@SystemAction`은 순서 문제 없음 (클래스 wrapping이 prototype 순회 시점에 메타데이터를 읽으므로).

```typescript
// ✅ 메서드 레벨 조합 정석
@RequireTenant()
@SystemAction()
async dailyCron() { ... }

// ✅ 클래스 레벨은 순서 무관 (이미 올바르게 동작)
@RequireTenant()
class MyService {
  @SystemAction()
  async dailyCron() { ... }
}
```

**출처**: 커밋 `82422e8` (2-b 구현 중 발견, `test/unit/system-action.decorator.spec.ts` Case B 케이스로 명세화)

---

## 2. NestJS 와이어링 함정

### 2.1 `forRoutes` wildcard의 함정

**증상**: `forRoutes('*')` 사용 시 NestJS 11에서 path-to-regexp 호환성 문제 발생.

**올바른 패턴**:
```typescript
// ✅ 권장
consumer.apply(TenantContextMiddleware).forRoutes({
  path: '*',
  method: RequestMethod.ALL,
});

// ❌ 호환성 깨짐 가능
consumer.apply(TenantContextMiddleware).forRoutes('*');
```

**출처**: 커밋 `599bde9` (0단계 부수 정리)

---

### 2.2 `DynamicModule.global` 누락

**증상**: 모듈을 import한 곳에서만 `TenantContextService`가 주입 가능, 자식 모듈에서 `Nest can't resolve dependencies` 에러.

**올바른 패턴**: `forRoot` / `forRootAsync`가 반환하는 `DynamicModule`에 항상 `global: true` 명시.

**출처**: 커밋 `599bde9`

---

### 2.3 Subscriber 자동 등록 — `ModuleRef` 동적 lookup 패턴

**증상 (자동 등록 안 했을 때)**: 사용자가 `TypeOrmModule.forRoot({ subscribers: [TenantSubscriber] })`를 직접 명시해야 함. 누락 시 자동 WHERE 주입이 동작 안 함 → 데이터 누출.

**올바른 패턴**:
- `TenantShieldModule.onApplicationBootstrap`에서 `ModuleRef.get(DataSource, { strict: false })`로 동적 lookup.
- 찾으면 `dataSource.subscribers.push(this.tenantSubscriber)`.
- TypeORM 미사용자 (DataSource 없음)는 **silently skip** — `try/catch` 또는 `strict: false`로 처리.
- "TypeORM 미사용자에게도 에러" 같은 시끄러운 실패는 금지. 어댑터는 선택적이다.

**출처**: 커밋 `599bde9`

---

## 3. TypeORM / Repository 프로토타입 패치 함정

### 3.1 Sync throw vs `Promise.reject` 불일치

**증상**: `Repository.prototype.find` 패치 함수가 sync throw → 테스트의 `await expect(...).rejects.toThrow()`가 매치 안 됨. "왜 던지는데 잡지 못하지?" 혼란.

**원인**: TypeORM `Repository.find`는 `Promise<T[]>`를 반환. 패치 함수가 sync throw하면 Promise rejection이 아니라 동기 throw → Jest의 `rejects` matcher가 못 잡음.

**올바른 패턴**: 모든 patch 함수에서 throw를 `Promise.reject(err)`로 통일.

```typescript
// ❌ 잘못됨
const original = Repository.prototype.find;
Repository.prototype.find = function (...args) {
  const tenantId = getCurrentTenantId();
  if (!tenantId && strictMode) {
    throw new MissingTenantContextError(); // sync throw
  }
  return original.apply(this, args);
};

// ✅ 올바름
Repository.prototype.find = function (...args) {
  const tenantId = getCurrentTenantId();
  if (!tenantId && strictMode) {
    return Promise.reject(new MissingTenantContextError());
  }
  return original.apply(this, args);
};
```

**출처**: 커밋 `7567670`

---

### 3.2 중복 구현체 만들지 말 것

**증상**: `where-injector.ts` 따로 만들었으나, 자동 WHERE 주입은 Repository/QueryBuilder prototype patching으로 이미 구현돼 있어 중복.

**교훈**: 신규 파일 만들기 전에 `src/` 전체 grep으로 동일 책임 코드 있는지 확인. "내가 못 봤다"가 아니라 **실제 동작 경로**를 추적한다.

**올바른 패턴**: 신규 모듈 만들기 전:
1. `rg "tenantId|tenant_id" src/` 로 기존 처리 경로 확인
2. e2e 테스트 1개 실행해서 어떤 코드 경로를 타는지 확인
3. 그래도 필요하면 신설

**출처**: 커밋 `599bde9` (where-injector.ts 제거)

---

## 4. 캐시 함정

### 4.1 `@Cacheable` DI fallback 패턴

**증상**: `@Cacheable` 데코레이터가 DI 컨텍스트 밖(예: static method)에서 호출되면 `cacheService` 주입 못 받아 캐시 무력화.

**올바른 패턴**:
- `src/cache/cache.registry.ts`의 `getGlobalCache()` 사용.
- `TenantShieldModule` bootstrap 시 `setGlobalCache(this.cache)` 호출.
- 데코레이터 안에서는 `this.cacheService ?? getGlobalCache()` 순서로 fallback.
- 둘 다 없으면 dev 환경에서 **1회만** 경고 로그 (스팸 금지).

**출처**: 커밋 `599bde9`

---

### 4.2 캐시 키에 tenant prefix 누락 금지

**증상**: `@Cacheable({ tenantScoped: true })` 누락 시 캐시가 tenant 간 공유 → cross-tenant 누출.

**올바른 패턴**:
- `tenantScoped: true`가 **기본값**이어야 한다.
- `tenantScoped: false`는 명시적 opt-out으로만 (시스템 메트릭 같은 공유 캐시).
- 캐시 키 포맷: `${tenantId}:${methodName}:${argsHash}` 고정.

---

## 5. 외부 어댑터 등록 (cache 슬롯)

### 5.1 세 가지 등록 패턴 모두 지원

**증상**: 사용자가 `useFactory`만 지원하면 인스턴스 직접 주입(`useValue`) 또는 클래스 자동 인스턴스화(`useClass`)가 불편.

**올바른 패턴**: `TenantShieldOptions.cache`는 세 형태 모두 받는다.

```typescript
// useFactory
{ cache: { useFactory: () => new RedisAdapter(env.REDIS_URL) } }

// useValue (이미 만든 인스턴스)
{ cache: { useValue: existingRedisAdapter } }

// useClass (DI가 인스턴스화)
{ cache: { useClass: MyCacheAdapter } }
```

`forRoot` / `forRootAsync` 둘 다 동일하게 처리.

**출처**: 커밋 `ab180ae`

---

## 6. 테스트 작성 함정

### 6.1 e2e는 cross-tenant 격리 검증을 항상 포함

**증상**: "기능 동작"만 테스트하고 격리 검증을 빠뜨림 → 회귀 시 보안 사고.

**최소 시나리오**:
- `findBy` 자동 WHERE 주입
- QueryBuilder.getMany 자동 andWhere
- cross-tenant PK 격리 (A tenant에서 B tenant의 id 조회 시 결과 없음)
- strict mode에서 컨텍스트 누락 시 throw

**출처**: 커밋 `7567670` (e2e 4 → 8개 확장)

---

### 6.2 테스트에서 `runWithTenant` 헬퍼 사용

**증상**: 테스트에서 `asyncLocalStorage.run`을 직접 호출하면 실패 시 디버깅 어려움.

**올바른 패턴**: 항상 `runWithTenant('tenant-id', async () => { ... })` 헬퍼 경유. 헬퍼가 에러 컨텍스트를 풍부하게 제공.

---

## 7. 일반 함정 (반복 패턴)

### 7.1 import 순서 / 그룹화

**증상**: 누적 평가 4건 이상에서 import 순서 깨진 채 커밋된 사례 보고됨 (~/.claude/evaluations.md 회고 결과).

**올바른 패턴**:
1. Node 내장 (`node:async_hooks`)
2. 외부 패키지 (`@nestjs/common`, `typeorm`)
3. 같은 패키지 내부 (`./` 또는 `src/`)
각 그룹 사이 빈 줄 1개.

> 이 항목은 회고 데이터 기반으로 추가됐다. 새 회고에서 패턴이 사라지면 제거.

---

### 7.2 "코드는 맞아 보이는데 동작 안 함" 패턴

**증상**: 컴파일 그린, 단위 테스트도 그린, 그런데 실제 동작에서 실패.

**원인 후보**:
- e2e 시나리오 미작성 (단위 테스트만으로 통합 동작 검증 불가)
- AsyncLocalStorage 컨텍스트가 비동기 경계에서 끊김
- TypeORM Subscriber가 등록 안 됨 → silent skip 분기 진입

**올바른 패턴**: 새 기능 추가 시:
1. 단위 테스트 작성
2. **e2e 시나리오 1개 이상** 추가 (격리 검증 포함)
3. `npx jest` 그린 확인

**출처**: 회고 데이터 (2건 보고됨, 아직 4건 미만이지만 도메인 특성상 우선 등재)

---

## 8. 변경 정책

이 파일에 항목 추가 시:
1. **실제 사고/실패에서만** 추가. 추측·예측 항목 금지.
2. **증상 → 원인 → 올바른 패턴 → 출처** 4단 유지.
3. 출처는 커밋 해시 또는 회고 회차 명시.
4. 항목이 더 이상 발생하지 않는지 회고에서 검증되면 **제거 검토**. 박물관 만들지 않는다.

| 날짜 | 변경 |
|---|---|
| 2026-05-17 | 초안 작성 — 0단계/1번/2-a에서 발견한 함정 집결 |
| 2026-05-23 | §1.3 업데이트 — 2-b 구현에서 발견한 데코레이터 적용 순서 함정 명세화 |
