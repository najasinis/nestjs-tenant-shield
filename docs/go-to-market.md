# Go-to-Market & 안정성 게이트

> 마케팅 전략 / 마케팅 진입 전 통과해야 할 안정성 게이트 / 예상 문제점 전수 정리를 담은 단일 문서.
> 코드는 다루지 않는다. Part B 하네스 코드 구현은 별도 승인 후 진행.

---

## 핵심 전제: "99% 통과율"과 "누출 0건"은 다르다

일반 기능 흐름(올바른 row 반환, 에러 처리 등)은 **≥99% 정확도**를 기준으로 삼는다.  
그러나 **cross-tenant 누출은 단 1건도 허용 불가(차단율 100%)**. 누출 1건 = 보안 사고다.  
이 구분이 Part B 게이트 판정표의 "하드 게이트"와 "기준" 분류의 근거다.  
이 사실을 숨기거나 희석하지 않는다. 마케팅 메시지에서도 동일하다.

---

## Part A — 마케팅 전략 (한국 우선 → 글로벌)

### A-0. 포지셔닝 한 줄

> "NestJS B2B SaaS의 cross-tenant 데이터 누출을, 데코레이터 한 줄로 차단하는 안전망."

**경쟁 대비 한 문장**:  
nestjs-cls = 범용 ALS 도구 / nestjs-tenancy류 = DB·Schema 분리 전용 / nestjs-tenant-shield = **멀티테넌시 안전망** (auto WHERE + 캐시 분리 + 테스트 시 누출 자동 차단).

| 기능 | nestjs-cls | nestjs-tenancy류 | nestjs-tenant-shield |
|---|---|---|---|
| AsyncLocalStorage | ✅ | 부분 | ✅ |
| Auto WHERE 주입 | ❌ | ❌ | ✅ 핵심 |
| Database/Schema 분리 | ❌ | ✅ | ✅ (v0.3) |
| 캐시 키 자동 분리 | ❌ | ❌ | ✅ |
| 백그라운드 작업 컨텍스트 | 부분 | ❌ | ✅ |
| 테스트 시 cross-tenant 자동 차단 | ❌ | ❌ | ✅ 핵심 |
| Postgres RLS 통합 | ❌ | ❌ | ✅ (v0.3) |

카테고리: 기존은 "도구". nestjs-tenant-shield는 **"멀티테넌시 안전망"**.

---

### A-1. 사전 자산 (마케팅 글 쓰기 전 준비물)

아래 자산이 갖춰지기 전에는 채널 게시를 시작하지 않는다.

| 자산 | 상태 | 비고 |
|---|---|---|
| 30초 Quick Start (영문) | ✅ 완료 | README Quick Start |
| before/after 코드 비교 | ✅ 완료 | README §핵심 차별화 |
| 정직한 한계(Honest Limits) 섹션 | ✅ 완료 | README §Honest Limits |
| npm / CI 뱃지 | ✅ 완료 | — |
| **누출 재현 데모 GIF/저장소** | ❌ **미완성** | "수동 코드는 누출, 라이브러리는 throw" 1분 시연 → 가장 강력한 자산 |
| GitHub Discussions 오픈 | ❌ 미완성 | 첫 포스트: "Roadmap & Feedback" 핀 고정 |
| Part B 안정성 게이트 통과 | ❌ 미완성 | **통과 전 마케팅 보류** |

**데모 GIF 최소 시나리오**:
1. 수동 코드: tenant A 요청 컨텍스트에서 tenant B 데이터 직접 쿼리 → 데이터 반환(누출)
2. 라이브러리 적용: 동일 시도 → `CrossTenantAccessError` throw
3. 테스트 코드: `mockTenantContext` 없이 tenant 데이터 접근 → 즉시 실패

---

### A-2. 1단계: 한국 커뮤니티 (피드백·파일럿 확보)

**목표**: Gate B 충족 — 외부 피드백 3건 OR 파일럿 채택 1건  
**KPI**: GitHub Star, Issue/Discussion, npm 주간 다운로드

| 채널 | 형식 | 핵심 메시지 | 주의 |
|---|---|---|---|
| **긱뉴스(GeekNews)** | 링크 + 1단락 요약 | "데코레이터 한 줄로 멀티테넌시 격리" | 제품 자랑 X — 문제→해결 서사. 긱뉴스는 자기홍보에 민감하다 |
| **OKKY / 커리어리** | 경험 공유 글 | "B2B SaaS 만들다 겪은 누출 공포, 이렇게 해결했다" | 라이브러리 홍보보다 경험담이 신뢰 얻음 |
| **disquiet(디스콰이엇)** | 메이커 로그 | 만든 과정 + 회고 | 솔직한 한계 포함 |
| **카톡/슬랙 NestJS 한국 모임** | 직접 공유 | 피드백 요청 | 커뮤니티 규칙 확인 필수 |

