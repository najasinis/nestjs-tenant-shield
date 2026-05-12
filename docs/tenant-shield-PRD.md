# nestjs-tenant-shield — PRD

> 작성일: 2026-05-09  
> 버전: v0.1  
> 라이선스: MIT  
> 패키지명: `nestjs-tenant-shield` (단일 모듈, 시리즈 X)  

> 상태: **Draft (설계 단계)**. 구현/검증/외부 도입 증거는 아직 축적 전.

---

## 0. 한 줄 요약

NestJS B2B SaaS 백엔드에 데코레이터 한 줄만 붙이면, **자동으로 tenant(고객사)별 데이터 격리가 적용되어 데이터 누출 사고를 사전 차단**하는 라이브러리.

핵심 단어 4가지:
- **선언적**: `@RequireTenant()` 한 줄로 격리 보장
- **자동 쿼리 인터셉션**: ORM 쿼리에 자동으로 `WHERE tenant_id = ?` 주입
- **다층 격리**: DB 쿼리 + Redis 캐시 키 + 백그라운드 작업 모두 자동 분리
- **테스트 강제**: 실수로 다른 tenant 접근 시 즉시 throw하는 안전장치 내장

### 0.1 현실 체크 (현재 시점)

- 현재 저장소는 구현 코드보다 문서가 앞선 상태다.
- 시장 차별성은 컨셉 레벨에서 확인되지만, 구현 차별성은 아직 증명 전이다.
- 따라서 본 PRD의 1차 목적은 "기획 완성"이 아니라 "검증 가능한 실행"이다.

---

## 1. 왜 만드는가

### 1.1 풀려는 문제

B2B SaaS 백엔드 개발자가 매번 처음부터 짜는 멀티테넌시 코드. 그리고 그게 잘못되면 일어나는 데이터 누출 사고.

#### 현재 NestJS의 일반적 구현 (지저분하고 위험)

```typescript
async findAll(tenantId: string) {
  return this.repo.find({ where: { tenantId } });
}

async findOne(tenantId: string, id: string) {
  return this.repo.findOne({ where: { id, tenantId } });
}

async getCachedRoster(tenantId: string) {
  return this.cache.get(`roster:${tenantId}`);
}
```

문제:
- 메서드마다 `tenantId` 수동 명시 → 빠뜨리면 데이터 누출
- 캐시 키 prefix 빠뜨리면 다른 tenant 캐시 hit
- 백그라운드 큐에서 tenant 컨텍스트 잃기 쉬움

### 1.2 시장 조사 - 빈자리 검증 (2026-05 기준)

기존 NestJS 멀티테넌시 라이브러리:

| 라이브러리 | 패턴 | 활성도 | 한계 |
|---|---|---|---|
| nestjs-cls | 범용 AsyncLocalStorage | 활성, 별 ~600 | 멀티테넌시 특화 X |
| @needle-innovision/nestjs-tenancy | Mongoose DB-per-tenant | 정체 | Mongo only |
| nestjs-tenancy (Sequelize) | Sequelize | 4년 전 | 사용자 0 |
| @nestjs-multitenant/typeorm | TypeORM DB-per-tenant | 10개월 전 | DB 분리만, auto WHERE 없음 |
| @codegyn/nestjs-tenant | 일반 | 4년 전 | 정체 |

**진짜 빈자리** (사실 검증):
- Discriminator 패턴 (tenant_id 컬럼) + 자동 WHERE 주입 → NestJS에서 표준 라이브러리 없음
- 데코레이터 한 줄로 캐시 키 자동 분리 → 없음
- 테스트 시 다른 tenant 접근 자동 감지 → 없음
- 백그라운드 작업의 tenant 컨텍스트 자동 전파 → 부분만 있음

### 1.3 차별화

| 기능 | nestjs-cls | nestjs-tenancy류 | nestjs-tenant-shield |
|---|---|---|---|
| AsyncLocalStorage 컨텍스트 | ✅ | 부분 | ✅ |
| Discriminator 자동 WHERE 주입 | ❌ | ❌ | ✅ 핵심 |
| Database/Schema 분리 | ❌ | ✅ | ✅ (v0.2) |
| Redis 캐시 키 자동 분리 | ❌ | ❌ | ✅ |
| 백그라운드 작업 컨텍스트 전파 | 부분 | ❌ | ✅ |
| 테스트 시 cross-tenant 자동 차단 | ❌ | ❌ | ✅ 핵심 |
| Postgres RLS 통합 (v0.3) | ❌ | ❌ | ✅ |

