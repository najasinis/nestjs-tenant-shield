# 멀티테넌시 한눈에 보기

README가 사용법의 기준 문서입니다. 여기서는 개념을 쉽게 풀어서 설명합니다.

> 현재 상태 안내: 이 문서는 구현 완료 문서가 아니라 제품 방향을 맞추기 위한 입문 설명이다.
> 실제 경쟁력은 구현 코드, 테스트, 외부 도입 증거가 확보되어야 검증된다.

## 1. 한 줄 정의

여러 고객사(tenant)가 하나의 SaaS 앱을 함께 쓰지만, **각 고객 데이터는 절대 섞이지 않게** 만드는 설계.

## 2. 쉬운 비유

하나의 아파트에 여러 가구가 살 때:

- 아파트 전체 = 하나의 앱
- 각 가구 = 각 고객사(tenant)
- 각 가구의 집 안 = 그 고객사의 데이터

멀티테넌시는 "같은 아파트를 쓰지만 섞이지 않게" 만드는 규칙입니다.

## 3. 왜 필요한가

- 비용 절감: 고객마다 앱을 따로 만들면 너무 비쌈
- 운영 쉬움: 업데이트를 한 번에 배포 가능, 문은 절대 섞이지 않게 관리
- 하지만 위험: 문을 잘못 열면 다른 고객 데이터가 보임

## 4. 멀티테넌시 3가지 패턴 (비교표)

| 패턴 | 설명 | 장점 | 단점 | 난이도 |
|---|---|---|---|---|
| Database per Tenant | 고객사마다 DB를 따로 둠 | 가장 안전, 격리 강함 | 비용 높음, 운영 복잡 | 중간 |
| Schema per Tenant | 같은 DB, 스키마만 분리 | 비용과 안전의 중간 | 스키마 관리 복잡 | 높음 |
| Discriminator | 같은 테이블, `tenant_id`로 구분 | 가장 흔함, 비용 낮음 | 실수 시 누출 위험 큼 | 낮음 |

이 프로젝트는 v0.1에서 **Discriminator** 패턴을 핵심으로 합니다.

## 5. 실패 시나리오 (가장 흔한 사고)

### 5.1 쿼리에서 tenant 조건 누락

```typescript
// 위험: tenantId를 빼먹으면 다른 고객 데이터가 섞임
return this.repo.find({ where: { id } });
```

### 5.2 캐시 키에 tenant prefix 누락

```typescript
// 위험: 서로 다른 고객이 같은 캐시를 공유
return this.cache.get(`roster`);
```

### 5.3 백그라운드 작업에서 컨텍스트 유실

```typescript
// 위험: 어떤 tenant로 실행 중인지 잊어버림
await doBackgroundJob();
```

## 6. 쉬운 예시 코드

### 6.1 안전하지 않은 코드

```typescript
// 매번 tenantId를 직접 넘겨야 함
async findAll(tenantId: string) {
	return this.repo.find({ where: { tenantId } });
}
```

### 6.2 안전한 코드 (목표 API)

```typescript
@RequireTenant()
export class StudentsService {
	async findAll() {
		return this.repo.find();
	}
}
```

핵심은 "개발자가 tenantId를 매번 쓰지 않아도 자동으로 안전하게" 하는 것입니다.

## 7. 자주 묻는 질문 (FAQ)

### Q1. 멀티테넌시가 꼭 필요할까?
대부분의 B2B SaaS는 여러 고객이 같은 앱을 쓰기 때문에 필요합니다.

### Q2. 왜 Discriminator가 위험하다고 하나요?
한 테이블에 여러 고객 데이터가 섞여 있으니, 조건 하나 빠지면 바로 누출됩니다.

### Q3. Database per Tenant가 가장 안전한데 그걸 쓰면 되지 않나요?
맞지만 비용과 운영 복잡도가 매우 높습니다. 작은 팀이나 초기 서비스엔 부담입니다.

### Q4. 캐시는 왜 위험한가요?
캐시 키가 같으면 다른 고객이 같은 결과를 보게 됩니다. 그래서 tenant prefix가 필요합니다.

