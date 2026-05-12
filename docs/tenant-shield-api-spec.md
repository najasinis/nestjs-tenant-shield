# nestjs-tenant-shield — API Specification

> 작성일: 2026-05-09  
> 버전: v0.1  
> 라이브러리 사용자가 직접 호출하는 모든 API의 명세  

> 상태: **Draft API (구현 전)**. 아래 시그니처는 목표 인터페이스이며, 실제 export는 구현 진행에 따라 확정된다.

---

## 0. 빠른 참조

아래 표는 "현재 사용 가능 API"가 아니라 "v0.1 목표 API" 요약이다.

| API | 종류 | 설명 |
|---|---|---|
| `TenantShieldModule.forRoot(opts)` | 모듈 설정 | 앱 부팅 시 1회 호출 |
| `@RequireTenant(opts?)` | 데코레이터 | 클래스/메서드에 tenant 격리 적용 |
| `@SystemAction()` | 데코레이터 | tenant 없이 시스템 작업 실행 |
| `@Cacheable(opts)` | 데코레이터 | 메서드 결과 캐싱 (tenant 분리) |
| `@TenantContext(opts?)` | 데코레이터 | 큐 작업의 tenant 컨텍스트 (v0.2) |
| `getCurrentTenantId()` | 함수 | 현재 컨텍스트의 tenant ID 조회 |
| `runWithTenant(id, fn)` | 함수 | 명시적 tenant로 함수 실행 (테스트용) |
| `runWithoutTenant(fn)` | 함수 | tenant 없이 함수 실행 (시스템) |
| `MissingTenantContextError` | 에러 | 컨텍스트 누락 시 throw |
| `CrossTenantAccessError` | 에러 | cross-tenant 시도 시 throw |
| `InvalidTenantSourceError` | 에러 | 잘못된 source 설정 시 throw |

---

## 1. TenantShieldModule.forRoot()

### 시그니처

```typescript
class TenantShieldModule {
  static forRoot(options: TenantShieldOptions): DynamicModule;
  static forRootAsync(options: TenantShieldAsyncOptions): DynamicModule;  // v0.1.x 패치
}
```

### TenantShieldOptions

```typescript
interface TenantShieldOptions {
  /**
   * 멀티테넌시 패턴.
   * - 'discriminator': tenant_id 컬럼 기반 (v0.1 지원)
   * - 'schema': Postgres schema 분리 (v0.2)
   * - 'database': DB-per-tenant (v0.2)
   */
  strategy: 'discriminator' | 'schema' | 'database';

  /**
   * Entity의 tenant ID 컬럼 이름.
   * 예: 'tenantId' (NestJS 관습), 'spaceId' (슈퍼러닝), 'orgId' (Slack식)
   * 모든 tenant-aware entity가 이 컬럼을 가져야 함.
   */
  tenantIdField: string;

  /**
   * 요청에서 tenant ID를 어떻게 추출할지.
   * - 'header': HTTP 헤더에서 (예: x-tenant-id)
   * - 'jwt': JWT 페이로드의 claim에서
   * - 'subdomain': 서브도메인에서 (academy-a.example.com)
   * - 'custom': 사용자 제공 함수
   */
  tenantSource: 'header' | 'jwt' | 'subdomain' | 'custom';

  /**
   * tenantSource='header'일 때 헤더 이름. 기본 'x-tenant-id'.
   */
  headerName?: string;

  /**
   * tenantSource='jwt'일 때 JWT claim 이름. 기본 'tenant_id'.
   * JWT 추출 자체는 사용자 인증 미들웨어 책임.
   * request.user 또는 request.jwt에서 읽음.
   */
  jwtClaim?: string;

  /**
   * tenantSource='subdomain'일 때 패턴.
   * 예: '*.example.com' → 'academy-a.example.com'에서 'academy-a' 추출.
   */
  subdomainPattern?: string;

  /**
   * tenantSource='custom'일 때 사용할 함수.
   * 반환값이 null이면 컨텍스트 미설정.
   */
  customResolver?: (request: unknown) => string | null;

  /**
   * Strict mode (기본 true).
   * true: 컨텍스트 누락 또는 cross-tenant 시도 시 throw
   * false: 경고 로그만 남기고 계속 진행 (프로덕션 비권장)
   */
  strictMode?: boolean;

  /**
   * 시스템 작업 허용 (기본 false).
   * true: @SystemAction() 데코레이터로 tenant 없는 작업 가능
   * false: 모든 작업이 tenant 컨텍스트 필요
   */
  allowSystemActions?: boolean;

  /**
   * tenant 컨텍스트 적용 entity 목록.
   * 미지정 시 모든 entity에 tenantIdField가 있으면 자동 적용.
   */
  entities?: Function[];
}
```