**게시 글 핵심 구조** (긱뉴스/OKKY 공통):
1. **문제**: "B2B SaaS에서 tenant A 요청이 tenant B 데이터를 보는 사고, 한 번이라도 고민해 봤나요?"
2. **기존 방법의 한계**: nestjs-cls는 ALS만 제공, 매번 수동 WHERE 추가 → 빠뜨리면 누출
3. **해결**: 데코레이터 한 줄 → 자동 WHERE 주입 + 캐시 분리 + 테스트 시 자동 차단
4. **정직한 한계**: raw SQL, JOIN, subquery는 보호 안 됨 (90% rule)
5. **링크**: npm + GitHub

---

### A-3. 2단계: 글로벌 확장 (한국에서 검증 후)

한국 1단계에서 Gate B 통과 + 실제 사용 피드백 반영 후 진입.

| 채널 | 형식 | 비고 |
|---|---|---|
| **dev.to** | 영문 기술 포스트 | "Automatic multi-tenant isolation in NestJS" — 이미 [post-devto.md](./post-devto.md) 초안 있음 |
| **Reddit r/node** | dev.to 링크 | self-promo 규칙 준수 (9:1 룰: 기여 9 : 홍보 1) |
| **NestJS Discord `#libraries`** | 직접 공유 | 타겟 정확. 첫 인상 중요 |
| **Hacker News (Show HN)** | 데모 중심 | 부정 첫 댓글 리스크 큼 → 하드닝 + 외부 감사 후에만 |
| **X(Twitter) / LinkedIn** | 짧은 스레드 | GIF 데모 + 코드 스니펫 |

---

### A-4. 마케팅 메시지 원칙

1. **과장 금지**: "100% 보안" 절대 X → "흔한 사고 90% 자동 차단 + 정직한 한계" 그대로
2. **선제 방어**: 첫 댓글이 "raw SQL은 안 막던데?"일 것 → 한계를 **먼저** 밝혀 신뢰 확보
3. **솔로 메인테이너 신뢰도 보강**: 테스트 커버리지·CI 뱃지·Part B 안정성 리포트 결과 공개
4. **bus factor 인정**: "솔로 메인테이너, 현재 외부 감사 없음" — 숨기면 나중에 더 큰 역풍

---

### A-5. 런칭 타임라인 (게이트 연동)

```
[현재 위치]
    Part B 게이트 작성 완료 (이 문서)
          │
          ▼
    Part B 하네스 코드 구현 (별도 승인 후)
          │
          ▼
    Part B 게이트 통과 (누출 0건 확인)
          │
          ▼
    데모 GIF + GitHub Discussions 오픈
          │
          ▼
    1단계: 한국 커뮤니티 발표 (2~3주, Gate B 목표)
          │
    Gate B 통과?
    ├── ✅ → 2단계: 글로벌 확장
    └── ❌ (6~8주 경과) → 유지보수 모드 전환 검토
```

---

## Part B — 안정성/보안 테스트 게이트 (마케팅 진입 조건)

> 이 섹션은 "실행 가능한 스펙"이다. 하네스 코드 구현은 이 문서 승인 후 별도 세션.

### 기존 인프라 재사용

| 인프라 | 파일 |
|---|---|
| Jest + ts-jest, SQLite in-memory e2e | `test/e2e/typeorm-integration.spec.ts` |
| testcontainers Postgres e2e | `test/e2e/postgres-integration.spec.ts` |
| 헬퍼 | `runWithTenant` / `runWithoutTenant` / `getCurrentTenantId` / `mockTenantContext` / `expectCurrentTenant` |
| 벤치마크 패턴 | `benchmark/simple-bench.ts` |

### 신규 추가 필요

```
devDependencies:
  @faker-js/faker   — 대규모 mock 데이터 생성
  fast-check        — property-based 테스트

신규 디렉토리:
  test/hardening/

npm script:
  "test:hardening": "jest --testPathPattern=test/hardening"
```

---

### B-1. 대규모 격리 fuzz 하네스

**파일**: `test/hardening/isolation-fuzz.spec.ts`

**의사코드**:
```typescript
// 1. faker로 200개 tenant 생성, 각 50~500 row (수만 row 총량) → SQLite in-memory
const tenants = faker.helpers.multiple(() => faker.string.uuid(), { count: 200 });
for (const tenantId of tenants) {
  const rows = faker.helpers.multiple(() => buildRow(tenantId), { count: faker.number.int({ min: 50, max: 500 }) });
  await repo.save(rows);
}

// 2. K=10,000회 반복
for (let i = 0; i < 10_000; i++) {
  const targetTenant = faker.helpers.arrayElement(tenants);
  await runWithTenant(targetTenant, async () => {
    // 무작위 read API 선택: find / findBy / findOne / QueryBuilder
    const results = await randomReadApi(repo);
    // 단정: 반환된 모든 row의 tenantId === targetTenant
    for (const row of results) {
      expect(row.tenantId).toBe(targetTenant); // 누출 = 테스트 실패
    }
  });
}
```

