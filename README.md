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
// ─────────────────────────────────────────────────────────────
// Before — 라이브러리 없이 직접 audit 로깅을 구현하는 경우
// 의도: 비즈니스 로직과 감사 로그가 한 메서드에 뒤섞여 가독성/유지보수성 저하
// ─────────────────────────────────────────────────────────────
async updateStudent(id: string, dto: UpdateStudentDto, user: User) {
  // 변경 전 데이터를 조회 (audit "before" 필드용 추가 쿼리)
  const before = await this.repo.findOne(id);

  // 실제 비즈니스 로직 (단 1줄)
  const result = await this.repo.update(id, dto);

  // 감사 로그 기록 — 모든 메서드마다 8~12줄씩 반복되는 보일러플레이트
  await this.auditService.log({ actorId: user.id, action: 'student.update', ... });

  return result;
}

// ─────────────────────────────────────────────────────────────
// After — @guardrail/audit 적용
// 의도: 데코레이터 한 줄로 감사 로그를 자동화하여 비즈니스 로직을 깨끗하게 유지
// ─────────────────────────────────────────────────────────────
@AuditLog({ action: 'student.update', resource: 'student' }) // ← 메타데이터만 부착, 실제 로깅은 인터셉터가 처리
async updateStudent(id: string, dto: UpdateStudentDto) {
  return this.repo.update(id, dto); // 비즈니스 로직만 남김 (인자/반환값은 인터셉터가 자동 캡처)
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

// ─────────────────────────────────────────────────────────────
// AppModule — 앱 루트에서 단 한 번만 forRoot()로 전역 초기화
// 의도: 글로벌 인터셉터가 자동 부착되어 모든 도메인 모듈에서 별도 import 없이 @AuditLog 사용 가능
// ─────────────────────────────────────────────────────────────
@Module({
  imports: [
    AuditLogModule.forRoot({
      storage: 'memory',                                    // v0.1은 인메모리만 지원 (프로덕션 부적합 — 데모/테스트용)
      actorResolver: (request) => request.user?.id ?? null, // 요청 객체에서 사용자 ID를 추출하는 콜백 — 미제공 시 actorId는 null로 기록
      genesisHash: 'your-prod-env-hash',                    // 해시 체인의 첫 prevHash (선택) — 환경별(prod/dev) 분리에 유용
    }),
  ],
})
export class AppModule {}
```

### 2단계: 메서드에 데코레이터 붙이기

```typescript
import { Injectable } from '@nestjs/common';
import { AuditLog } from '@guardrail/audit';

// ─────────────────────────────────────────────────────────────
// StudentsService — 도메인 서비스에 @AuditLog만 부착하면 자동 감사 기록
// 의도: 서비스가 audit 인프라(actorId, occurredAt, hash 등)를 전혀 알 필요 없도록 캡슐화
// ─────────────────────────────────────────────────────────────
@Injectable()
export class StudentsService {
  constructor(private readonly repo: StudentsRepository) {}

  // 'student.create' 액션 — 인자(dto)와 반환값(생성된 학생)이 자동 캡처됨
  @AuditLog({ action: 'student.create', resource: 'student' })
  async createStudent(dto: CreateStudentDto) {
    return this.repo.create(dto);
  }

  // 'student.update' 액션 — before(인자)와 after(반환값)가 동일 엔트리에 함께 기록
  @AuditLog({ action: 'student.update', resource: 'student' })
  async updateStudent(id: string, dto: UpdateStudentDto) {
    return this.repo.update(id, dto);
  }

  // 'student.delete' 액션 — 삭제 ID만 인자로 캡처 (반환값은 도메인에 따라 void/삭제된 객체)
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

// ─────────────────────────────────────────────────────────────
// AuditController — 저장된 감사 로그를 조회/검증하는 진입점
// 의도: 컴플라이언스 감사 대응 시 외부에 "이 로그는 변조되지 않았다"를 증명할 API 제공
// ─────────────────────────────────────────────────────────────
@Injectable()
export class AuditController {
  constructor(private readonly auditService: AuditLogService) {}

  // 특정 학생의 변경 이력 조회 — 필터 조합으로 원하는 엔트리만 가져옴
  async getStudentAuditLog(studentId: string) {
    return this.auditService.query({
      resource: 'student',          // 리소스 타입 필터
      action: 'student.update',     // 액션 필터 (생성/삭제는 제외)
      resourceId: studentId,        // 특정 자원 ID로 좁힘
    });
  }

  // 해시 체인 무결성 검증 — 누군가 DB를 손댔다면 isValid: false 반환
  async verifyAuditChain() {
    return this.auditService.verify();
  }
}
```

## 📖 주요 개념

### 해시 체인 (Hash Chain)

각 audit log 엔트리에 **이전 엔트리의 해시를 포함**해서 새 해시를 만드는 방식입니다.

```
// 각 엔트리의 selfHash가 다음 엔트리의 prevHash로 연결되어 사슬을 형성
엔트리 1: { 데이터: "김민수 출석", prevHash: null,    selfHash: f8a3... } // 첫 엔트리는 prevHash가 null (또는 genesisHash)
엔트리 2: { 데이터: "이지연 결석", prevHash: f8a3..., selfHash: b7c2... } // 엔트리1의 selfHash를 prevHash로 참조
엔트리 3: { 데이터: "박철수 출석", prevHash: b7c2..., selfHash: d4e1... } // 엔트리2의 selfHash를 prevHash로 참조
```

**왜 이렇게 하나**: 누군가 엔트리 1을 몰래 수정하면 → selfHash가 바뀜 → 엔트리 2의 prevHash와 안 맞음 → **검증 시 즉시 발각됨**

### 위변조 감지 (Tamper-evident)

위변조를 **막지는 못하지만**, 위변조가 일어나면 **반드시 발견**되는 성질입니다.

> 비유: 영수증의 도장. 도장 위조는 가능하지만, 다른 영수증과 비교하면 들통남.

**⚠️ 중요한 한계**: 우리 라이브러리는 위변조 **방지(prevention)**가 아닙니다. DB 관리자가 직접 데이터를 고치는 걸 막을 수는 없어요. 다만 고치면 검증 단계에서 발견됩니다.

### 정규 직렬화 (Canonical Serialization)

같은 데이터는 **항상 같은 문자열**로 변환되도록 규칙을 정한 것입니다.

```javascript
// ─────────────────────────────────────────────────────────────
// 일반 JSON.stringify의 문제점 — 키 입력 순서를 그대로 따름
// 결과: 같은 의미의 데이터인데 직렬화 결과가 달라져 해시값도 달라짐
// ─────────────────────────────────────────────────────────────
JSON.stringify({ name: "민수", age: 30 })
// → '{"name":"민수","age":30}'

JSON.stringify({ age: 30, name: "민수" })
// → '{"age":30,"name":"민수"}'  ← 같은 데이터인데 결과 다름 → 해시 불일치 → false positive 위변조 감지

// ─────────────────────────────────────────────────────────────
// canonicalStringify — 키를 알파벳 순으로 정렬해 결정적(deterministic) 출력 보장
// 의도: 동일한 데이터는 어떤 순서로 입력되어도 항상 동일한 해시를 생성
// ─────────────────────────────────────────────────────────────
canonicalStringify({ name: "민수", age: 30 })
// → '{"age":30,"name":"민수"}'  ← 항상 동일 (키 순서 무관)
```

왜 필요한가: 같은 데이터인데 직렬화 결과가 다르면 해시도 달라져서, 위변조 안 했는데도 검증에서 깨진 것처럼 보임.

## 🔧 API 레퍼런스

### @AuditLog() 데코레이터

메서드의 호출을 자동으로 감사 로그로 기록합니다.

#### 옵션

```typescript
// AuditLogOptions — @AuditLog 데코레이터에 넘기는 옵션 객체의 형태
@AuditLog({
  action: string;                    // 필수: 액션의 고유 ID — 로그 쿼리의 1순위 필터 키 (예: 'student.update')
  resource: string;                  // 필수: 대상 리소스 타입 — 자원별 보관/접근 정책의 기준 (예: 'student')
  captureArgs?: boolean;             // 기본 true: 메서드 인자(=before) 캡처 — 비밀번호 메서드는 false 권장
  captureResult?: boolean;           // 기본 true: 반환값(=after) 캡처 — 큰 객체 반환 시 false로 비용 절약
  maskFields?: string[];             // 선택: dot-notation 경로로 민감 필드 가림 (예: ['user.password'])
})
```

#### 예제

```typescript
// ─────────────────────────────────────────────────────────────
// 케이스 1 — 기본 사용 (모든 옵션 디폴트)
// 의도: 가장 흔한 케이스 — 인자와 반환값을 그대로 기록
// 주의: password가 평문으로 저장됨 → 실제로는 maskFields 사용 권장 (아래 케이스 2 참조)
// ─────────────────────────────────────────────────────────────
@AuditLog({ action: 'user.login', resource: 'user' })
async login(email: string, password: string) {
  // 인자(email, password), 반환값 모두 자동 기록
}

// ─────────────────────────────────────────────────────────────
// 케이스 2 — 민감 필드 마스킹 (GDPR/PIPA/HIPAA 컴플라이언스)
// 의도: "이 필드가 인자에 들어왔다"는 사실은 남기되, 실제 값은 가림
// 동작: 캡처 시점에 [REDACTED]로 치환 → 그 상태로 hash chain에 들어감
// ─────────────────────────────────────────────────────────────
@AuditLog({
  action: 'user.create',
  resource: 'user',
  maskFields: ['password', 'ssn', 'phoneNumber'], // dto.password 등이 [REDACTED]로 저장
})
async createUser(dto: CreateUserDto) {
  // password, ssn, phoneNumber는 [REDACTED]로 치환됨
}

// ─────────────────────────────────────────────────────────────
// 케이스 3 — 반환값 캡처 비활성화
// 의도: 반환값이 거대한 바이너리/스트림인 경우 메모리/스토리지 비용 절감
// ─────────────────────────────────────────────────────────────
@AuditLog({
  action: 'report.export',
  resource: 'report',
  captureResult: false, // after 필드는 null로 기록됨
})
async exportReport(reportId: string) {
  // 큰 파일 객체는 저장하지 않음 (인자만 기록)
}
```

### AuditLogModule.forRoot()

애플리케이션 루트에서 감사 로그 시스템을 초기화합니다.

#### 옵션

```typescript
// AuditLogModuleOptions — 앱 부팅 시 forRoot에 넘기는 전역 설정
AuditLogModule.forRoot({
  storage: 'memory' | 'database';           // 필수: 스토리지 어댑터 — v0.1은 'memory'만 지원
  actorResolver?: (request) => string|null; // 선택: 인증 방식이 앱마다 다르므로 콜백으로 추출 위임
  genesisHash?: string;                     // 선택: 해시 체인의 시작점 — 환경별 분리 또는 외부 anchor 연결용
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
// ─────────────────────────────────────────────────────────────
// 케이스 1 — Express + Passport 등에서 request.user.id를 사용하는 표준 패턴
// ─────────────────────────────────────────────────────────────
AuditLogModule.forRoot({
  storage: 'memory',
  actorResolver: (request) => request.user?.id ?? null, // 인증 미들웨어가 request.user를 채워둔 상태 가정
})

// ─────────────────────────────────────────────────────────────
// 케이스 2 — Fastify + 세션 기반 인증
// 의도: HTTP 어댑터가 달라도 actorResolver만 바꾸면 라이브러리 코어는 그대로
// ─────────────────────────────────────────────────────────────
AuditLogModule.forRoot({
  storage: 'memory',
  actorResolver: (request) => request.session?.userId ?? null,
})

// ─────────────────────────────────────────────────────────────
// 케이스 3 — 환경별 genesisHash 분리
// 의도: prod/staging/dev 환경의 hash chain이 절대 섞이지 않도록 시작점부터 다르게 설정
// 효과: dev에서 만든 엔트리를 prod로 옮겨도 검증 단계에서 즉시 거부됨
// ─────────────────────────────────────────────────────────────
AuditLogModule.forRoot({
  storage: 'memory',
  actorResolver: (request) => request.user?.id ?? null,
  genesisHash: process.env.GENESIS_HASH, // 환경 변수로 주입 (.env 분리)
})
```

### AuditLogService

프로그래밍 방식으로 감사 로그를 조회하고 검증합니다.

#### 메서드

##### `query(filter: AuditLogFilter): Promise<AuditLogEntry[]>`

조건에 맞는 감사 로그 목록을 반환합니다.

```typescript
// query() — 여러 필터를 AND 조합하여 매칭되는 엔트리만 반환
// 의도: 컴플라이언스 감사 시 "특정 사용자가 특정 기간에 한 행위"를 빠르게 추출
const logs = await auditService.query({
  resource: 'student',                  // 'student' 리소스로 한정
  action: 'student.update',             // 업데이트 액션만
  actorId: 'user123',                   // 'user123' 사용자가 수행한 것만
  startDate: new Date('2026-01-01'),    // 기간 시작
  endDate: new Date('2026-12-31'),      // 기간 종료
});
```

##### `verify(): Promise<VerifyResult>`

해시 체인의 무결성을 검증합니다.

```typescript
// verify() — 저장된 모든 엔트리를 순회하며 hash chain 무결성을 검증
// 동작: 각 엔트리의 selfHash를 재계산해 저장값과 비교 + prevHash가 직전 selfHash와 일치하는지 확인
const result = await auditService.verify();
// 정상 케이스 결과:
// {
//   isValid: true,        // 체인 무결 — 위변조 없음
//   tamperedAt: null,     // 깨진 지점 없음
//   message: "모든 엔트리의 해시 체인이 유효합니다."
// }

// 깨진 케이스 처리 — tamperedAt은 첫 번째 깨진 엔트리의 sequence 인덱스
if (!result.isValid) {
  console.error(`위변조 감지! ${result.tamperedAt}부터 손상됨`); // 보통 알람/경보 시스템으로 연결
}
```

## 📊 데이터 모델

### AuditLogEntry

스토리지에 저장되는 로그 엔트리 구조입니다.

```typescript
// AuditLogEntry — 스토리지에 저장되는 단일 감사 로그 엔트리의 형태
// WHO-WHAT-WHEN-OUTCOME 구조 + 위변조 감지를 위한 hash chain 필드
interface AuditLogEntry {
  // ── 식별자 ──
  id?: string;                                    // 스토리지가 부여 (UUID 등) — 옵셔널: 어댑터에 위임

  // ── WHO (누가) ──
  actorId: string | null;                         // actorResolver가 추출 — 익명/시스템 액션은 null

  // ── WHAT (무엇을) ──
  action: string;                                 // @AuditLog의 action (예: 'student.update')
  resource: string;                               // @AuditLog의 resource (예: 'student')

  // ── WHEN (언제) ──
  occurredAt: Date;                               // 인터셉터 진입 시점 (ISO 8601)

  // ── PAYLOAD (무엇이 어떻게 바뀌었나) ──
  before: Record<string, unknown> | null;         // 마스킹된 인자 (captureArgs=false면 null)
  after: Record<string, unknown> | null;          // 마스킹된 반환값 (captureResult=false면 null)

  // ── OUTCOME (결과) ──
  succeeded: boolean;                             // 원본 메서드가 예외 없이 종료됐는지
  errorMessage?: string;                          // 실패 시 err.message만 (스택 트레이스는 보안상 제외)

  // ── HASH CHAIN (위변조 감지용, 인터셉터/스토리지가 자동 계산) ──
  prevHash: string;                               // 이전 엔트리의 selfHash (또는 첫 엔트리면 genesisHash)
  selfHash: string;                               // SHA256(prevHash + canonicalStringify(자기자신 - selfHash))
}
```

## ⚙️ 설정 가이드

### 1. Express/Fastify 미들웨어에서 사용자 정보 추출

```typescript
// app.module.ts
import { APP_INTERCEPTOR } from '@nestjs/core';

// ─────────────────────────────────────────────────────────────
// 의도: Express/Fastify 어느 쪽이든 동작하도록 사용자 추출 로직을 통합
// 이유: 라이브러리는 HTTP 어댑터에 무관해야 하고, 어떤 인증 미들웨어든 actorResolver로 흡수
// ─────────────────────────────────────────────────────────────
@Module({
  imports: [
    AuditLogModule.forRoot({
      storage: 'memory',
      actorResolver: (request) => {
        // Express + Passport 표준 패턴: request.user
        // Fastify + 세션: request.session.user
        // 둘 다 없으면 null (예: 비로그인 endpoint, 헬스체크 등)
        return request.user?.id ?? request.session?.userId ?? null;
      },
    }),
  ],
})
export class AppModule {}
```

### 2. 민감한 필드 보호

```typescript
// ─────────────────────────────────────────────────────────────
// 의도: 비밀번호 변경 메서드처럼 인자 자체가 거의 다 민감한 케이스
// 패턴: maskFields 배열에 모든 민감 필드를 명시적으로 나열 (whitelist 방식이 아닌 blacklist)
// 대안: 더 안전하게 가려면 captureArgs: false로 인자 자체를 캡처하지 않는 방법도 있음
// ─────────────────────────────────────────────────────────────
@AuditLog({
  action: 'user.updatePassword',
  resource: 'user',
  maskFields: [
    'password',         // 기존 비밀번호
    'newPassword',      // 새 비밀번호
    'confirmPassword',  // 확인용 비밀번호
    'creditCard',       // 결제 정보
    'ssn',              // 주민등록번호 (PIPA)
  ],
})
async updatePassword(id: string, dto: UpdatePasswordDto) {
  // 위 필드들은 모두 [REDACTED]로 저장됨 → DB 덤프가 유출돼도 평문 노출 없음
}
```

### 3. 환경별 분리

```typescript
// ─────────────────────────────────────────────────────────────
// 의도: dev/staging/prod 환경의 hash chain을 시작점부터 분리
// 효과: 한 환경의 엔트리를 다른 환경에 복사해도 검증 시 prevHash 불일치로 즉시 발각
// ─────────────────────────────────────────────────────────────

// dev.env — 개발 환경 시작 해시
GENESIS_HASH=dev_000000000000000000000000000000000000000000000000000000000000

// prod.env — 프로덕션 환경 시작 해시 (다른 값)
GENESIS_HASH=prod_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

// app.module.ts — 환경 변수에서 주입받아 사용
AuditLogModule.forRoot({
  storage: 'memory',
  actorResolver: (request) => request.user?.id ?? null,
  genesisHash: process.env.GENESIS_HASH, // 부팅 시점에 환경별 시작 해시 결정
})
```

## 🔍 사용 사례

### 컴플라이언스 감사

```typescript
// ─────────────────────────────────────────────────────────────
// ComplianceController — 외부 감사관/규제기관에 노출하는 컴플라이언스 엔드포인트
// 의도: SOC2/ISO 감사 시 "로그 무결성 증명"과 "특정 자원의 변경 이력"을 즉시 제공
// ─────────────────────────────────────────────────────────────
@Controller('audit')
export class ComplianceController {
  constructor(private readonly auditService: AuditLogService) {}

  // GET /audit/verify — hash chain 무결성 검증 결과를 컴플라이언스 형태로 응답
  @Get('/verify')
  async verifyCompliance() {
    const result = await this.auditService.verify();
    if (result.isValid) {
      // 정상 — 외부 감사관에게 보여줄 수 있는 응답
      return { status: 'COMPLIANT', message: '모든 감사 로그가 유효합니다.' };
    } else {
      // 위변조 감지 — 즉시 보안팀/감사팀에 에스컬레이션 필요
      return {
        status: 'VIOLATED',
        message: `위변조가 감지되었습니다: ${result.message}`,
      };
    }
  }

  // GET /audit/student/:id — 특정 학생 자원의 전체 변경 이력 조회 (개인정보 열람권 대응)
  @Get('/student/:id')
  async getStudentAuditTrail(@Param('id') id: string) {
    return this.auditService.query({
      resource: 'student',
      resourceId: id, // 해당 ID 자원에 대한 모든 액션 (생성/수정/삭제) 반환
    });
  }
}
```

### 의료/금융 시스템

```typescript
// ─────────────────────────────────────────────────────────────
// 의료 시스템 — HIPAA(미국 의료정보보호법) PHI(보호 대상 의료 정보) 마스킹
// 의도: "이 환자 기록이 갱신되었다"는 사실은 남기되, 실제 진단/연락처는 평문 저장 금지
// ─────────────────────────────────────────────────────────────
@Injectable()
export class PatientRecordService {
  @AuditLog({
    action: 'medical.recordUpdate',
    resource: 'patientRecord',
    maskFields: ['ssn', 'phoneNumber', 'address', 'diagnosis'], // HIPAA Safe Harbor에 정의된 PHI 항목들
  })
  async updateRecord(recordId: string, dto: UpdateRecordDto) {
    return this.repo.update(recordId, dto);
  }
}

// ─────────────────────────────────────────────────────────────
// 결제 시스템 — PCI-DSS(카드 산업 보안 표준) 카드 정보 마스킹
// 의도: 카드 번호/CVV는 절대 평문 저장 금지 (PCI-DSS Requirement 3)
// 주의: amount 마스킹은 컴플라이언스가 아니라 비즈니스 정책 (실제로는 보통 마스킹하지 않음)
// ─────────────────────────────────────────────────────────────
@Injectable()
export class TransactionService {
  @AuditLog({
    action: 'payment.process',
    resource: 'transaction',
    maskFields: ['creditCard', 'cvv', 'amount'],
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
// ─────────────────────────────────────────────────────────────
// Fail-Fast 검증 — 데코레이터 평가 시점(=앱 부팅 시)에 즉시 throw
// 의도: 잘못된 설정이 프로덕션 런타임에 발견되지 않도록 배포 전에 강제로 노출
// ─────────────────────────────────────────────────────────────

// ❌ 부팅 실패: action 누락 → NestJS 앱이 시작조차 안 됨
@AuditLog({ resource: 'student' })
async updateStudent() { }

// ✅ 정상: 필수 필드(action, resource) 모두 제공
@AuditLog({ action: 'student.update', resource: 'student' })
async updateStudent() { }
```

### 런타임 에러 (Non-Blocking)

감사 로그 생성 실패가 비즈니스 로직을 차단하지 않습니다.

```typescript
// ─────────────────────────────────────────────────────────────
// Non-Blocking 정책 — 런타임 audit 실패는 비즈니스 로직을 막지 않음
// 의도: 감사 인프라 장애가 사용자 요청을 실패시키면 안 됨 (관찰성 ≠ 비즈니스 트랜잭션)
// 동작: storage.write() 실패 시 Logger.error만 출력, 메서드는 정상 반환
// 트레이드오프: 매우 드물게 audit 손실 가능 (의도된 절충 — SECURITY.md에 명시)
// ─────────────────────────────────────────────────────────────
@AuditLog({ action: 'student.update', resource: 'student' })
async updateStudent(id: string, dto: UpdateStudentDto) {
  // audit 저장이 실패해도 여기서는 정상 실행됨 — 사용자에게는 200 OK 응답
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