### Q5. 백그라운드 작업은 왜 더 위험한가요?
HTTP 요청이 끝나면 컨텍스트가 끊기기 쉽습니다. 그래서 별도 컨텍스트 복원이 필요합니다.

### Q6. 이 문서만 보면 바로 사용할 수 있나요?
아니요. 현재는 설계 단계 문서입니다. 사용법은 README를 기준으로 확인해야 합니다.

## 8. 핵심 요약

- 멀티테넌시는 "같은 앱, 다른 고객 데이터"를 안전하게 분리하는 설계입니다.
- 가장 흔한 방식은 Discriminator이며, 실수하면 사고가 발생합니다.
- 이 프로젝트는 그 실수를 자동으로 막는 것을 목표로 합니다.

## 9. 더 읽을 거리

- README: 사용법/예제/빠른 시작
- docs/tenant-shield-api-spec.md: API 상세 명세
- docs/tenant-shield-PRD.md: 설계/로드맵/배경

---

## 10. 실패 유형별 분석

> 이 섹션은 이 프로젝트가 실제로 실패할 수 있는 경우와 그 원인, 해결책을 정리한다.
> §5가 "데이터 누출 사고"라면, 여기는 "프로젝트/라이브러리 자체가 실패하는 이유"다.

---

### 10.1 기술 실패 — 코드가 실제 환경에서 다르게 동작

#### SQLite ↔ PostgreSQL 동작 차이

**무엇이 문제인가**

e2e 테스트 전체가 SQLite in-memory 기반이다. 실제 사용자는 거의 PostgreSQL을 쓴다.
두 DB는 파라미터 바인딩, 데이터 타입, 잠금 방식이 다르고, TypeORM도 DB별로 QueryBuilder 내부 동작을 다르게 처리한다.
`WHERE tenant_id = ?` 자동 주입이 SQLite에선 작동해도 PostgreSQL에서 다르게 동작할 수 있다.

**실패 시나리오**

누군가 PostgreSQL 프로젝트에 라이브러리를 붙였는데 tenant 격리가 안 됨 → 데이터 누출 → 신뢰 붕괴.

**해결책**

CI에 PostgreSQL Docker 컨테이너 e2e 추가. 최소 핵심 시나리오(자동 WHERE 주입, cross-tenant 차단) 1개라도 실 DB로 검증.

---

#### Prototype Patch 전역 상태 오염

**무엇이 문제인가**

`SelectQueryBuilder.prototype`, `Repository.prototype`을 monkey-patch할 때 모듈 수준 변수(`patchedTenantField`)가 프로세스 전역에 유지된다.

```typescript
// tenant.subscriber.ts
let patchedTenantField: string | null = null; // 한 번 설정되면 프로세스 내 영구
```

테스트에서 cleanup 없이 다음 테스트로 넘어가면 이전 패치가 오염된 채 남는다.
TypeORM이 버전업으로 내부 메서드 이름을 바꾸면 패치가 무효화되는데 **에러 없이** 조용히 WHERE 주입이 빠진다. 이게 가장 나쁜 패턴이다.

**해결책**

- `unpatch()` 함수 추가, e2e `afterAll`에서 반드시 호출
- TypeORM 버전 범위를 `package.json`에 고정하고 버전 올릴 때마다 e2e 재검증 필수
- "패치 성공" 로그를 bootstrap 시 출력해서 silent fail 방지

---

#### Raw SQL 구멍

**무엇이 문제인가**

`queryRunner.query()`, `createQueryBuilder().getQuery()` 등 raw SQL 경로에는 `WHERE tenant_id` 자동 주입이 안 된다.
"데코레이터 한 줄로 격리"가 핵심 약속인데, raw SQL에서 조용히 깨진다.
개발자가 이 사실을 모르면 데이터 누출을 만들고도 원인을 못 찾는다.

**해결책**

- tenant context가 있는 상태에서 raw SQL 실행 시 경고 로그 강제 출력
- README에 "이것은 자동 보호가 안 됩니다" 섹션 bold 강조
- `raw-sql.helper.ts`에 수동 tenant 체크 헬퍼 제공

---