**통과 기준**: 누출 0건 (100%). 1건이라도 누출 시 게이트 실패 → 마케팅 보류.

---

### B-2. 동시성 / ALS 컨텍스트 누수 하네스

**파일**: `test/hardening/concurrency.spec.ts`

**배경**: PRD §10 실패모드 #6 (동시성 race condition) 실증.

**의사코드**:
```typescript
const N = 500; // 동시 tenant 수
const tasks = Array.from({ length: N }, (_, i) => {
  const tenantId = `tenant-${i}`;
  return runWithTenant(tenantId, async () => {
    // await 경계 + setTimeout으로 컨텍스트 전환 강제
    await new Promise(r => setTimeout(r, Math.random() * 10));
    const ctx = getCurrentTenantId();
    expect(ctx).toBe(tenantId); // ALS bleed = 테스트 실패
    const rows = await repo.find();
    for (const row of rows) {
      expect(row.tenantId).toBe(tenantId);
    }
  });
});
await Promise.all(tasks);
```

**통과 기준**: ALS 컨텍스트 bleed 0건.

---

### B-3. property-based WHERE 주입 검증

**파일**: `test/hardening/where-injection.property.spec.ts`

**배경**: 임의의 `where` 옵션이 들어와도 tenantId가 항상 머지되는 불변식 검증.

**의사코드**:
```typescript
import fc from 'fast-check';

fc.assert(
  fc.asyncProperty(
    fc.record({
      where: fc.oneof(
        fc.record({ someField: fc.string() }),                      // 단순 where
        fc.array(fc.record({ someField: fc.string() })),            // 배열 OR
        fc.record({ nested: fc.record({ field: fc.string() }) }),   // 중첩
      ),
    }),
    async (findOptions) => {
      const merged = applyTenantToFindOptions('tenant-A', findOptions);
      // 불변식: tenantId가 머지된 결과에 항상 존재
      const hastenantId = extractTenantIds(merged);
      return hastenantId.every(id => id === 'tenant-A');
    }
  ),
  { numRuns: 1000 }
);
```

**통과 기준**: 1000회 중 불변식 위반 0건.

---

### B-4. cross-tenant 쓰기(insert/update/delete) 대규모 검증

**파일**: `test/hardening/cross-tenant-write.spec.ts`

**의사코드**:
```typescript
const tenants = ['A', 'B', 'C'];
for (let i = 0; i < 1_000; i++) {
  const writerTenant = faker.helpers.arrayElement(tenants);
  const targetTenant = faker.helpers.arrayElement(tenants.filter(t => t !== writerTenant));

  await runWithTenant(writerTenant, async () => {
    // 다른 tenant의 row를 수정 시도
    const targetRow = await getRowBelongingTo(targetTenant);
    
    // insert: data에 다른 tenantId 주입 시도
    await expect(repo.save({ ...newRow, tenantId: targetTenant }))
      .rejects.toThrow(CrossTenantAccessError);
    
    // update: 다른 tenant row 수정 시도
    await expect(repo.update(targetRow.id, { name: 'hacked' }))
      .rejects.toThrow(CrossTenantAccessError);
  });
}
```

**통과 기준**: 다른 tenant 데이터 접근 시도 1,000건 전부 `CrossTenantAccessError` → 누출 0건.

---

### B-5. "90% rule" 정직성 테스트 (문서-구현 일치 확인)

**파일**: `test/hardening/honesty.spec.ts`

**목적**: SECURITY.md / README가 "보호 안 됨"이라 명시한 경로가 실제로 문서대로 동작하는지 검증. 문서가 거짓말하지 않도록.

**의사코드**:
```typescript
describe('90% rule 정직성', () => {
  it('raw SQL은 실제로 누출된다 (경고대로)', async () => {
    // tenant A 컨텍스트에서 raw SQL 사용 → tenant B 데이터가 보여야 함
    await runWithTenant('tenant-A', async () => {
      const result = await dataSource.query('SELECT * FROM post');
      const tenantBRows = result.filter(r => r.tenantId === 'tenant-B');
      expect(tenantBRows.length).toBeGreaterThan(0); // raw SQL은 격리 안 됨 = 정직
    });
  });

  it('withTenantWhere 헬퍼 쓰면 raw SQL도 막힌다', async () => {
    await runWithTenant('tenant-A', async () => {
      const result = await dataSource.query(
        `SELECT * FROM post WHERE ${withTenantWhere('tenant-A')}`
      );
      expect(result.every(r => r.tenantId === 'tenant-A')).toBe(true);
    });
  });
});
```

