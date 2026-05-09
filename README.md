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
async findAll(tenantId: string) {
  return this.repo.find({ where: { tenantId } });  // 빠뜨리면 사고
}

async findOne(tenantId: string, id: string) {
  return this.repo.findOne({ where: { id, tenantId } });
}

async getCachedRoster(tenantId: string) {
  return this.cache.get(`roster:${tenantId}`);  // 캐시 키도 수동
}
```

문제:
- 모든 메서드에 `tenantId` 수동 명시 → 빠뜨리면 데이터 누출
- 캐시 키 prefix 빠뜨리면 다른 tenant 데이터가 보임
- 백그라운드 작업에서 컨텍스트 잃기 쉬움
- 코드 리뷰에서 100% 잡아내기 어려움

### nestjs-tenant-shield의 솔루션

```typescript
@Injectable()
@RequireTenant()  // 클래스 한 줄
export class StudentsService {
  
  async findAll() {
    return this.repo.find();  // tenant_id 자동 WHERE
  }

  async findOne(id: string) {
    return this.repo.findOne({ where: { id } });  // 자동
  }

  @Cacheable({ ttl: 300, tenantScoped: true })
  async getRoster() {
    return this.repo.find();  // 캐시 키도 자동 분리
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
pnpm add nestjs-tenant-shield

# TypeORM 사용 시
pnpm add typeorm

# Prisma 사용 시 (v0.2)
pnpm add @prisma/client
```

필수 환경:
- NestJS 10.0+
- TypeScript 4.7+
- Node.js 18+
- TypeORM 0.3+ (v0.1)

## 🚀 빠른 시작

### 1단계: 모듈 설정

```typescript
import { Module } from '@nestjs/common';
import { TenantShieldModule } from 'nestjs-tenant-shield';

@Module({
  imports: [
    TenantShieldModule.forRoot({
      strategy: 'discriminator',     // tenant_id 컬럼 패턴
      tenantIdField: 'tenantId',     // 또는 'spaceId', 'orgId'
      tenantSource: 'header',
      headerName: 'x-tenant-id',
      strictMode: true,
    }),
  ],
})
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
  
  @Column()
  grade: number;
}
```

### 3단계: 서비스에 데코레이터

```typescript
import { Injectable } from '@nestjs/common';
import { RequireTenant, Cacheable } from 'nestjs-tenant-shield';

@Injectable()
@RequireTenant()
export class StudentsService {
  constructor(private readonly repo: StudentsRepository) {}

  async findAll() {
    return this.repo.find();
  }

  async findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, dto: UpdateStudentDto) {
    return this.repo.update(id, dto);
  }

  @Cacheable({ ttl: 300, tenantScoped: true })
  async getStatistics() {
    return { total: await this.repo.count() };
  }
}
```

### 4단계: 백그라운드 작업 (v0.2)

```typescript
import { Processor, Process } from '@nestjs/bull';
import { TenantContext } from 'nestjs-tenant-shield';

@Processor('reports')
export class ReportProcessor {
  
  @Process('monthly')
  @TenantContext()
  async generate(job: Job<{ tenantId: string }>) {
    return this.studentsService.findAll();
  }
}
```

### 5단계: 테스트

```typescript
import { runWithTenant, CrossTenantAccessError } from 'nestjs-tenant-shield';

describe('StudentsService', () => {
  it('A 학원 컨텍스트에서는 A 학생만 조회', async () => {
    await runWithTenant('academy-A', async () => {
      const students = await service.findAll();
      expect(students.every(s => s.tenantId === 'academy-A')).toBe(true);
    });
  });

  it('cross-tenant 시도 시 자동 throw', async () => {
    await runWithTenant('academy-A', async () => {
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
// 모듈 설정
TenantShieldModule.forRoot({
  strategy: 'discriminator',
  tenantIdField: 'tenantId',
  tenantSource: 'header' | 'jwt' | 'subdomain' | 'custom',
  // ... source별 옵션
  strictMode: true,
})

// 데코레이터
@RequireTenant({ allowSystem?: boolean })
@SystemAction()
@Cacheable({ ttl: number, tenantScoped?: boolean })
@TenantContext({ extractFrom?: (job) => string })  // v0.2

// 헬퍼
const tenantId = getCurrentTenantId();
await runWithTenant('A', async () => {});
await runWithoutTenant(async () => {});

// 에러
class MissingTenantContextError extends Error {}
class CrossTenantAccessError extends Error {}
class InvalidTenantSourceError extends Error {}
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
@RequireTenant()
export class ClassesService {
  async getEnrollments() { /* ... */ }
}
```

### 병원 관리 SaaS
```typescript
TenantShieldModule.forRoot({
  tenantIdField: 'hospitalId',
  tenantSource: 'jwt',
  jwtClaim: 'hospital_id',
})
```

### 슬랙 같은 팀 협업
```typescript
TenantShieldModule.forRoot({
  tenantIdField: 'workspaceId',
  tenantSource: 'subdomain',
  subdomainPattern: '*.yourapp.com',
})
```

## 🤝 기여

이슈와 PR 환영. v0.x 단계에서 적극적인 피드백 수용.

## 📜 라이선스

MIT © Jinyeong Jung