### 10.2 프로젝트 실패 — 완성 못 하거나 의미 없이 늦어짐

#### npm publish 시점 불명확

**무엇이 문제인가**

현재 To-Do 순서가 `2-b → 2-c(BullMQ) → 2-d(Prisma) → 3 → 4 → 5(publish)`다.
PRD §7에서 BullMQ(v0.2), Prisma(v0.2)를 이미 v0.1 범위 제외로 못 박았는데, process.md To-Do 2번 안에 2-c, 2-d가 포함되어 있다.
이 상태로 가면 2-c, 2-d, 3, 4를 다 끝낼 때쯤 다른 라이브러리가 먼저 npm에 올라와 있을 수 있다.

**해결책**

지금 당장 결정해야 할 질문: **"2-c, 2-d 없이 v0.1 publish 가능한가?"**
PRD §7이 이미 YES라고 했다. 그렇다면 2-b 완료 후 4번(DX 최소 검토) → 5번(publish)으로 직행하는 경로를 process.md에 명시해야 한다.

---

#### /eval 미실행 → 개선 루프 작동 안 함

**무엇이 문제인가**

`~/.claude/evaluations.md`가 현재 0줄이다. workflow.md에 "매 작업 후 /eval"이라고 명시했지만 한 번도 실행된 적 없다.
결과적으로 docs/critical-notes.md와 docs/claude.md가 실제 데이터 없이 만들어진 초기 추측 문서에 머물러 있다.
4건 이상 반복 패턴 → 규칙 격상 루프가 이론으로만 존재한다.

**해결책**

지금 당장 `/eval` 1회 실행. 5분이다. 없으면 하네스 전체가 장식이다.

---

### 10.3 제품 실패 — 만들어도 안 쓰이는 경우

#### 첫 5분 DX가 나쁠 경우

**무엇이 문제인가**

`allowSystemActions: false`가 기본인데 개발자가 `@SystemAction()`을 써도 동작이 안 되면 에러 메시지만 보인다.
현재 에러 메시지에 "왜 안 되는지 + 어떻게 고치는지"가 충분히 담겨있지 않다.
라이브러리 adoption에서 첫 5분이 전부다. 에러 메시지에서 해결책을 못 찾으면 README 읽기 전에 삭제한다.

**해결책**

publish 전에 최소한 `MissingTenantContextError`에 "힌트: forRoot.allowSystemActions 설정을 확인하세요" 수준의 안내 문구 추가. DX To-Do 4번 전체를 기다릴 필요 없다.

---

#### Examples가 실제로 실행되는지 미확인

**무엇이 문제인가**

`examples/academy-saas/`, `examples/redis-cache/`가 있지만 실제로 `npm install && npm run start`를 해봤다는 기록이 없다.
publish 후 누군가 examples를 따라했는데 실행이 안 되면 첫인상이 끝난다.

**해결책**

publish 체크리스트에 "examples 직접 실행 확인" 추가. README의 빠른 시작이 examples 코드와 일치하는지도 같이 점검.

---

### 10.4 종합 우선순위

| 우선순위 | 문제 | 액션 | 소요 |
|---|---|---|---|
| **즉시** | /eval 0건 | `/eval` 지금 실행 | 5분 |
| **즉시** | v0.1 scope 미결정 | "2-c, 2-d 없이 publish 가능한가?" 결정 | 의사결정 |
| **2-b 전** | 에러 메시지 | `MissingTenantContextError` 힌트 문구 추가 | 30분 |
| **2-b 완료 후** | PostgreSQL e2e | Docker PG로 핵심 시나리오 1개 검증 | 반나절 |
| **publish 전** | examples 실행 검증 | 직접 실행 | 1시간 |
| **publish 전** | raw SQL 경고 로그 | 경고 로그 또는 README bold 경고 | 30분 |
| **중기** | Prototype patch cleanup | `unpatch()` + afterAll 가이드 | 1~2시간 |

> 가장 큰 위험은 코드가 아니라 **publish 시점이 불명확하다**는 것이다.
> 기술적 문제들은 수정 가능하다. 출시 시점을 못 잡으면 시장 기회를 잃는다.