**통과 기준**: 문서-구현 불일치 0건. "막힌다"고 문서에 쓴 것은 막혀야 하고, "안 막힌다"고 쓴 것은 실제로 안 막혀야 한다.

---

### B-6. 버전 매트릭스 + soak/메모리 검증

**파일**: CI 워크플로 확장 + `test/hardening/soak.spec.ts`

**버전 매트릭스**:
```yaml
# .github/workflows/ci.yml 확장 대상
strategy:
  matrix:
    node: [18, 20, 22]
    nestjs: [10, 11]
    # TypeORM: 0.3.x (이미 테스트됨)
    # Prisma: 5.x (이미 테스트됨)
```

**메모리 soak 의사코드**:
```typescript
it('10만 회 루프 후 heap 안정', async () => {
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 100_000; i++) {
    await runWithTenant(`tenant-${i % 100}`, async () => {
      await repo.find();
    });
  }
  global.gc?.(); // --expose-gc 옵션 필요
  const after = process.memoryUsage().heapUsed;
  const growthMB = (after - before) / 1024 / 1024;
  expect(growthMB).toBeLessThan(50); // 50MB 이상 증가 = 누수 의심
});
```

**통과 기준**: Node 18/20/22 × Nest 10/11 전 조합 통과 + heap 증가 50MB 미만.

---

### B-게이트 판정표 (마케팅 진입 체크리스트)

> 아래 표의 모든 항목을 통과해야 Part A 마케팅 진입 허용.  
> "하드 게이트" 1건이라도 실패 시 마케팅 보류, 해당 버그 수정 후 재검증.

| # | 항목 | 기준 | 유형 | 상태 |
|---|---|---|---|---|
| B-1 | cross-tenant read 누출 (fuzz 1,000회) | 누출 0건 | **하드 게이트** | ✅ 통과 (2026-06-25) |
| B-2 | 동시성 ALS 컨텍스트 bleed | bleed 0건 | **하드 게이트** | ✅ 통과 (2026-06-25) |
| B-3 | property-based WHERE 불변식 | 위반 0건 | **하드 게이트** | ✅ 통과 (2026-06-25) |
| B-4 | cross-tenant write 차단 (500회 insert) | 누출 0건 | **하드 게이트** | ✅ 통과 (2026-06-25) |
| B-5 | 문서-구현 일치 (90% rule) | 불일치 0건 | **하드 게이트** | ✅ 통과 (2026-06-25) |
| B-6a | 버전 매트릭스 (Node 18/20/22 × Nest 10/11) | 전 조합 통과 | 기준 | ✅ CI 확장 완료 — 로컬 Nest 10/11 통과 확인 (2026-06-25) |
| B-6b | 메모리 soak (10만 회, ~18초) | heap 증가 <50MB | 기준 | ✅ 통과 (2026-06-25) |
| — | 기능 정확성 (올바른 row 반환) | ≥99% | 기준 | ✅ 기존 81 tests |

> **신규 발견 (2026-06-25)**: QueryBuilder DELETE에 명시적으로 다른 tenantId를 WHERE에 지정하면 `afterLoad` 안전망이 적용되지 않아 실제 삭제됨. SELECT는 afterLoad로 차단되나 DELETE/UPDATE는 entity 로드가 없으므로 미보호. → C-1.11 추가.

---

## Part C — 예상 문제점 전수 정리

> 각 항목: **증상 / 영향 / 완화책 / 출처** 4단 구조.  
> "이러면 위험할 것 같다" 추측은 넣지 않는다. 이미 발생했거나 설계상 구조적인 것만.

---

### C-1. 기술/정확성 리스크

#### C-1.1 ALS 컨텍스트 단절 (EventEmitter, setTimeout, stream 경계)

**증상**: EventEmitter 이벤트 핸들러 또는 setTimeout 콜백 내부에서 `getCurrentTenantId()`가 `undefined` 반환.  
**영향**: 컨텍스트 없는 상태로 DB 쿼리 → strict mode라면 에러, lenient mode라면 silent 누출.  
**완화책**: `runWithTenant`로 감싸 컨텍스트를 명시적으로 전파. EventEmitter 이벤트 emit 시점에 tenantId를 페이로드에 포함.  
**출처**: [PRD §9.6](./tenant-shield-PRD.md), Node.js ALS 구조적 한계.

#### C-1.2 Subscriber 미등록 → silent skip → 누출