주의: 위 표는 "목표 기능 기준"이다. 실제 경쟁력 평가는 구현 완료 및 테스트 증거 확보 후 다시 수행한다.

---

## 2. 핵심 개념

상세 비유는 별도 `multi-tenant-explainer.md` 참조.

- 멀티테넌시 패턴 3가지: Database per Tenant / Schema per Tenant / **Discriminator** (v0.1 핵심)
- AsyncLocalStorage: Node.js 동시성 핵심
- Cross-tenant 누출: A tenant가 B tenant 데이터 접근 → 자동 차단

---

## 3. 설계 원칙

1. 자동화 우선: tenant_id 수동 명시는 escape hatch
2. Fail-Loud: cross-tenant 시도 시 즉시 throw
3. 다층 방어: ORM + 캐시 + 큐 + DB RLS
4. 테스트 강제: 라이브러리가 cross-tenant 시도 자체 감지
5. 점진적 채택: 한 모듈씩 적용 가능
6. ORM 중립: TypeORM v0.1, Prisma v0.2
7. 성능 비차단: AsyncLocalStorage 오버헤드 1ms 이내

---

## 4. 제품 개요

| 항목 | 내용 |
|---|---|
| 이름 | nestjs-tenant-shield |
| 한 줄 요약 | NestJS B2B SaaS의 자동 멀티테넌시 격리 |
| 목적 | 데이터 누출 사고 사전 차단 + 코드 깨끗 |
| 타겟 | NestJS B2B SaaS 개발자 (학원/병원/CRM/팀 협업 등) |
| 라이선스 | MIT |
| 시리즈 | 단일 모듈로 시작. v0.1 성공 시 그때 시리즈화 결정. |

---

## 5. 핵심 기능

### F-01 @RequireTenant() 데코레이터

적용 위치:
- 클래스 레벨: 모든 public 메서드
- 메서드 레벨: 특정 메서드만

동작:
1. 메서드 호출 전 현재 tenant 컨텍스트 확인
2. 컨텍스트 없으면 MissingTenantContextError throw
3. ORM 쿼리에 자동 WHERE tenant_id 주입
4. 결과 row의 tenant_id 검증 (strict mode)

### F-02 TenantShieldModule.forRoot()

```typescript
interface TenantShieldOptions {
  strategy: 'discriminator' | 'schema' | 'database';  // v0.1은 discriminator
  tenantIdField: string;  // 'tenantId', 'spaceId', 'orgId'
  tenantSource: 'header' | 'jwt' | 'subdomain' | 'custom';
  
  headerName?: string;
  jwtClaim?: string;
  subdomainPattern?: string;
  customResolver?: (request: unknown) => string | null;
  
  strictMode?: boolean;        // 기본 true
  allowSystemActions?: boolean; // 기본 false
}
```

### F-03 AsyncLocalStorage 컨텍스트

```typescript
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = this.resolveTenantId(req);
    asyncLocalStorage.run({ tenantId }, () => next());
  }
}

export function getCurrentTenantId(): string | null { /* ... */ }
```

### F-04 TypeORM Subscriber (자동 WHERE 주입)

핵심 기술 영역.

```typescript
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  beforeQuery(event: QueryEvent) {
    const tenantId = getCurrentTenantId();
    if (!tenantId && strictMode) throw new MissingTenantContextError();
    
    if (event.queryBuilder) {
      event.queryBuilder.andWhere('tenant_id = :tid', { tid: tenantId });
    }
  }
  
  afterLoad(entity: any) {
    if (entity.tenantId !== getCurrentTenantId()) {
      throw new CrossTenantAccessError();
    }
  }
}
```

### F-05 캐시 키 자동 분리

```typescript
@Cacheable({ ttl: 300, tenantScoped: true })
async getStudents() { /* ... */ }
// 캐시 키 = `${tenantId}:students:method:args` 자동
```