### 사용 예시

#### 헤더 기반

```typescript
@Module({
  imports: [
    TenantShieldModule.forRoot({
      strategy: 'discriminator',
      tenantIdField: 'tenantId',
      tenantSource: 'header',
      headerName: 'x-tenant-id',
      strictMode: true,
    }),
  ],
})
export class AppModule {}
```

#### JWT 기반

```typescript
TenantShieldModule.forRoot({
  strategy: 'discriminator',
  tenantIdField: 'tenantId',
  tenantSource: 'jwt',
  jwtClaim: 'tenant_id',
  strictMode: true,
})
```

#### 서브도메인 기반

```typescript
TenantShieldModule.forRoot({
  strategy: 'discriminator',
  tenantIdField: 'workspaceId',
  tenantSource: 'subdomain',
  subdomainPattern: '*.yourapp.com',
})
```

#### 커스텀 추출

```typescript
TenantShieldModule.forRoot({
  strategy: 'discriminator',
  tenantIdField: 'orgId',
  tenantSource: 'custom',
  customResolver: (req: any) => {
    return req.user?.organizationId ?? null;
  },
})
```

### 도메인별 실전 예시 (`tenantIdField`는 자유)

`tenantIdField`는 회사/도메인 관습 그대로 사용 가능. 라이브러리는 컬럼명에 무관.

#### 학원 관리 SaaS

```typescript
TenantShieldModule.forRoot({
  strategy: 'discriminator',
  tenantIdField: 'spaceId',
  tenantSource: 'jwt',
  jwtClaim: 'spaceId',
})
```

#### 병원 관리 SaaS

```typescript
TenantShieldModule.forRoot({
  strategy: 'discriminator',
  tenantIdField: 'hospitalId',
  tenantSource: 'jwt',
  jwtClaim: 'hospital_id',
})
```

#### Slack 같은 팀 협업

```typescript
TenantShieldModule.forRoot({
  strategy: 'discriminator',
  tenantIdField: 'workspaceId',
  tenantSource: 'subdomain',
  subdomainPattern: '*.yourapp.com',
})
```

#### CRM (Salesforce식)

```typescript
TenantShieldModule.forRoot({
  strategy: 'discriminator',
  tenantIdField: 'orgId',
  tenantSource: 'header',
  headerName: 'x-org-id',
})
```

지원 가능 컬럼명 예: `tenantId`, `spaceId`, `hospitalId`, `workspaceId`, `orgId`, `accountId`, `companyId`, `clientId`, `customerId` 등.

---

## 2. @RequireTenant() 데코레이터

### 시그니처

```typescript
function RequireTenant(options?: RequireTenantOptions): MethodDecorator & ClassDecorator;

interface RequireTenantOptions {
  /**
   * 시스템 작업 허용. forRoot의 allowSystemActions와 무관하게 메서드별 허용.
   * 권장: 가능하면 false 유지.
   */
  allowSystem?: boolean;

  /**
   * Strict mode 메서드별 오버라이드.
   * 미지정 시 forRoot 설정 따름.
   */
  strictMode?: boolean;
}
```

### 동작

1. 메서드 호출 직전 AsyncLocalStorage에서 현재 tenant ID 조회
2. tenant ID 없고 strict mode면 `MissingTenantContextError` throw
3. ORM 쿼리에 자동 `WHERE tenantIdField = ?` 주입 (Subscriber 동작)
4. 메서드 결과로 받은 entity의 tenantIdField가 현재 tenant와 다르면 `CrossTenantAccessError` throw