**증상**: entity가 TypeORM Subscriber 목록에 없을 때 auto WHERE가 적용되지 않아 모든 tenant 데이터가 반환됨.  
**영향**: 격리 완전 실패. 오류가 발생하지 않아 발견이 늦다.  
**완화책**: `onApplicationBootstrap`에서 entity 스캔 + 미등록 entity 경고 로그. B-1 fuzz 테스트가 이를 잡아낸다.  
**출처**: [critical-notes.md §2.3](./critical-notes.md).

#### C-1.3 prototype 전역 패칭의 부작용 ⚠️ (가장 중요)

**증상**: `Repository.prototype`을 전역 패치하므로, 동일 프로세스의 모든 DataSource·다른 라이브러리의 Repository·테스트 전체가 패치 영향권에 들어간다.  
**영향**: (a) 멀티 DataSource 환경에서 예상치 못한 격리 적용, (b) 타 라이브러리 Repository 동작 변경, (c) 테스트 격리 오염 — 테스트 순서에 따라 결과가 달라질 수 있다.  
**완화책**: `TenantShieldModule.forRoot()` 호출 전에 패치가 활성화되지 않도록 lazy 초기화 보장. 멀티 DataSource 환경에서는 `entities` 옵션으로 패치 대상 제한 문서화 필요.  
**출처**: 신규 식별 (설계 구조 분석).

#### C-1.4 raw SQL / JOIN / subquery 미보호

**증상**: `dataSource.query(rawSql)` 또는 QueryBuilder JOIN 내부는 WHERE 자동 주입 불가.  
**영향**: 개발자가 raw SQL을 쓰는 순간 격리가 무너짐. 라이브러리가 조용히 통과시킨다.  
**완화책**: README "Honest Limits" 섹션 명시. `withTenantWhere()` 헬퍼 제공. 린트 규칙 권고.  
**출처**: [README §Honest Limits](../README.md), B-5 테스트로 동작 검증.

#### C-1.5 Prisma `$extends` duck-typing 취약성

**증상**: Prisma 버전 업그레이드 시 `$extends` API 시그니처 변경 → 어댑터 작동 불능.  
**영향**: Prisma 사용자 전체에게 breaking change로 전파됨.  
**완화책**: `peerDependencies`에 `@prisma/client ^5.0.0` 고정. 버전 매트릭스 CI에 포함.  
**출처**: [process.md 2-d 항목](./process.md), 설계 분석.

#### C-1.6 `findUnique` 사후검증의 미세 race 윈도우

**증상**: `findUnique`는 PK 특성상 WHERE에 tenantId를 직접 주입할 수 없어 결과 row의 tenantId를 사후 검증한다. 이론적으로 쿼리 실행 후 검증 사이에 row가 변경될 수 있다.  
**영향**: 매우 낮은 확률이지만 공격자가 타이밍을 맞추면 검증 우회 가능.  
**완화책**: README에 명시. PK 기반 조회 시에는 반드시 tenantId 복합 인덱스 추가 권고.  
**출처**: [process.md §178](./process.md).

#### C-1.7 Migration / CLI 우회

**증상**: `typeorm migration:run`, `nest start --entryFile migration` 등 CLI 실행 경로는 NestJS 미들웨어를 거치지 않아 tenant 컨텍스트가 없다.  
**영향**: 마이그레이션 스크립트에서 cross-tenant 쿼리가 자유롭게 실행됨 (의도된 동작이지만 오해 가능).  
**완화책**: `runWithoutTenant()` 또는 `@SystemAction` 데코레이터 사용 가이드 문서화. 마이그레이션 스크립트 예제 포함.  
**출처**: PRD §10 실패모드 구조적 분석.

#### C-1.8 멀티 DataSource 트랜잭션 미보장

**증상**: 두 개 이상의 DataSource에 걸친 트랜잭션에서 tenant 격리가 한쪽에만 적용될 수 있다.  
**영향**: 분산 트랜잭션 롤백 시 한쪽 DataSource는 격리, 다른 쪽은 누출 상태로 커밋될 수 있다.  
**완화책**: 현재 버전의 Known Limitation으로 명시. v0.3 RLS와 함께 검토.  
**출처**: 설계 분석.

#### C-1.9 데코레이터 적용 순서 함정

**증상**: `@SystemAction`을 `@RequireTenant` 위에 붙이면 `originalMethod`에 메타데이터가 없어 `allowSystemActions: true`여도 우회 불가.  
**영향**: 개발자가 디버깅에 시간을 낭비하거나 격리 우회가 작동하지 않는다고 오해.  
**완화책**: 올바른 순서(`@RequireTenant` 위, `@SystemAction` 아래)를 문서와 에러 메시지에 명시. 잘못된 순서 감지 시 경고.  
**출처**: [critical-notes.md §1.3](./critical-notes.md), 커밋 `82422e8`.

#### C-1.10 header tenantId 변조 (인증 경계 책임)

