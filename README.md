# nestjs-tenant-shield

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NestJS](https://img.shields.io/badge/NestJS-v10%2B-red)](https://nestjs.com/)

> NestJS B2B SaaS 백엔드의 데이터 격리를 데코레이터 한 줄로 자동화하는 라이브러리. Cross-tenant 데이터 누출 사고를 사전 차단하고, 코드를 깨끗하게 유지합니다.

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

## 📦 설치

```bash
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

## 🚀 빠른 시작

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

상세 API 명세는 `docs/api-spec.md` 참조. 핵심만 요약:

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

### nestjs-tenant-shield가 하는 것

- ✅ ORM 쿼리에 자동 WHERE 주입
- ✅ Cross-tenant 접근 자동 감지/차단
- ✅ 캐시 키 자동 분리
- ✅ 백그라운드 작업 컨텍스트 전파 (v0.2)

### nestjs-tenant-shield가 **하지 않는** 것

- ❌ Raw SQL의 자동 보호 (수동 헬퍼 제공)
- ❌ tenant_id 변조 방지 (인증 미들웨어 책임)
- ❌ DB 관리자 직접 접근 방지
- ❌ 백업/복구 시 격리 (운영 책임)

### 권장 다층 보안

```
1. nestjs-tenant-shield (애플리케이션 레이어 자동화) ← 본 라이브러리
2. + 인증 미들웨어 (tenant_id 검증)
3. + Postgres RLS (DB 레이어, v0.3 통합)
4. + DB 접근 권한 최소화
5. + 정기 침투 테스트
```

## 🗺️ 로드맵

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

## 💡 다양한 도메인 예시

### 학원 관리 SaaS
```typescript
// 클래스 전체에 tenant 컨텍스트 강제
@RequireTenant()
export class ClassesService {
  // 수강 목록 조회도 tenant 범위 안에서만 수행
  async getEnrollments() { /* ... */ }
}
```

### 병원 관리 SaaS
```typescript
// 병원 도메인에 맞게 tenant 컬럼명을 hospitalId로 지정
TenantShieldModule.forRoot({
  tenantIdField: 'hospitalId',   // 테넌트 식별 필드명
  tenantSource: 'jwt',           // JWT에서 tenant 추출
  jwtClaim: 'hospital_id',       // JWT claim 키 이름
})
```

### 슬랙 같은 팀 협업
```typescript
// 워크스페이스 단위 SaaS 구성 예시
TenantShieldModule.forRoot({
  tenantIdField: 'workspaceId',      // 워크스페이스 식별 필드
  tenantSource: 'subdomain',         // 서브도메인에서 tenant 추출
  subdomainPattern: '*.yourapp.com', // tenant 추출 대상 도메인 패턴
})
```

## 🤝 기여

이슈와 PR 환영. v0.x 단계에서 적극적인 피드백 수용.

## 📜 라이선스

MIT © Jinyeong Jung