### F-06 큐 작업 컨텍스트 전파 (v0.2)

BullMQ/Bull 통합. enqueue 시 tenant_id 자동 첨부.

### F-07 테스트 헬퍼

```typescript
await runWithTenant('academy-A', async () => {
  await service.findAll();
});
```

---

## 6. 데이터 모델

라이브러리 자체는 데이터 저장 X. 사용자 entity에 tenant_id 컬럼만 요구.

```typescript
@Entity()
export class Student {
  @PrimaryGeneratedColumn()
  id: number;
  
  @Column()
  tenantId: string;
  
  @Column()
  name: string;
}
```

---

## 7. 범위 제외 (v0.1)

1. Schema/Database 격리 패턴 → v0.2
2. Postgres RLS 자동 설정 → v0.3
3. Prisma 어댑터 → v0.2
4. Mongoose 어댑터 → v0.3
5. Bull/BullMQ 통합 → v0.2
6. GraphQL 데이터로더 통합 → v0.3
7. 자동 마이그레이션 도구 → 백로그

---

## 8. 마일스톤

- v0.0.1 (Week 1): Foundation - 인터페이스, AsyncLocalStorage, 미들웨어
- v0.0.2 (Week 2): Core Decorator - @RequireTenant, resolver
- v0.0.3 (Week 3): TypeORM Subscriber 핵심 - 자동 WHERE, afterLoad 검증
- v0.0.4 (Week 4): 캐시 + 테스트 헬퍼
- v0.0.5 (Week 5): Strict mode + examples
- v0.1.0 (Week 6): README + npm publish + 공개

총 6주. 매일 1시간 × 42일.

### 8.1 Go / No-Go 게이트

- Gate A (4주): 최소 동작 버전 + 통합 테스트가 없으면 범위 축소
- Gate B (6~8주): 외부 피드백 3건 또는 파일럿 1건 없으면 장기 투자 중단 검토
- Gate C (배포 전): README 예시와 실제 구현 불일치 항목 0건

---

## 9. 보안 고려사항

### 9.1 정직한 한계 명시

README와 SECURITY.md에 다음 메시지 명시:

> **nestjs-tenant-shield는 "흔한 사고의 90%를 자동 차단"하는 도구입니다.**
> **나머지 10%는 아래 한계를 인지하고 수동 처리해야 합니다.**
> **만능 보안이 아니며, 다층 방어(defense in depth)의 한 층입니다.**

함께 적용해야 진정한 보안:
- DB 레벨 접근 권한 최소화
- SQL 직접 실행(raw query) 시 수동 tenant 체크
- 정기 cross-tenant 침투 테스트
- Postgres RLS 활성화 (v0.3 통합 예정)

### 9.2 strict mode가 기본

cross-tenant 시도 시 throw가 기본. 비활성화 가능하나 권장 X.

### 9.3 시스템 작업 처리

cron 같은 시스템 작업은 tenant 없이 실행 필요. `allowSystemActions: true` + `@SystemAction()` 명시 시에만 허용.

상세 가이드(@SystemAction vs runWithoutTenant 선택 기준)는 API Spec §6.1 참조.

### 9.4 GDPR/PIPA - Tenant 데이터 삭제

```typescript
// v0.2
await tenantService.purgeTenant('academy-A');
```

### 9.5 자동 보호의 한계 (반드시 README/SECURITY.md에 명시) ⭐

자동 WHERE 주입이 동작하지 **않는** 케이스:

| # | 케이스 | 완화책 |
|---|---|---|
| 1 | Raw SQL (`repo.query`) | `withTenantWhere` 헬퍼 |
| 2 | QueryBuilder의 복잡한 JOIN | ON 절에 tenant_id 명시 |
| 3 | Subquery 내부 | 서브쿼리에 tenant_id 명시 |
| 4 | TypeORM Migration / CLI | 별도 검증 (모든 tenant 영향) |
| 5 | 멀티 DataSource 트랜잭션 | v0.1 미보장 (v0.2 대기) |
| 6 | 동적 raw addParameters | QueryBuilder 사용 권장 |