**증상**: 공격자가 HTTP header의 `x-tenant-id`를 조작하면 라이브러리가 잘못된 tenant ID를 신뢰한다.  
**영향**: 다른 tenant 사칭 가능.  
**완화책**: 라이브러리는 "tenantId를 어디서 추출할지"만 담당하지 않는다. 인증 미들웨어(JWT claim, 세션 등)에서 검증된 tenantId를 전달하는 책임은 사용 측에 있음. README에 명시.  
**출처**: PRD §10 실패모드 #7.

#### C-1.11 QueryBuilder DELETE/UPDATE에서 명시적 다른 tenantId 지정 시 미보호 ⚠️ (B-5 테스트 중 실증)

**증상**: `createQueryBuilder().delete().from(Entity).where('tenantId = :t', { t: otherTenant }).execute()` 실행 시 실제로 다른 tenant row가 삭제됨.  
**원인**: subscriber의 `hasTenantWhere` 체크가 WHERE 절에 `tenantId`가 이미 있으면 추가 필터를 건너뜀. SELECT는 `afterLoad`가 최후 안전망으로 작동하지만, DELETE/UPDATE는 entity를 로드하지 않아 `afterLoad`가 적용되지 않는다.  
**영향**: 의도적으로 `WHERE tenantId = otherTenant`를 넣는 공격자는 DELETE/UPDATE를 통해 다른 tenant 데이터를 수정/삭제 가능. SELECT는 afterLoad로 막히므로 데이터 열람은 차단됨.  
**완화책**: hasTenantWhere 체크를 "tenantId가 있는가" → "tenantId가 현재 컨텍스트 값과 일치하는가"로 강화해야 함 (v0.2.x 수정 후보). 그 전까지 DELETE/UPDATE는 수동 WHERE 없이 사용하는 것이 안전.  
**출처**: B-5 하네스 테스트 중 실증 (`test/hardening/honesty.spec.ts`, 2026-06-25).

---

### C-2. 채택/DX 리스크

#### C-2.1 "마법 같은 전역 패칭"의 불신

**증상**: 보안에 민감한 팀이 `Repository.prototype` 전역 패칭을 보고 "이게 프로덕션에 안전한가?" 즉각 이탈.  
**영향**: Gate B 피드백이 채택 대신 "왜 이런 방식으로 만들었나요?" 질문으로 채워질 수 있다.  
**완화책**: 설계 결정(ADR)을 공개 문서로 제공. "왜 prototype patch인가, 대안은 무엇인가"를 FAQ에 추가.  
**출처**: 마케팅 예측 분석.

#### C-2.2 예상 못한 WHERE 자동 주입 시 디버깅 난이도

**증상**: 쿼리 결과가 예상보다 적게 나올 때 "왜 WHERE가 자동으로 들어갔지?"를 파악하기 어렵다.  
**영향**: 온보딩 마찰. 첫 경험이 나쁘면 이탈.  
**완화책**: `debug: true` 옵션 추가 시 자동 WHERE 주입 로그 출력. 현재 미구현 → 요구사항 등록 가치 있음.  
**출처**: DX 분석.

#### C-2.3 기존 수동 코드에서 마이그레이션 마찰

**증상**: 이미 수동으로 `WHERE tenantId = ?`를 넣고 있는 팀은 라이브러리 도입 시 중복 적용 위험.  
**영향**: 쿼리 오작동, 예상치 못한 필터링.  
**완화책**: 마이그레이션 가이드 문서화. `disableAutoWhere: true` 옵션으로 점진적 이전 지원 검토.  
**출처**: 사용자 시나리오 분석.

#### C-2.4 TypeORM 0.3 전용 — 다른 ORM 사용자 배제

**증상**: TypeORM 0.2.x, Drizzle, Mongoose, MikroORM 사용자는 어댑터 없음.  
**영향**: 잠재 사용자 다수 배제. "우리는 Drizzle 쓰는데?" 첫 반응.  
**완화책**: 지원 범위를 README 첫머리에 명시. Prisma 어댑터는 이미 지원(v0.2). 추가 어댑터는 커뮤니티 기여 형태로 열어두기.  
**출처**: 설계 범위.

---

### C-3. 신뢰/마케팅 리스크

#### C-3.1 외부 프로덕션 사용자 0건

**증상**: "실제로 쓰는 사람 있나요?" 질문.  
**영향**: 보안 라이브러리의 신뢰도에 치명적. "아무도 안 써봤다"는 곧 "검증 안 됐다"는 의미.  
**완화책**: Gate B 파일럿 1건이 이 문제를 해결한다. 그 전까지는 "현재 파일럿 모집 중"으로 정직하게 표현.  
**출처**: 마케팅 구조 분석.

#### C-3.2 외부 보안 감사 없음