### 사용 예시

```typescript
// 클래스 레벨 - 모든 메서드 자동 보호
@Injectable()
@RequireTenant()
export class StudentsService {
  async findAll() { /* 자동 WHERE tenant_id */ }
  async findOne(id: string) { /* 자동 */ }
  async create(dto: CreateStudentDto) { /* 자동 tenant_id 주입 */ }
}

// 메서드 레벨 - 특정 메서드만
@Injectable()
export class MixedService {
  @RequireTenant()
  async findStudents() { /* tenant 보호 */ }

  async getPublicStats() { /* tenant 보호 X */ }
}

// 시스템 작업 허용
@RequireTenant({ allowSystem: true })
async cleanupOldRecords() {
  // tenant 없이 호출 가능. 운영 작업용.
}
```

---

## 3. @SystemAction() 데코레이터

### 시그니처

```typescript
function SystemAction(): MethodDecorator;
```

### 동작

`@RequireTenant()`가 적용된 클래스/메서드에서 **명시적으로 tenant 없는 시스템 작업**을 표시.

`forRoot.allowSystemActions: true` 일 때만 실제 동작.

### 사용 예시

```typescript
@Injectable()
@RequireTenant()
export class MaintenanceService {
  @SystemAction()
  async runDailyCleanup() {
    // tenant 없이 실행. 모든 tenant의 만료 데이터 정리.
  }
}
```

---

## 4. @Cacheable() 데코레이터

### 시그니처

```typescript
function Cacheable(options: CacheableOptions): MethodDecorator;

interface CacheableOptions {
  /** TTL (초). 필수. */
  ttl: number;

  /** 캐시 키에 tenant prefix 자동 추가. 기본 false. */
  tenantScoped?: boolean;

  /** 커스텀 키 생성 함수. 미지정 시 method:args 자동 생성. */
  keyGenerator?: (args: unknown[]) => string;
}
```

### 동작

1. 메서드 호출 전 캐시 hit 체크
2. tenantScoped가 true면 캐시 키에 `${tenantId}:` prefix 자동
3. miss 시 메서드 실행 후 결과를 ttl 동안 캐시

### 사용 예시

```typescript
@Cacheable({ ttl: 300, tenantScoped: true })
async getStudentRoster() {
  return this.repo.find();
}
// 캐시 키 예: "academy-A:StudentsService.getStudentRoster:[]"
```

---

## 5. @TenantContext() 데코레이터 (v0.2)

### 시그니처

```typescript
function TenantContext(options?: TenantContextOptions): MethodDecorator;

interface TenantContextOptions {
  /** 큐 페이로드에서 tenant ID 추출 함수. 미지정 시 job.data.tenantId 사용. */
  extractFrom?: (job: unknown) => string;
}
```

### 동작

BullMQ/Bull 큐 프로세서에서 자동으로 tenant 컨텍스트 활성화.

### 사용 예시

```typescript
@Processor('reports')
export class ReportProcessor {
  @Process('monthly')
  @TenantContext()  // job.data.tenantId 자동 추출
  async generateMonthlyReport(job: Job<{ tenantId: string }>) {
    return this.studentsService.findAll();  // tenant 컨텍스트 자동
  }

  @Process('quarterly')
  @TenantContext({ extractFrom: (job) => job.data.organizationId })
  async generateQuarterly(job: Job) {
    /* ... */
  }
}
```

---

## 6. 헬퍼 함수

### getCurrentTenantId()

```typescript
function getCurrentTenantId(): string | null;
```

**용도**: 비즈니스 로직 안에서 현재 tenant 조회.

**반환**: 컨텍스트가 있으면 tenant ID, 없으면 null.

```typescript
@Injectable()
export class AuditService {
  async log(action: string) {
    const tenantId = getCurrentTenantId();
    await this.repo.save({ action, tenantId, occurredAt: new Date() });
  }
}
```