상세 예시는 API Spec §6.2 참조.

### 9.6 AsyncLocalStorage 컨텍스트 누락

Node.js 18+에서 native promises/async-await는 자동 전파되지만, EventEmitter, setTimeout 등 일부 패턴에서 컨텍스트가 깨질 수 있음. 의심스러우면 진입 시점에 `getCurrentTenantId()` 캡처 후 `runWithTenant`로 재진입 권장.

상세는 API Spec §6.3 참조.

---

## 10. 실패 모드 분석

| # | 실패 모드 | 영향 | 완화책 |
|---|---|---|---|
| 1 | tenant 컨텍스트 누락 | 쿼리 실패 (strict) | startup 검증 + 명확한 에러 |
| 2 | Subscriber 미적용 entity | 자동 WHERE 안 됨 → 누출 위험 | entity 스캔 + 경고 |
| 3 | Raw SQL 사용 | WHERE 자동 주입 불가 | README 경고 + 수동 헬퍼 |
| 4 | 큐 작업의 tenant 잃음 | 잘못된 tenant로 처리 | @TenantContext() 강제 |
| 5 | AsyncLocalStorage 컨텍스트 누락 | 컨텍스트 깨짐 | NodeJS 18+ 자동 전파, 가이드 |
| 6 | 동시성 race condition | 컨텍스트 섞임 | AsyncLocalStorage 본질적 안전 |
| 7 | tenant_id 변조 (header) | 다른 tenant 가장 | 인증 미들웨어와 통합 가이드 |

---

## 10.1 성능 벤치마크 (목표 + 측정 가이드)

### 목표 (v0.1)

| 항목 | 목표 오버헤드 |
|---|---|
| `@RequireTenant` 데코레이터 (메서드당) | < 0.5 ms |
| TypeORM Subscriber `beforeQuery` (쿼리당) | < 0.5 ms |
| TypeORM Subscriber `afterLoad` (row당) | < 0.1 ms |
| AsyncLocalStorage 접근 (요청당) | < 0.1 ms |
| **총 typical 요청 오버헤드** | **< 1 ms** |

### 측정 방법 (v0.1.0 출시 전 실측)

```typescript
// 1. 기준선 (라이브러리 미적용)
async function baselineFind() {
  return repo.find({ where: { tenantId: 'A' } });
}

// 2. 라이브러리 적용
async function withShield() {
  return runWithTenant('A', () => repo.find());
}

// 3. autocannon 또는 k6로 100k 요청 측정
// 결과 → README "Performance" 섹션에 채울 것
```

### 출시 시 README에 명시할 형식 (예시)

```
벤치마크 (v0.1.0 measured):
- @RequireTenant 데코레이터 오버헤드: ~0.X ms (메서드당)
- TypeORM Subscriber 오버헤드: ~0.X ms (쿼리당)
- AsyncLocalStorage 오버헤드: ~0.X ms (요청당)
- 총 오버헤드: ~X ms (typical 요청)

측정 환경: Node.js 20.x, MacBook M2, in-memory SQLite
```

미측정값을 추측으로 채우지 말 것 — 정직성 위배.

---

## 11. 의존성

peer (필수):
- @nestjs/common (^10 || ^11)
- @nestjs/core (^10 || ^11)
- rxjs (^7)
- reflect-metadata (^0.1.13 || ^0.2)

peer (선택, 사용자 ORM):
- typeorm (^0.3, v0.1)
- @prisma/client (^5, v0.2)

dependencies (자체): 0개. AsyncLocalStorage는 Node.js 내장.

---

## 12. 버전 정책

- v0.x: API 변경 가능
- v1.0: semver 엄격
- v0.2+ 어댑터 분리 검토: nestjs-tenant-shield-typeorm, nestjs-tenant-shield-prisma

---

## 13. 변경 이력

| 버전 | 일자 | 변경 |
|---|---|---|
| v0.1 | 2026-05-09 | 초안. @guardrail/multi-tenant 시리즈에서 nestjs-tenant-shield 단일 패키지로 전환. |
| v0.1-draft.1 | 2026-05-10 | 현실 상태 명시(설계 단계), Go/No-Go 검증 게이트 추가. |