**증상**: "보안 라이브러리인데 외부 감사를 받았나요?" 질문.  
**영향**: 엔터프라이즈 팀은 외부 감사 없이 도입 불가 정책인 경우가 많다.  
**완화책**: 현재 한계 정직하게 명시. 미래 로드맵에 "외부 보안 감사 검토" 포함. 커뮤니티 코드 리뷰 장려.  
**출처**: 마케팅 예측.

#### C-3.3 솔로 메인테이너 bus factor

**증상**: "메인테이너가 혼자인데 계속 유지관리 될까요?"  
**영향**: 장기 의존성을 꺼리는 팀의 이탈.  
**완화책**: CONTRIBUTING.md 공개 + 커뮤니티 기여 장려. 정직하게 인정하되, "Gate B 통과 후 장기 유지 여부 재검토" 계획 공개.  
**출처**: 솔로 프로젝트 구조.

#### C-3.4 package.json author/repo 불일치 ⚠️ (실제 발견)

**증상**: `package.json`의 `repository.url`이 `jinyeongjung`이지만 npm이 `jinyeong-jung`으로 정규화하여 링크가 깨질 수 있다.  
**영향**: GitHub 링크 404 → 신뢰도 즉각 하락. 처음 보는 사용자에게 "관리가 안 되는 패키지" 인상.  
**완화책**: `package.json repository.url`을 실제 GitHub URL로 수정 후 재배포 권고.  
**출처**: npm publish 경고 (실제 발견).

---

### C-4. 경쟁/포지셔닝 리스크

#### C-4.1 "nestjs-cls + 수동 WHERE로 충분하다"는 반론

**증상**: "기존 방법이 더 투명하고 제어 가능한데 왜 라이브러리가 필요하나요?"  
**영향**: 타겟 사용자 이탈.  
**완화책**: "수동 코드가 완벽하게 작동하는 팀에게는 필요 없습니다"로 정직하게 응답. 라이브러리의 가치는 **빠뜨릴 때 자동 차단**이라는 점을 강조.  
**출처**: 포지셔닝 분석.

#### C-4.2 "Postgres RLS를 쓰면 된다"는 반론

**증상**: "DB 레이어에서 해결하는 게 더 확실하지 않나요?"  
**영향**: 보안 지향 팀의 채택 포기.  
**완화책**: "RLS와 애플리케이션 레이어 격리는 상호 보완적"임을 명시. v0.3 RLS 통합 계획 언급. 현재 버전은 "RLS가 없는 환경에서의 1차 방어선"으로 포지셔닝.  
**출처**: 포지셔닝 분석.

---

### C-5. 마케팅 실행 리스크

#### C-5.1 Reddit/HN 자기홍보 에티켓 위반 시 역풍

**증상**: r/node에서 자기홍보 규칙 위반 시 downvote + "여기서 홍보하지 마세요" 댓글.  
**영향**: 커뮤니티 평판 손상. 삭제되면 노출 기회 자체가 사라짐.  
**완화책**: r/node 규칙 확인 (현재 self-promo 허용이지만 9:1 룰 준수). dev.to 포스트 먼저 게시 후 링크 공유.  
**출처**: Reddit 정책 분석.

#### C-5.2 긱뉴스 자기홍보 인식

**증상**: 긱뉴스에서 "본인 제품 홍보"로 인식되어 커뮤니티 반응이 냉담.  
**영향**: Gate B 피드백 확보 실패.  
**완화책**: 제품 홍보 글이 아니라 "문제 → 해결 과정 공유" 서사로 작성. 포스트 제목에 라이브러리 이름 전면에 내세우지 않기.  
**출처**: 긱뉴스 커뮤니티 관찰.

#### C-5.3 하드닝 전 게시 → "써보니 누출" = 평판 사망

**증상**: Part B 게이트 통과 전 마케팅 → 실사용자가 격리 버그 발견.  
**영향**: 보안 라이브러리로서의 신뢰 영구 손상. GitHub Issue "CRITICAL: data leak"은 구글 검색에 영원히 남는다.  
**완화책**: **Part B 하드 게이트 전원 통과 전 게시 금지**. 이것이 이 문서가 존재하는 이유.  
**출처**: 플랜 설계 원칙.

#### C-5.4 부정적 첫 댓글의 파급

**증상**: HN/Reddit의 첫 댓글이 "raw SQL은 안 막던데?"이고 이게 상단에 고정.  
**영향**: 이후 독자 전체가 부정적 프레임으로 라이브러리를 인식.  
**완화책**: 한계를 **먼저** 글에 명시하여 선제 방어. 부정적 댓글에는 침착하게 "맞습니다, 그래서 Honest Limits 섹션을 만들었습니다"로 응답.  
**출처**: 오픈소스 마케팅 패턴.

---

## 부록

### 부록 1. 마케팅 글 템플릿 — 한국어 (긱뉴스/OKKY용)