### runWithTenant(tenantId, fn)

```typescript
function runWithTenant<T>(
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T>;
```

**용도**: 명시적으로 tenant 컨텍스트로 함수 실행. **테스트와 시스템 작업에 사용.**

```typescript
// 테스트
it('A 학원 컨텍스트에서 A 학생만 조회', async () => {
  await runWithTenant('academy-A', async () => {
    const students = await service.findAll();
    expect(students.every(s => s.tenantId === 'academy-A')).toBe(true);
  });
});

// 시스템 작업 (모든 tenant 순회)
const tenants = await tenantRegistry.findAll();
for (const t of tenants) {
  await runWithTenant(t.id, async () => {
    await this.maintenanceService.cleanup();
  });
}
```

### runWithoutTenant(fn)

```typescript
function runWithoutTenant<T>(fn: () => Promise<T>): Promise<T>;
```

**용도**: tenant 없이 명시적 실행. `forRoot.allowSystemActions: true` 필요.

```typescript
await runWithoutTenant(async () => {
  await this.systemMaintenance.run();
});
```

---

## 6.1 시스템 작업 처리 — `@SystemAction` vs `runWithoutTenant`

### 결론 (한 줄)

- **`@SystemAction()`**: 메서드를 "이건 시스템 작업"이라고 **선언적**으로 표시.
- **`runWithoutTenant(fn)`**: 런타임에 "이번 호출은 tenant 없음"을 **절차적**으로 명시.

### 언제 어떤 걸 쓰나

| 상황 | 사용 도구 | 이유 |
|---|---|---|
| 메서드가 "항상" 시스템 작업 (예: 데이터베이스 정리) | `@SystemAction()` | 메서드 정의 시점에 명시. 코드 리뷰에서 즉시 인지 가능 |
| 런타임에 "이번만" tenant 없이 실행 (예: 모든 tenant 순회) | `runWithoutTenant()` | 호출 시점에 결정 |
| `@RequireTenant()` 적용된 클래스의 일부 메서드만 시스템 | `@SystemAction()` | 데코레이터로 "이 메서드는 예외" 명시 |
| 외부 라이브러리 호출 시 컨텍스트 차단 | `runWithoutTenant()` | 코드 라인 단위 제어 |

### 예시 1: `@SystemAction` (선언적, 메서드가 항상 시스템)

```typescript
@Injectable()
@RequireTenant()
export class StudentsService {
  async findAll() {
    return this.repo.find();  // tenant 필요
  }

  @SystemAction()  // ← "이 메서드는 항상 시스템"
  async cleanupExpiredRecords() {
    // tenant 없이 모든 만료 데이터 삭제
    return this.repo.delete({ expiredAt: LessThan(new Date()) });
  }
}

// 호출 시
await service.cleanupExpiredRecords();  // 정상 동작 (tenant 없어도 OK)
```

### 예시 2: `runWithoutTenant` (절차적, 호출 시점 결정)

```typescript
@Injectable()
@RequireTenant()
export class TenantsService {
  async findAll() {
    return this.repo.find();
  }
}

// cron 작업: 모든 tenant 순회하며 보고서 생성
@Injectable()
export class DailyReportJob {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly reportService: ReportService,
  ) {}

  async run() {
    // 1단계: 모든 tenant 목록 조회 (tenant 없이)
    const tenants = await runWithoutTenant(async () => {
      return this.tenantsService.findAll();
    });

    // 2단계: 각 tenant 컨텍스트로 진입해 보고서 생성
    for (const t of tenants) {
      await runWithTenant(t.id, async () => {
        await this.reportService.generateDailyReport();
      });
    }
  }
}
```

### 예시 3: 둘 다 함께 (혼합 패턴)

```typescript
@Injectable()
@RequireTenant()
export class MaintenanceService {
  // 메서드 자체는 시스템 작업
  @SystemAction()
  async runFullMaintenance() {
    // 내부에서 tenant별 작업 수행 시 runWithTenant 사용
    const tenants = await this.tenantRegistry.findAll();
    for (const t of tenants) {
      await runWithTenant(t.id, async () => {
        await this.cleanupForTenant();
      });
    }
  }

  @RequireTenant()
  private async cleanupForTenant() {
    return this.repo.delete({
      expiredAt: LessThan(new Date()),
    });
  }
}
```

