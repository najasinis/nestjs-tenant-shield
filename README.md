# nestjs-tenant-shield

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NestJS](https://img.shields.io/badge/NestJS-v10%2B-red)](https://nestjs.com/)

> NestJS B2B SaaS 백엔드의 데이터 격리를 데코레이터 한 줄로 자동화하는 라이브러리. Cross-tenant 데이터 누출 사고를 사전 차단하고, 코드를 깨끗하게 유지합니다.

## ⚠️ 현재 상태 (솔직한 안내)

- 이 저장소는 현재 **설계/스펙 단계**입니다.
- `docs/`, `claude/` 문서가 먼저 정리된 상태이며, **실제 배포 가능한 패키지 코드는 아직 없습니다**.
- 즉, 지금은 "차별적인 제품"보다 "차별적인 설계"에 가까운 단계입니다.

이 README의 코드 예시는 **목표 API**를 설명하기 위한 것이며, 현재 바로 설치해서 실행 가능한 상태를 보장하지 않습니다.

## 🎯 왜 만들었나요?

### B2B SaaS의 가장 무서운 사고: 데이터 누출

```
하나의 학원 관리 SaaS  =  여러 학원이 입주한 빌딩
  - A학원: 강남 지점
  - B학원: 종로 지점
  - C학원: 부산 지점

❌ 사고: A학원 사용자가 B학원 학생 명단을 봄 → 회사 망함
```

### 현재의 일반적 NestJS 코드 (지저분하고 위험)

```typescript
// 호출자가 tenantId를 직접 넘겨야 해서 누락 위험이 큼
async findAll(tenantId: string) {
  // where에 tenantId를 직접 넣어야만 같은 테넌트 데이터만 조회됨
  return this.repo.find({ where: { tenantId } });
}

// 단건 조회도 id + tenantId를 매번 함께 조건으로 넣어야 안전함
async findOne(tenantId: string, id: string) {
  // tenantId를 빼먹으면 다른 테넌트의 같은 id를 조회할 수 있음
  return this.repo.findOne({ where: { id, tenantId } });
}

// 캐시 조회 시에도 tenantId를 키 prefix에 수동 반영해야 함
async getCachedRoster(tenantId: string) {
  // prefix 누락 시 캐시가 테넌트 간 섞일 수 있음
  return this.cache.get(`roster:${tenantId}`);
}
```

문제:
- 모든 메서드에 `tenantId` 수동 명시 → 빠뜨리면 데이터 누출
- 캐시 키 prefix 빠뜨리면 다른 tenant 데이터가 보임
- 백그라운드 작업에서 컨텍스트 잃기 쉬움
- 코드 리뷰에서 100% 잡아내기 어려움

### nestjs-tenant-shield의 솔루션

```typescript
// Nest DI에 서비스로 등록
@Injectable()
// 이 클래스의 메서드 실행 시 tenant 컨텍스트가 필수
@RequireTenant()
export class StudentsService {

  // 호출부에서 tenantId를 전달하지 않아도 자동 격리됨
  async findAll() {
    // 내부적으로 현재 tenant 기준 WHERE가 주입됨
    return this.repo.find();
  }

  // id만 받아도 tenant 범위 안에서만 조회됨
  async findOne(id: string) {
    // where에 tenantId를 직접 쓰지 않아도 안전하게 동작
    return this.repo.findOne({ where: { id } });
  }

  // 캐시 사용 시에도 tenant 단위로 키 분리
  @Cacheable({ ttl: 300, tenantScoped: true })
  async getRoster() {
    // 같은 key라도 tenant마다 별도 캐시 엔트리로 저장됨
    return this.repo.find();
  }
}
```

개선:
- tenant_id 명시 0번
- 빠뜨릴 가능성 0
- 캐시 자동 분리
- 실수로 다른 tenant 접근 시 즉시 throw

## ✨ 핵심 차별화

| 기능 | nestjs-cls | nestjs-tenancy류 | nestjs-tenant-shield |
|---|---|---|---|
| AsyncLocalStorage | ✅ | 부분 | ✅ |
| Auto WHERE 주입 | ❌ | ❌ | ✅ 핵심 |
| Database/Schema 분리 | ❌ | ✅ | ✅ (v0.2) |
| 캐시 키 자동 분리 | ❌ | ❌ | ✅ |
| 백그라운드 작업 컨텍스트 | 부분 | ❌ | ✅ |
| 테스트 시 cross-tenant 자동 차단 | ❌ | ❌ | ✅ 핵심 |
| Postgres RLS 통합 | ❌ | ❌ | ✅ (v0.3) |

카테고리: 기존은 "도구". nestjs-tenant-shield는 **"멀티테넌시 안전망"**.

## ✅ 차별성 판단 (현재 기준)

- 아이디어 차별성: **있음**
- 구현 차별성: **아직 없음**

왜냐하면 시장에서 평가하는 것은 문서가 아니라 아래 증거이기 때문입니다.

- 동작하는 패키지
- 신뢰 가능한 통합 테스트
- 실제 누출 시나리오 재현/차단 데모
- 외부 도입 사례 또는 파일럿

이 프로젝트는 위 증거를 만드는 단계로 진입해야 본격적인 시장 경쟁력을 갖습니다.

## 📦 설치

```bash
# ⚠️ 아직 npm 미배포 상태 — 아래는 v0.1.0 배포 시 사용할 명령
pnpm add nestjs-tenant-shield   # 라이브러리 본체 설치

# TypeORM 사용 시 추가 설치
pnpm add typeorm                # TypeORM 연동 기능 사용

# Prisma 사용 시 추가 설치 (v0.2)
pnpm add @prisma/client         # Prisma Client 연동 준비
```

필수 환경:
- NestJS 10.0+
- TypeScript 4.7+
- Node.js 18+
- TypeORM 0.3+ (v0.1)

현재는 설치보다 아래 문서를 우선 확인하세요.

- `docs/tenant-shield-PRD.md`
- `docs/tenant-shield-api-spec.md`
- `claude/IMPLEMENTATION_PLAN.md`

## 🚀 빠른 시작

아래는 **목표 API 예시**입니다. 현재 저장소는 구현 전 단계이므로, 실행 가능한 예제는 마일스톤 진행 후 추가됩니다.

### 1단계: 모듈 설정

```typescript
// Nest의 모듈 데코레이터
import { Module } from '@nestjs/common';
// 멀티테넌시 보호 모듈
import { TenantShieldModule } from 'nestjs-tenant-shield';

// 루트 모듈 정의
@Module({
  imports: [
    // 전역 설정 등록
    TenantShieldModule.forRoot({
      strategy: 'discriminator',     // 단일 테이블 + tenantId 컬럼 전략
      tenantIdField: 'tenantId',     // 테넌트 컬럼명 (서비스에 맞게 변경 가능)
      tenantSource: 'header',        // 요청 헤더에서 tenant 식별
      headerName: 'x-tenant-id',     // 사용할 헤더 이름
      strictMode: true,              // tenant 없으면 즉시 예외 발생
    }),
  ],
})
// 앱 시작 모듈
export class AppModule {}
```

### 2단계: Entity에 tenant_id 추가

```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenantId: string;
  
  @Column()
  name: string;
  
=======
// TypeORM 엔티티 데코레이터 import
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

// students 테이블에 매핑될 엔티티
@Entity()
export class Student {
  // PK 자동 증가 컬럼
  @PrimaryGeneratedColumn()
  id: number;

  // 멀티테넌시 격리를 위한 핵심 컬럼
  @Column()
  tenantId: string;

  // 학생 이름
  @Column()
  name: string;

  // 성적
  @Column()
  grade: number;
}
```

### 3단계: 서비스에 데코레이터

```typescript
// 서비스 데코레이터 import
import { Injectable } from '@nestjs/common';
// tenant 강제 + 캐시 데코레이터 import
import { RequireTenant, Cacheable } from 'nestjs-tenant-shield';

// DI 등록
@Injectable()
// 이 서비스의 메서드는 tenant 컨텍스트 없으면 실행 불가
@RequireTenant()
export class StudentsService {
  // 저장소 주입
  constructor(private readonly repo: StudentsRepository) {}

  // 현재 tenant 범위의 학생 목록 조회
  async findAll() {
    return this.repo.find();
  }

  // 현재 tenant 범위에서 id로 단건 조회
  async findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  // 현재 tenant 범위에서 학생 정보 수정
  async update(id: string, dto: UpdateStudentDto) {
    return this.repo.update(id, dto);
  }

  // tenant별 캐시 분리 + 300초 TTL
  @Cacheable({ ttl: 300, tenantScoped: true })
  async getStatistics() {
    // count도 tenant 범위로 자동 제한됨
    return { total: await this.repo.count() };
  }
}
```

### 4단계: 백그라운드 작업 (v0.2)

```typescript
// Bull 큐 프로세서 데코레이터 import
import { Processor, Process } from '@nestjs/bull';
// 잡 실행 시 tenant 컨텍스트 복원 데코레이터
import { TenantContext } from 'nestjs-tenant-shield';

// reports 큐를 처리하는 워커
@Processor('reports')
export class ReportProcessor {

  // monthly 잡 타입 핸들러
  @Process('monthly')
  // 잡 payload의 tenant 정보로 컨텍스트를 설정
  @TenantContext()
  async generate(job: Job<{ tenantId: string }>) {
    // 백그라운드에서도 tenant 격리 유지
    return this.studentsService.findAll();
  }
}
```

### 5단계: 테스트

```typescript
// 테스트 헬퍼 및 에러 타입 import
import { runWithTenant, CrossTenantAccessError } from 'nestjs-tenant-shield';

// StudentsService 동작 검증
describe('StudentsService', () => {
  // 같은 tenant 데이터만 보이는지 확인
  it('A 학원 컨텍스트에서는 A 학생만 조회', async () => {
    // 테스트 실행 컨텍스트를 academy-A로 고정
    await runWithTenant('academy-A', async () => {
      // 서비스 호출
      const students = await service.findAll();
      // 결과 전체가 academy-A 소속인지 검증
      expect(students.every(s => s.tenantId === 'academy-A')).toBe(true);
    });
  });

  // 다른 tenant 데이터 접근 차단 검증
  it('cross-tenant 시도 시 자동 throw', async () => {
    // 실행 컨텍스트는 academy-A
    await runWithTenant('academy-A', async () => {
      // academy-B 학생을 조회하면 예외가 발생해야 함
      await expect(
        service.findOne('student-from-academy-B')
      ).rejects.toThrow(CrossTenantAccessError);
    });
  });
});
```

## 📖 핵심 개념

### AsyncLocalStorage

비유: 사무실에 여러 손님이 동시에 와도 각 손님 요청을 안 섞이게 처리.

요청 진입 시 미들웨어가 "이 요청은 학원 A" 표를 붙이고, 비동기 호출 체인 끝까지 그 표가 따라옴.

### Discriminator 패턴

같은 테이블에 `tenant_id` 컬럼:

```sql
| id | tenantId   | name    | grade |
|----|------------|---------|-------|
| 1  | academy-A  | 김민수  | 90    |
| 2  | academy-A  | 이지연  | 85    |
| 3  | academy-B  | 박철수  | 88    |  ← 다른 학원
```

쿼리 시 `WHERE tenantId = 'academy-A'` 빠뜨리면 사고. 라이브러리가 자동 주입.

```sql
-- tenant_id 조건을 누락한 위험한 조회 (금지)
SELECT id, tenantId, name, grade
FROM student;

-- tenant_id 조건을 포함한 안전한 조회 (권장)
SELECT id, tenantId, name, grade
FROM student
WHERE tenantId = 'academy-A';
```

### 다층 격리 (Defense in Depth)

```
1층: ORM 쿼리 (자동 WHERE)         ← v0.1
2층: 캐시 키 (자동 prefix)          ← v0.1
3층: 백그라운드 큐 (컨텍스트 전파)  ← v0.2
4층: DB Row-Level Security         ← v0.3
```

한 층 뚫려도 다음 층에서 차단.

## 🔧 API 레퍼런스

상세 API 명세는 [`docs/tenant-shield-api-spec.md`](./docs/tenant-shield-api-spec.md) 참조. 핵심만 요약:

```typescript
// 모듈 설정: 앱 시작 시 tenant-shield 전역 옵션 등록
TenantShieldModule.forRoot({
  strategy: 'discriminator',                             // 단일 DB/테이블 + tenant 컬럼 전략
  tenantIdField: 'tenantId',                             // tenant 식별 컬럼명
  tenantSource: 'header' | 'jwt' | 'subdomain' | 'custom', // tenant 추출 소스 타입
  // ... source별 옵션                                // 소스마다 추가 설정 가능
  strictMode: true,                                      // tenant 누락 요청 즉시 차단
})

// 데코레이터: 메서드/클래스에 보안 정책 부착
@RequireTenant({ allowSystem?: boolean })               // tenant 컨텍스트 강제
@SystemAction()                                          // 시스템 작업(예외 허용 경로) 표시
@Cacheable({ ttl: number, tenantScoped?: boolean })      // 캐시 TTL + tenant 분리 여부
@TenantContext({ extractFrom?: (job) => string })        // v0.2, 큐 잡에서 tenant 추출

// 헬퍼: 코드에서 컨텍스트를 직접 제어할 때 사용
const tenantId = getCurrentTenantId();                   // 현재 요청 tenant 읽기
await runWithTenant('A', async () => {});                // 특정 tenant 컨텍스트로 실행
await runWithoutTenant(async () => {});                  // tenant 없이 시스템 작업 실행

// 에러: tenant 관련 예외 타입
class MissingTenantContextError extends Error {}          // tenant가 없을 때
class CrossTenantAccessError extends Error {}             // 타 tenant 접근 감지 시
class InvalidTenantSourceError extends Error {}           // tenant 추출 소스 설정 오류
```

## 🛡️ 보안 가이드

### nestjs-tenant-shield가 자동 보호하는 것

- ✅ 표준 Repository 메서드 (find, findOne, save, update, delete)
- ✅ QueryBuilder의 단일 entity 쿼리
- ✅ 캐시 키 분리
- ✅ 백그라운드 작업 컨텍스트 (v0.2)

### nestjs-tenant-shield가 자동 보호 **못하는** 것 ⚠️

- ❌ Raw SQL (`repo.query`, `dataSource.query`)
- ❌ JOIN의 다른 테이블 (ON 절 명시 필요)
- ❌ Subquery 내부 (명시 필요)
- ❌ TypeORM CLI/Migration
- ❌ 멀티 DataSource 트랜잭션 (v0.1)
- ❌ 인증 미들웨어 외 tenant_id 변조

상세는 [docs/SECURITY.md](./docs/SECURITY.md) 참조.

현재 `docs/SECURITY.md`는 아직 생성 전이며, v0.1.0 공개 전 필수 산출물로 작성 예정입니다.

### 진실의 한 문장

> **nestjs-tenant-shield는 "흔한 사고의 90%를 자동 차단"하는 도구입니다.**
> **나머지 10%는 위 한계를 인지하고 수동 처리해야 합니다.**
> **만능 보안이 아니며, 다층 방어(defense in depth)의 한 층입니다.**

### 🔬 v0.1 자동 보호 정밀 범위

라이브러리가 "어디까지" 자동으로 보호하는지 정확히 알아두면 사고를 막을 수 있습니다.

#### ✅ 자동 보호되는 TypeORM API

| API | 동작 | 비고 |
|---|---|---|
| `Repository.find(options)` | `options.where`에 `tenantId` 자동 머지 | 배열(OR)도 각 절에 머지 |
| `Repository.findOne(options)` | 동일 | |
| `Repository.findBy(where)` | `where`에 `tenantId` 머지 | |
| `Repository.findOneBy(where)` | 동일 | |
| `Repository.count(options)` | 동일 | |
| `Repository.save(entity)` | INSERT 시 `tenantId` 자동 주입 / cross-tenant insert 차단 | 배열도 처리 |
| `SelectQueryBuilder.getMany/One/ManyAndCount/Count/RawMany/RawOne` | 실행 직전 `andWhere('alias.tenantId = :id')` 자동 추가 | 이미 있으면 중복 추가 X |
| `UpdateQueryBuilder.execute()` | 동일하게 `andWhere` 자동 추가 | |
| `DeleteQueryBuilder.execute()` | 동일 | |
| Subscriber `beforeInsert` | `tenantId` 비어 있으면 자동 주입, 다른 tenant면 즉시 throw | |
| Subscriber `afterLoad` | 로드된 row의 `tenantId`가 컨텍스트와 다르면 즉시 throw | 최후의 안전망 |

#### ⚠️ 자동 보호 안 되는 API (수동 보호 필요)

| API | 권장 대응 |
|---|---|
| `Repository.query(rawSql)` | `withTenantWhere(sql, 'tenant_id')` 헬퍼로 SQL 변환 후 실행 |
| `dataSource.createQueryRunner().query()` | 동일하게 수동 헬퍼 사용 |
| `Repository.update(criteria, partial)` (옵션 없는 단순 형태) | QueryBuilder 사용 또는 `criteria`에 `tenantId` 명시 |
| `Repository.delete(criteria)` (옵션 없는 단순 형태) | 동일 |
| `Repository.insert(values)` | `save()` 사용 권장 (subscriber hook이 더 잘 동작) |
| Entity Listener (`@AfterLoad` 등 사용자 정의) | 사용자가 직접 `getCurrentTenantId()`로 검증 |

#### 🚪 의도적인 우회 경로

다음은 의도된 cross-tenant 접근을 위한 "안전한 우회 경로"입니다:

1. **`runWithoutTenant(fn)`** — 시스템 작업용. 컨텍스트에 `isSystemAction: true` 플래그가 박혀, Subscriber와 데코레이터가 자동 검사를 건너뜁니다.
2. **`@SystemAction()` 데코레이터** — `@RequireTenant()` 클래스 안의 특정 메서드만 우회 표시. `forRoot.allowSystemActions: true` 필요.
3. **`runWithTenant(otherTenantId, fn)`** — 명시적으로 다른 tenant 컨텍스트에 진입. cron이 모든 tenant를 순회할 때 사용.

⚠️ 이 우회 경로들은 강력한 만큼 위험합니다. 보안 로그에 호출 위치를 남기고, 가능하면 `@SystemAction()` + `runWithTenant()` 조합으로 명확하게 표시하세요.

### 권장 다층 보안 (Defense in Depth)

```
1. nestjs-tenant-shield (애플리케이션 자동, 90% 케이스) ← 본 라이브러리
2. + 인증 미들웨어 (tenant_id 검증)
3. + 코드 리뷰 가이드 (raw SQL/JOIN/subquery 점검)
4. + Postgres RLS (DB 레이어, v0.3 통합)
5. + DB 접근 권한 최소화
6. + 정기 침투 테스트 (분기별)
```

## 🔄 기존 코드에서 마이그레이션

기존에 수동으로 `WHERE tenantId` 적던 코드를 라이브러리로 전환하는 권장 절차.

### Step 1: 한 모듈만 먼저
StudentsModule 같은 작은 모듈 하나만 먼저 적용. 나머지 모듈은 그대로.

### Step 2: @RequireTenant 부착
서비스 클래스에 `@RequireTenant()` 추가.

```typescript
// Before
@Injectable()
export class StudentsService { /* ... */ }

// After
@Injectable()
@RequireTenant()
export class StudentsService { /* ... */ }
```

### Step 3: 수동 WHERE 제거
`where: { tenantId, ... }` → `where: { ... }`

```typescript
// Before
return this.repo.find({ where: { tenantId, classId } });

// After
return this.repo.find({ where: { classId } }); // tenant 자동 주입
```

### Step 4: 통합 테스트로 회귀 확인
`runWithTenant`로 테스트 작성. 누출 자동 감지(`CrossTenantAccessError`).

```typescript
await runWithTenant('A', async () => {
  const list = await service.findAll();
  expect(list.every(s => s.tenantId === 'A')).toBe(true);
});
```

### Step 5: 다음 모듈로 확장
한 모듈씩 점진적으로. 일괄 변경 금지 — 한 번에 너무 많이 바꾸면 회귀 추적이 어려움.

## 🗺️ 로드맵

실행 판단 기준(Go/No-Go):

- 4주 내: 동작하는 최소 버전 + 통합 테스트 확보
- 6~8주 내: 외부 사용자 피드백 3건 이상 또는 파일럿 1건 이상
- 기준 미달 시: 범위 축소 또는 중단

### v0.1 (개발 중)
- [ ] AsyncLocalStorage 컨텍스트 매니저
- [ ] @RequireTenant() 데코레이터
- [ ] TypeORM Subscriber (auto WHERE)
- [ ] @Cacheable({ tenantScoped })
- [ ] runWithTenant() 테스트 헬퍼

### v0.2
- [ ] Prisma 어댑터
- [ ] BullMQ/Bull 통합 (@TenantContext)
- [ ] Schema/Database 격리 패턴
- [ ] Tenant purge 헬퍼 (GDPR)

### v0.3
- [ ] Mongoose 어댑터
- [ ] Postgres RLS 자동 설정
- [ ] GraphQL DataLoader 통합

### v1.0
- [ ] 성능 벤치마크 (오버헤드 < 1ms)
- [ ] 마이그레이션 도구 (수동 → 자동)
- [ ] 보안 감사

## 💡 어떤 컬럼명이든 OK — 다양한 도메인 예시

`tenantIdField`는 회사/도메인의 관습에 맞게 자유롭게 설정 가능.

### 학원 관리 SaaS

```typescript
TenantShieldModule.forRoot({
  strategy: 'discriminator',
  tenantIdField: 'spaceId',  // ← 학원 ID
  tenantSource: 'jwt',
  jwtClaim: 'spaceId',
})

@Entity()
export class Student {
  @Column()
  spaceId: string;  // 학원 ID

  @Column()
  name: string;
}

@Injectable()
@RequireTenant()
export class StudentsService {
  async findAll() {
    return this.repo.find();  // 자동 WHERE space_id = ?
  }
}
```

### 병원 관리 SaaS

```typescript
// 병원 도메인에 맞게 tenant 컬럼명을 hospitalId로 지정
TenantShieldModule.forRoot({
  tenantIdField: 'hospitalId',  // 테넌트 식별 필드명 (병원 ID)
  tenantSource: 'jwt',          // JWT에서 tenant 추출
  jwtClaim: 'hospital_id',      // JWT claim 키 이름
})

@Entity()
export class Patient {
  @Column()
  hospitalId: string;
}
```

### Slack 같은 팀 협업

```typescript
// 워크스페이스 단위 SaaS 구성 예시
TenantShieldModule.forRoot({
  tenantIdField: 'workspaceId',      // 워크스페이스 식별 필드
  tenantSource: 'subdomain',         // 서브도메인에서 tenant 추출
  subdomainPattern: '*.yourapp.com', // tenant 추출 대상 도메인 패턴
})
```

### CRM (Salesforce식)

```typescript
TenantShieldModule.forRoot({
  tenantIdField: 'orgId',  // ← 조직 ID
  tenantSource: 'header',
  headerName: 'x-org-id',
})
```

### 일반 B2B SaaS

```typescript
TenantShieldModule.forRoot({
  tenantIdField: 'tenantId',  // ← 가장 일반적
})
```

핵심: **회사 도메인 관습 그대로 사용 가능.** `spaceId`, `hospitalId`, `workspaceId`, `orgId`, `accountId`, `companyId`, `clientId`, `customerId` 등 어떤 이름이든 OK.

## 🤝 기여

이슈와 PR 환영. v0.x 단계에서 적극적인 피드백 수용.

## 📜 라이선스

MIT © Jinyeong Jung

## 📚 문서 안내

- README: 사용법/예제/빠른 시작 (이 문서)
- docs/tenant-shield-api-spec.md: API 상세 명세
- docs/tenant-shield-PRD.md: 설계/로드맵/배경
- multi-tenant-explainer.md: 멀티테넌시 개념 요약