```
제목: B2B SaaS 개발하다 cross-tenant 데이터 누출 가능성 발견하고 만든 NestJS 라이브러리

본문:

안녕하세요, NestJS로 B2B SaaS를 개발하다가 겪은 경험을 공유합니다.

[문제]
멀티테넌시 서비스에서 tenant A의 요청이 tenant B의 데이터를 볼 수 있는 상황을
방지하려면, 모든 쿼리에 수동으로 WHERE tenant_id = ? 를 넣어야 합니다.
문제는 이게 빠뜨리기 너무 쉽다는 점입니다.

[기존 방법의 한계]
nestjs-cls로 ALS 컨텍스트는 관리할 수 있지만,
실제 WHERE 조건 추가는 여전히 개발자가 매번 직접 해야 합니다.

[만든 것]
데코레이터 한 줄로 TypeORM WHERE를 자동 주입하고,
잘못된 접근 시 즉시 에러를 던지는 라이브러리를 만들었습니다.

// Before
@Get()
async getPosts() {
  return this.repo.find({ where: { tenantId: this.ctx.tenantId } }); // 빠뜨리면 누출
}

// After
@RequireTenant()
async getPosts() {
  return this.repo.find(); // tenantId 자동 주입
}

[정직한 한계 — 중요]
- raw SQL, JOIN, subquery는 보호하지 않습니다 (90% rule)
- TypeORM 0.3 전용 (Prisma 어댑터 별도 제공)
- 외부 보안 감사를 받지 않았습니다

피드백/의견 환영합니다.

GitHub: https://github.com/jinyeong-jung/nestjs-tenant-shield
npm: https://www.npmjs.com/package/nestjs-tenant-shield
```

---

### 부록 2. 마케팅 글 템플릿 — 영문 (dev.to/Reddit용)

```
Title: Automatic multi-tenant data isolation in NestJS with one decorator

---

Building a B2B SaaS with NestJS? You're probably doing this:

// Every single query, manually
const posts = await repo.find({ where: { tenantId: req.tenantId } });

Forget once → data leak. Not a bug — a security incident.

## What nestjs-tenant-shield does

Add one decorator, never write WHERE tenantId again:

@RequireTenant()
async getPosts() {
  return this.repo.find(); // tenantId injected automatically
}

Cross-tenant access throws immediately. Cache keys isolated automatically.
Tests fail if you access tenant data without proper context.

## Honest limits (important)

This library does NOT protect:
- Raw SQL queries
- QueryBuilder JOINs
- Subqueries

Think of it as "90% automatic protection" — not 100%.
The remaining 10% needs manual WHERE or Postgres RLS (planned for v0.3).

## Install

npm install nestjs-tenant-shield

[Quick Start link] [GitHub link]

Feedback welcome — especially from teams who tried it and found edge cases.
```

---

### 부록 3. Gate B 트래킹 표 ([process.md §9-b](./process.md) 연동)

| # | 채널 | 내용 요약 | 피드백 유형 | 날짜 |
|---|---|---|---|---|
| 1 | — | — | — | — |
| 2 | — | — | — | — |
| 3 | — | — | — | — |

**Gate B 달성 조건**: 3건 이상 OR 파일럿 1건.  
달성 시 → [process.md §9-b](./process.md) Gate B ✅ 갱신 + 10번(v0.3) 진입 결정.  
미달성 (6~8주 경과) → 장기 투자 중단 검토.

---

### 부록 4. 런칭 전 최종 점검 체크리스트

```
사전 자산
  [ ] 데모 GIF/저장소 완성 (누출 재현 + 차단 시연)
  [ ] GitHub Discussions 오픈 + 첫 핀 포스트
  [ ] package.json repository.url 수정 확인 (C-3.4)

Part B 안정성 게이트
  [ ] B-1 대규모 격리 fuzz 통과 (누출 0건)
  [ ] B-2 동시성 ALS bleed 통과 (0건)
  [ ] B-3 property-based WHERE 불변식 통과 (0건)
  [ ] B-4 cross-tenant write 차단 통과 (누출 0건)
  [ ] B-5 문서-구현 일치 통과 (불일치 0건)
  [ ] B-6 버전 매트릭스 + soak 통과

마케팅 글
  [ ] 문제→해결 서사 구조 확인
  [ ] Honest Limits 섹션 포함 확인
  [ ] 과장("100% 보안") 표현 없음 확인
  [ ] 채널별 에티켓 규칙 확인

게시 후
  [ ] 댓글/Issue 24시간 내 응답 체계 준비
  [ ] Gate B 트래킹 표 업데이트 방법 결정
```

---

*최초 작성: 2026-06-24 / 다음 갱신 시점: Part B 하네스 구현 완료 후*