### 안전성 비교

| 도구 | 안전성 | 이유 |
|---|---|---|
| `@SystemAction()` | 더 높음 | 정적 분석 가능, 코드 리뷰 시 즉시 인지 |
| `runWithoutTenant()` | 보통 | 런타임 결정, 코드 리뷰에서 놓치기 쉬움 |

권장: **가능하면 `@SystemAction()` 우선 사용.** `runWithoutTenant()`는 동적 시나리오에만.

### 양쪽 모두 공통: `forRoot.allowSystemActions: true` 필요

```typescript
TenantShieldModule.forRoot({
  // ...
  allowSystemActions: true,  // ← @SystemAction과 runWithoutTenant 둘 다 활성화
})
```

`false` (기본값)로 두면 둘 다 동작 안 함. 보안상 기본값 false가 안전.

---

## 6.2 ⚠️ 자동 보호의 한계 — 반드시 읽으세요

`nestjs-tenant-shield`의 자동 WHERE 주입은 **만능이 아닙니다.** 다음 케이스는 자동 보호가 동작하지 않으니 수동 처리 필요.

### 한계 1: Raw SQL

```typescript
// ❌ 자동 보호 안 됨
await this.repo.query('SELECT * FROM students');

// ✅ 수동 헬퍼
import { withTenantWhere } from 'nestjs-tenant-shield';
await this.repo.query(
  withTenantWhere('SELECT * FROM students', 'tenant_id')
);
```

### 한계 2: QueryBuilder의 복잡한 JOIN

TypeORM Subscriber는 메인 entity에는 자동 WHERE를 추가하지만, **JOIN되는 다른 테이블의 tenant_id 자동 보호는 보장하지 못합니다.**

```typescript
// ⚠️ 위험: students에는 자동 WHERE 추가되지만,
// classes 테이블의 tenant_id 검증은 자동 안 됨
await this.repo
  .createQueryBuilder('s')
  .leftJoinAndSelect('s.classes', 'c')  // ← classes도 tenant_id 필요한데
  .getMany();

// ✅ 안전: 명시적 JOIN 조건
await this.repo
  .createQueryBuilder('s')
  .leftJoinAndSelect(
    's.classes', 'c',
    'c.tenant_id = :tid',  // ← 명시적
    { tid: getCurrentTenantId() }
  )
  .getMany();
```

**사용자 가이드**: JOIN 시 항상 ON 절에 tenant_id 명시 권장. 라이브러리는 v0.2에서 JOIN ON 자동 보강 검토 중.

### 한계 3: Subquery

```typescript
// ⚠️ 위험: 외부 쿼리에는 WHERE 추가되지만,
// 서브쿼리 내부의 students에는 자동 WHERE 안 됨
await this.repo
  .createQueryBuilder('s')
  .where(qb => {
    const sub = qb.subQuery()
      .select('s2.id')
      .from('students', 's2')  // ← 서브쿼리의 students
      .where('s2.score > :score')
      .getQuery();
    return 's.id IN ' + sub;
  })
  .getMany();

// ✅ 안전: 서브쿼리에도 명시적 tenant_id
.where(qb => {
  const sub = qb.subQuery()
    .select('s2.id')
    .from('students', 's2')
    .where('s2.score > :score AND s2.tenant_id = :tid')
    .setParameter('tid', getCurrentTenantId())
    .getQuery();
  return 's.id IN ' + sub;
})
```

### 한계 4: TypeORM 외부 도구

- TypeORM Migration: 마이그레이션 SQL은 tenant 보호 X (모든 tenant 대상이 자연스러움).
- TypeORM CLI: CLI 명령은 컨텍스트 없음.
- pg-promise / knex 직접 사용: 라이브러리 우회.

### 한계 5: 멀티 데이터베이스 트랜잭션

