# @guardrail/audit

[![npm version](https://img.shields.io/npm/v/@guardrail/audit)](https://www.npmjs.com/package/@guardrail/audit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NestJS](https://img.shields.io/badge/NestJS-v9%2B-red)](https://nestjs.com/)

> **NestJS 백엔드에 데코레이터 한 줄만 붙이면, 위변조를 감지할 수 있는 감사 로그를 자동으로 만들어주는 라이브러리.**

## 🎯 Why @guardrail/audit?

### 문제점
NestJS로 백엔드를 만드는 회사들이 감사 로그(audit log)를 직접 구현할 때 흔히 겪는 문제:

1. **로깅 코드가 비즈니스 로직을 더럽힌다** — 모든 메서드에 `auditService.log(...)` 호출을 8~12줄씩 반복
2. **DB에 그냥 INSERT만 하면 위변조 추적이 불가능** — 누군가 DB에 직접 UPDATE 쳐서 과거 기록을 바꿔도 흔적이 안 남음
3. **컴플라이언스(GDPR/HIPAA/SOC2/PIPA) 요건이 까다로워지고 있다** — "이 로그는 변조되지 않았다"를 증명할 수 없으면 감사에서 탈락

### 솔루션
데코레이터 한 줄과 **해시 체인(Hash Chain) 기반 위변조 감지** 기능으로 깔끔하게 해결합니다.

```typescript
// Before (라이브러리 없음)
async updateStudent(id: string, dto: UpdateStudentDto, user: User) {
  const before = await this.repo.findOne(id);
  const result = await this.repo.update(id, dto);
  await this.auditService.log({ actorId: user.id, action: 'student.update', ... }); // 8-12줄
  return result;
}

// After (@guardrail/audit 사용)
@AuditLog({ action: 'student.update', resource: 'student' })
async updateStudent(id: string, dto: UpdateStudentDto) {
  return this.repo.update(id, dto);
}
```

## ✨ 핵심 특징

| 기능 | 기존 라이브러리 | @guardrail/audit |
|---|---|---|
| 데코레이터 한 줄 통합 | ✅ | ✅ |
| DB 저장 | ✅ | ✅ |
| **Hash Chain (위변조 감지)** | ❌ | ✅ **핵심 차별화** |
| 선언적 설계 (Clean Code) | ❌ | ✅ |
| 민감 정보 마스킹 | ❌ | ✅ |
| Fail-Fast 설정 검증 | ❌ | ✅ |
| 비차단 에러 처리 | ❌ | ✅ |

## 📦 설치

```bash
# npm
npm install @guardrail/audit

# yarn
yarn add @guardrail/audit

# pnpm
pnpm add @guardrail/audit
```

**필수 환경:**
- NestJS 9.0 이상
- TypeScript 4.7 이상
- Node.js 16 이상

## 🚀 빠른 시작

### 1단계: 모듈 초기화 (AppModule)

```typescript
import { Module } from '@nestjs/common';
import { AuditLogModule } from '@guardrail/audit';

@Module({
  imports: [
    AuditLogModule.forRoot({
      storage: 'memory',
      actorResolver: (request) => request.user?.id ?? null,
      genesisHash: 'your-prod-env-hash', // 선택사항
    }),
  ],
})
export class AppModule {}
```

### 2단계: 메서드에 데코레이터 붙이기

```typescript
import { Injectable } from '@nestjs/common';
import { AuditLog } from '@guardrail/audit';

@Injectable()
export class StudentsService {
  constructor(private readonly repo: StudentsRepository) {}

  @AuditLog({ action: 'student.create', resource: 'student' })
  async createStudent(dto: CreateStudentDto) {
    return this.repo.create(dto);
  }

  @AuditLog({ action: 'student.update', resource: 'student' })
  async updateStudent(id: string, dto: UpdateStudentDto) {
    return this.repo.update(id, dto);
  }

  @AuditLog({ action: 'student.delete', resource: 'student' })
  async deleteStudent(id: string) {
    return this.repo.delete(id);
  }
}
```

### 3단계: 저장된 로그 조회

```typescript
import { Injectable } from '@nestjs/common';
import { AuditLogService } from '@guardrail/audit';

@Injectable()
export class AuditController {
  constructor(private readonly auditService: AuditLogService) {}

  async getStudentAuditLog(studentId: string) {
    return this.auditService.query({
      resource: 'student',
      action: 'student.update',
      resourceId: studentId,
    });
  }

  async verifyAuditChain() {
    // 해시 체인 무결성 검증
    return this.auditService.verify();
  }
}
```

## 📖 주요 개념

### 해시 체인 (Hash Chain)

각 audit log 엔트리에 **이전 엔트리의 해시를 포함**해서 새 해시를 만드는 방식입니다.

```
엔트리 1: { 데이터: "김민수 출석", prevHash: null,    selfHash: f8a3... }
엔트리 2: { 데이터: "이지연 결석", prevHash: f8a3..., selfHash: b7c2... }
엔트리 3: { 데이터: "박철수 출석", prevHash: b7c2..., selfHash: d4e1... }
```

**왜 이렇게 하나**: 누군가 엔트리 1을 몰래 수정하면 → selfHash가 바뀜 → 엔트리 2의 prevHash와 안 맞음 → **검증 시 즉시 발각됨**

### 위변조 감지 (Tamper-evident)

위변조를 **막지는 못하지만**, 위변조가 일어나면 **반드시 발견**되는 성질입니다.

> 비유: 영수증의 도장. 도장 위조는 가능하지만, 다른 영수증과 비교하면 들통남.

**⚠️ 중요한 한계**: 우리 라이브러리는 위변조 **방지(prevention)**가 아닙니다. DB 관리자가 직접 데이터를 고치는 걸 막을 수는 없어요. 다만 고치면 검증 단계에서 발견됩니다.

### 정규 직렬화 (Canonical Serialization)

같은 데이터는 **항상 같은 문자열**로 변환되도록 규칙을 정한 것입니다.

```javascript
// 일반 JSON.stringify (문제 있음)
JSON.stringify({ name: "민수", age: 30 })
// → '{"name":"민수","age":30}'

JSON.stringify({ age: 30, name: "민수" })
// → '{"age":30,"name":"민수"}'  ← 같은 데이터인데 결과 다름

// Canonical serialization (해결)
canonicalStringify({ name: "민수", age: 30 })
// → '{"age":30,"name":"민수"}'  ← 항상 동일
```

왜 필요한가: 같은 데이터인데 직렬화 결과가 다르면 해시도 달라져서, 위변조 안 했는데도 검증에서 깨진 것처럼 보임.

## 🔧 API 레퍼런스

### @AuditLog() 데코레이터

메서드의 호출을 자동으로 감사 로그로 기록합니다.

#### 옵션

```typescript
@AuditLog({
  action: string;                    // 필수: 액션 ID (예: 'student.update')
  resource: string;                  // 필수: 리소스 타입 (예: 'student')
  captureArgs?: boolean;             // 기본값: true - 메서드 인자 캡처 여부
  captureResult?: boolean;           // 기본값: true - 반환값 캡처 여부
  maskFields?: string[];             // 선택: 가릴 필드 경로 (예: ['user.password'])
})
```

#### 예제

```typescript
// 기본 사용
@AuditLog({ action: 'user.login', resource: 'user' })
async login(email: string, password: string) {
  // 인자, 반환값 모두 기록
}

// 민감한 필드 마스킹
@AuditLog({
  action: 'user.create',
  resource: 'user',
  maskFields: ['password', 'ssn', 'phoneNumber'],
})
async createUser(dto: CreateUserDto) {
  // password, ssn, phoneNumber는 [REDACTED]로 치환됨
}

// 인자만 기록하고 반환값은 무시
@AuditLog({
  action: 'report.export',
  resource: 'report',
  captureResult: false,
})
async exportReport(reportId: string) {
  // 큰 파일 객체는 저장하지 않음
}
```

### AuditLogModule.forRoot()

애플리케이션 루트에서 감사 로그 시스템을 초기화합니다.

#### 옵션

```typescript
AuditLogModule.forRoot({
  storage: 'memory' | 'database';           // 필수: 스토리지 타입
  actorResolver?: (request) => string|null; // 선택: 사용자 ID 추출 함수
  genesisHash?: string;                     // 선택: 초기 해시값
})
```

#### 설정 항목

| 항목 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `storage` | string | ✅ | v0.1은 `'memory'`만 지원. 향후 `'database'` 추가 예정. |
| `actorResolver` | Function | ❌ | Request에서 사용자 ID를 추출하는 콜백. 미제공 시 `null`로 기록. |
| `genesisHash` | string | ❌ | 해시 체인의 첫 값. 기본값: `'0'.repeat(64)`. 환경별 분리에 유용. |

#### 예제

```typescript
// Express 요청에서 사용자 추출
AuditLogModule.forRoot({
  storage: 'memory',
  actorResolver: (request) => request.user?.id ?? null,
})

// FastifyRequest에서 사용자 추출
AuditLogModule.forRoot({
  storage: 'memory',
  actorResolver: (request) => request.session?.userId ?? null,
})

// 환경별 분리
AuditLogModule.forRoot({
  storage: 'memory',
  actorResolver: (request) => request.user?.id ?? null,
  genesisHash: process.env.GENESIS_HASH,
})
```

### AuditLogService

프로그래밍 방식으로 감사 로그를 조회하고 검증합니다.

#### 메서드

##### `query(filter: AuditLogFilter): Promise<AuditLogEntry[]>`

조건에 맞는 감사 로그 목록을 반환합니다.

```typescript
const logs = await auditService.query({
  resource: 'student',
  action: 'student.update',
  actorId: 'user123',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
});
```

##### `verify(): Promise<VerifyResult>`

해시 체인의 무결성을 검증합니다.

```typescript
const result = await auditService.verify();
// {
//   isValid: true,
//   tamperedAt: null,
//   message: "모든 엔트리의 해시 체인이 유효합니다."
// }

if (!result.isValid) {
  console.error(`위변조 감지! ${result.tamperedAt}부터 손상됨`);
}
```

## 📊 데이터 모델

### AuditLogEntry

스토리지에 저장되는 로그 엔트리 구조입니다.

```typescript
interface AuditLogEntry {
  id?: string;                                    // 고유 ID (UUID 등)
  actorId: string | null;                         // 액션 수행자 (사용자 ID)
  action: string;                                 // 액션 명 (예: 'student.update')
  resource: string;                               // 리소스 타입 (예: 'student')
  occurredAt: Date;                               // 발생 시각
  before: Record<string, unknown> | null;         // 변경 전 데이터 (메서드 인자)
  after: Record<string, unknown> | null;          // 변경 후 데이터 (반환값)
  succeeded: boolean;                             // 성공 여부
  errorMessage?: string;                          // 실패 시 에러 메시지
  
  // Hash Chain 필드 (자동 계산)
  prevHash: string;                               // 이전 엔트리의 selfHash
  selfHash: string;                               // 현재 엔트리의 SHA-256 해시
}
```

## ⚙️ 설정 가이드

### 1. Express/Fastify 미들웨어에서 사용자 정보 추출

```typescript
// app.module.ts
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [
    AuditLogModule.forRoot({
      storage: 'memory',
      actorResolver: (request) => {
        // Express: request.user
        // Fastify: request.session?.user
        return request.user?.id ?? request.session?.userId ?? null;
      },
    }),
  ],
})
export class AppModule {}
```

### 2. 민감한 필드 보호

```typescript
@AuditLog({
  action: 'user.updatePassword',
  resource: 'user',
  maskFields: [
    'password',
    'newPassword',
    'confirmPassword',
    'creditCard',
    'ssn',
  ],
})
async updatePassword(id: string, dto: UpdatePasswordDto) {
  // 위 필드들은 모두 [REDACTED]로 저장됨
}
```

### 3. 환경별 분리

```typescript
// dev.env
GENESIS_HASH=dev_000000000000000000000000000000000000000000000000000000000000

// prod.env
GENESIS_HASH=prod_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

// app.module.ts
AuditLogModule.forRoot({
  storage: 'memory',
  actorResolver: (request) => request.user?.id ?? null,
  genesisHash: process.env.GENESIS_HASH,
})
```

## 🔍 사용 사례

### 컴플라이언스 감사

```typescript
@Controller('audit')
export class ComplianceController {
  constructor(private readonly auditService: AuditLogService) {}

  @Get('/verify')
  async verifyCompliance() {
    const result = await this.auditService.verify();
    if (result.isValid) {
      return { status: 'COMPLIANT', message: '모든 감사 로그가 유효합니다.' };
    } else {
      return {
        status: 'VIOLATED',
        message: `위변조가 감지되었습니다: ${result.message}`,
      };
    }
  }

  @Get('/student/:id')
  async getStudentAuditTrail(@Param('id') id: string) {
    return this.auditService.query({
      resource: 'student',
      resourceId: id,
    });
  }
}
```

### 의료/금융 시스템

```typescript
@Injectable()
export class PatientRecordService {
  @AuditLog({
    action: 'medical.recordUpdate',
    resource: 'patientRecord',
    maskFields: ['ssn', 'phoneNumber', 'address', 'diagnosis'], // HIPAA
  })
  async updateRecord(recordId: string, dto: UpdateRecordDto) {
    return this.repo.update(recordId, dto);
  }
}

@Injectable()
export class TransactionService {
  @AuditLog({
    action: 'payment.process',
    resource: 'transaction',
    maskFields: ['creditCard', 'cvv', 'amount'], // PCI-DSS
  })
  async processPayment(dto: PaymentDto) {
    return this.paymentGateway.charge(dto);
  }
}
```

## 🚦 에러 처리

### 설정 오류 (Fail-Fast)

필수 파라미터 누락 시 앱 부팅 단계에서 즉시 실패합니다.

```typescript
// ❌ 부팅 실패: action 누락
@AuditLog({ resource: 'student' })
async updateStudent() { }

// ✅ 정상: 필수 필드 모두 제공
@AuditLog({ action: 'student.update', resource: 'student' })
async updateStudent() { }
```

### 런타임 에러 (Non-Blocking)

감사 로그 생성 실패가 비즈니스 로직을 차단하지 않습니다.

```typescript
// 감사 로그 저장 실패 → 에러 로깅만 함 → 비즈니스 로직은 정상 진행
@AuditLog({ action: 'student.update', resource: 'student' })
async updateStudent(id: string, dto: UpdateStudentDto) {
  // 로깅 실패해도 여기서는 정상 실행됨
  return this.repo.update(id, dto);
}
```

## 🗺️ 로드맵

| 버전 | 기능 | 상태 |
|---|---|---|
| v0.1 | 인메모리 스토리지, 해시 체인 | ✅ 완료 |
| v0.2 | TypeORM/Prisma 어댑터, Verify CLI | 🔄 진행 중 |
| v0.3 | 외부 Anchor(Git/S3), Tombstone 패턴 | 📋 계획 |

## 🤝 기여 방법

이슈 리포트나 PR을 환영합니다.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 📚 참고 자료

- [완전한 PRD 문서](./docs/Audit_Log_PRD.md)
- [API 명세서](./docs/Guardrail_Audit_API_Spec.md)
- [NestJS 공식 문서](https://docs.nestjs.com/)
- [해시 체인 개념](https://en.wikipedia.org/wiki/Hash_chain)

---

**Made with ❤️ by the @guardrail team**