여러 DataSource를 동시 사용하는 트랜잭션에서 컨텍스트 전파 검증 필요. v0.1엔 단일 DataSource만 보장.

### 한계 6: 동적 쿼리 빌더 (raw addParameters)

QueryBuilder가 아닌 raw 파라미터 결합 사용 시 보호 불가. QueryBuilder 사용 권장.

### 종합 안전 체크리스트

```
□ 모든 entity에 tenantIdField 컬럼 정의됨
□ Raw SQL은 withTenantWhere 헬퍼 사용
□ JOIN 시 ON 절에 tenant_id 명시
□ Subquery 시 서브쿼리에도 tenant_id 명시
□ Migration은 별도 검증 (모든 tenant 영향)
□ 멀티 DataSource 트랜잭션은 v0.1 사용 X (v0.2 대기)
□ 정기 cross-tenant 침투 테스트 (분기별)
□ Postgres RLS 활성화 (v0.3 통합 예정)
```

### 진실의 한 문장

> **nestjs-tenant-shield는 "흔한 사고의 90%를 자동 차단"하는 도구입니다.**
> **나머지 10%는 위 한계를 인지하고 수동 처리해야 합니다.**
> **만능 보안이 아니며, 다층 방어(defense in depth)의 한 층입니다.**

---

## 6.3 AsyncLocalStorage 컨텍스트 누락 케이스 ⚠️

Node.js 18+에서 AsyncLocalStorage는 native promises와 async/await에서 자동 전파되지만, **일부 비동기 패턴에서는 컨텍스트가 깨질 수 있습니다.**

### 대부분 안전

```typescript
// ✅ Promise.all — 자동 전파 OK
await Promise.all([
  service.findA(),
  service.findB(),
]);

// ✅ async iteration — 자동 전파 OK
for await (const item of stream) { /* ... */ }
```

### 검증 필요 / 명시적 캡처 권장

```typescript
// ⚠️ EventEmitter — 등록 시점과 emit 시점이 다른 컨텍스트
emitter.on('event', async () => {
  // 여기서 getCurrentTenantId()는 emit 시점의 컨텍스트
  // 등록 시점의 컨텍스트가 필요하면 명시적 캡처 필요
});

// ✅ 명시적 캡처 권장
const currentTenant = getCurrentTenantId();
emitter.on('event', async () => {
  await runWithTenant(currentTenant, async () => {
    // 안전 — 등록 시점 컨텍스트 보존
  });
});

// ⚠️ setImmediate / setTimeout — Node.js 18+ 자동 전파되지만 라이브러리에 따라 변동
setTimeout(async () => {
  // 검증 필요 — 안전하게 가려면 명시적 캡처
}, 1000);

// ⚠️ 큐 라이브러리 (Bull/BullMQ) — 작업이 다른 프로세스에서 실행될 수도 있음
// → v0.2의 @TenantContext()로 해결 예정
```

### 권장 패턴

비동기 경계가 의심스러우면 항상 진입 시점에 `getCurrentTenantId()`로 캡처 후 `runWithTenant`로 재진입.

---

## 7. 에러 타입

### MissingTenantContextError

```typescript
class MissingTenantContextError extends Error {
  constructor(message: string, public readonly source: string);
}
```

**언제 throw**: strict mode + tenant 컨텍스트 없는 메서드 호출.

**처리**: NestJS exception filter에서 잡아 500 또는 401 응답.

```typescript
try {
  await service.findAll();  // tenant 없이 호출
} catch (e) {
  if (e instanceof MissingTenantContextError) {
    // 인증/미들웨어 설정 점검
  }
}
```

### CrossTenantAccessError

```typescript
class CrossTenantAccessError extends Error {
  constructor(
    message: string,
    public readonly currentTenant: string,
    public readonly attemptedTenant: string,
    public readonly entityName?: string,
  );
}
```

**언제 throw**: 현재 tenant 컨텍스트와 다른 tenant_id의 entity가 반환됨.

**처리**: 즉시 실패 + 보안 알림. 일반적으로는 절대 발생 안 해야 함 (Subscriber가 자동 WHERE 주입하므로). 발생 시 코드 또는 어딘가의 escape hatch 점검.

```typescript
try {
  await service.findOne('some-id');
} catch (e) {
  if (e instanceof CrossTenantAccessError) {
    logger.error(`SECURITY: ${e.currentTenant} tried to access ${e.attemptedTenant}`);
    // 보안팀에 알림
  }
}
```

### InvalidTenantSourceError

```typescript
class InvalidTenantSourceError extends Error {
  constructor(message: string, public readonly source: string);
}
```

**언제 throw**: forRoot 설정 오류 (예: tenantSource='custom'인데 customResolver 미제공).

**처리**: startup 시 즉시 발생 → 앱 부팅 실패. 설정 점검.

---

## 8. AsyncLocalStorage 직접 접근 (고급)

대부분의 경우 필요 없음. 라이브러리 내부 동작 디버깅 또는 특수 케이스에서만.

```typescript
import { tenantContextStorage } from 'nestjs-tenant-shield';

// 현재 store 조회
const store = tenantContextStorage.getStore();
console.log(store?.tenantId);

// 새 컨텍스트로 실행 (runWithTenant 사용 권장)
tenantContextStorage.run({ tenantId: 'A' }, () => {
  // ...
});
```

⚠️ 직접 접근은 라이브러리 내부 구현 의존. 향후 시그니처 변경 가능. 일반적으로 `runWithTenant()` 권장.

---

## 9. TypeORM 통합 자동 동작

`TenantShieldModule.forRoot({ strategy: 'discriminator' })` 호출 시 라이브러리가 자동으로:

1. **TenantSubscriber 등록** - 모든 SELECT/UPDATE/DELETE 쿼리 감시
2. **beforeQuery hook** - QueryBuilder에 `andWhere('tenantIdField = :tid')` 자동 추가
3. **afterLoad hook** - 로드된 entity의 tenantIdField 검증
4. **beforeInsert hook** - INSERT 시 tenantIdField 자동 설정 (현재 컨텍스트에서)

사용자는 **추가 설정 없음**. forRoot 한 번이면 끝.

⚠️ 단, **Raw SQL** 직접 호출은 자동 보호 X:

```typescript
// 보호됨
await this.repo.find();

// 보호 X (raw SQL 사용 시 수동 체크 필요)
await this.repo.query('SELECT * FROM students');

// 권장: raw SQL 사용 시 헬퍼
import { withTenantWhere } from 'nestjs-tenant-shield';
await this.repo.query(
  withTenantWhere('SELECT * FROM students', 'tenant_id')
);
```

---

## 10. 버전별 API 가용성

| API | v0.1 | v0.2 | v0.3 |
|---|---|---|---|
| TenantShieldModule.forRoot | ✅ | ✅ | ✅ |
| TenantShieldModule.forRootAsync | (v0.1.x) | ✅ | ✅ |
| @RequireTenant | ✅ | ✅ | ✅ |
| @SystemAction | ✅ | ✅ | ✅ |
| @Cacheable | ✅ | ✅ | ✅ |
| @TenantContext (큐) | ❌ | ✅ | ✅ |
| getCurrentTenantId | ✅ | ✅ | ✅ |
| runWithTenant | ✅ | ✅ | ✅ |
| runWithoutTenant | ✅ | ✅ | ✅ |
| TypeORM Subscriber | ✅ | ✅ | ✅ |
| Prisma 어댑터 | ❌ | ✅ | ✅ |
| Schema 패턴 | ❌ | ✅ | ✅ |
| Database 패턴 | ❌ | ✅ | ✅ |
| Postgres RLS 자동 설정 | ❌ | ❌ | ✅ |
| GraphQL DataLoader | ❌ | ❌ | ✅ |
| Mongoose 어댑터 | ❌ | ❌ | ✅ |

---

## 11. 변경 이력

| 버전 | 일자 | 변경 |
|---|---|---|
| v0.1 | 2026-05-09 | 초안 |
