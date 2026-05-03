# @guardrail/audit — PRD

> **작성일**: 2026-05-02
> **버전**: v0.3 (차별화 컨셉 반영)
> **이전 버전**: v0.2 (`@academykit/audit-log`, 일반 감사 로그)
> **변경 사유**: 시장 조사 결과 기존 NestJS audit-log 라이브러리 5개 모두 단순 INSERT 방식으로, 위변조 감지 기능이 빈자리. 진영님의 학습 + 영향력 목표를 동시에 만족시키기 위해 hash chain 기반 tamper-evident 구조로 컨셉 전환.
> **라이선스**: MIT

---

## 0. 한 줄 요약 (Elevator Pitch)

> NestJS 백엔드에 **데코레이터 한 줄**만 붙이면, **위변조를 감지할 수 있는** 감사 로그를 자동으로 만들어주는 라이브러리.

핵심 단어 3가지:
- **선언적**: 비즈니스 로직 안에 로깅 코드를 안 섞는다
- **위변조 감지(Tamper-evident)**: 누가 DB를 몰래 고쳐도 검증 시 발각된다
- **컴플라이언스 친화**: GDPR, 개인정보보호법, SOC2의 audit log 요건에 자연스럽게 부합한다

---

## 1. 왜 만드는가 (Why)

### 1.1 풀려는 문제

NestJS로 백엔드를 만드는 회사들이 **감사 로그(audit log)를 직접 구현**할 때 흔히 겪는 문제:

1. **로깅 코드가 비즈니스 로직을 더럽힌다** — 모든 메서드에 `auditService.log(...)` 호출을 8~12줄씩 반복.
2. **DB에 그냥 INSERT만 하면 위변조 추적이 불가능** — 누군가 DB에 직접 UPDATE 쳐서 과거 기록을 바꿔도 흔적이 안 남는다.
3. **컴플라이언스(GDPR/HIPAA/SOC2) 요건이 까다로워지고 있다** — "이 로그는 변조되지 않았다"를 증명할 수 없으면 감사에서 탈락.

### 1.2 시장에 이미 있는 것 vs 빈자리

**이미 있는 것**: 단순 INSERT 방식의 audit-log 라이브러리 5개 (모두 단순 데코레이터 + DB 저장).

**빈자리**: NestJS 생태계에서 **hash chain 기반 위변조 감지** 기능을 제공하는 라이브러리는 **없다** (2026-05 기준 시장 조사 결과).

비슷한 기능을 제공하는 외부 SaaS는 있으나 (예: Attest, AuditKit), NestJS 데코레이터 스타일의 통합은 빈자리.

### 1.3 차별화 — 기존 5개 라이브러리 vs `@guardrail/audit`

| 기능 | 기존 5개 (대표: `nestjs-auditlog`) | `@guardrail/audit` |
|---|---|---|
| 데코레이터 한 줄 통합 | ✅ | ✅ |
| DB 저장 | ✅ | ✅ |
| **Hash chain (위변조 감지)** | ❌ | ✅ **핵심 차별화** |
| Append-only 강제 | ❌ | ✅ (v0.2) |
| Verify CLI 도구 | ❌ | ✅ (v0.2) |
| 외부 anchor (Git/S3) | ❌ | ✅ (v0.3) |
| 컴플라이언스 프리셋 | ❌ | ✅ (v0.2) |

**카테고리가 다릅니다.** 기존은 "로그 저장 도구", `@guardrail/audit`은 "법적 증거가 되는 audit 시스템".

---

## 2. 핵심 개념을 쉬운 말로 (Plain English Concepts)

이 PRD를 처음 읽는 사람을 위한 용어 사전.

### 2.1 해시 (Hash)

데이터를 **고정 길이의 도장**으로 압축하는 함수. 한 글자만 달라도 도장이 완전히 다름. 우리는 SHA-256을 사용.

```
"김민수 출석"     → f8a3c4d2... (64자 도장)
"김민수 결석"     → b7c25e91... (완전히 다른 도장)
```

### 2.2 해시 체인 (Hash Chain)

각 audit log 엔트리에 **이전 엔트리의 해시를 포함**해서 새 해시를 만드는 방식.

```
엔트리 1: { 데이터: "김민수 출석", prevHash: null,    selfHash: f8a3... }
엔트리 2: { 데이터: "이지연 결석", prevHash: f8a3..., selfHash: b7c2... }
엔트리 3: { 데이터: "박철수 출석", prevHash: b7c2..., selfHash: d4e1... }
```

**왜 이렇게 하나**: 누군가 엔트리 1을 몰래 수정하면 → selfHash가 바뀜 → 엔트리 2의 prevHash와 안 맞음 → **검증 시 즉시 발각**.

### 2.3 위변조 감지 (Tamper-evident)

위변조를 **막지는 못하지만**, 위변조가 일어나면 **반드시 발견**되는 성질.

> 비유: 영수증의 도장. 도장 위조는 가능하지만, 다른 영수증과 비교하면 들통남.

**중요한 한계**: 우리 라이브러리는 위변조 **방지(prevention)**가 아닙니다. DB 관리자가 직접 데이터를 고치는 걸 막을 수는 없어요. 다만 고치면 검증 단계에서 발견됩니다.

### 2.4 정규 직렬화 (Canonical Serialization)

같은 데이터는 **항상 같은 문자열**로 변환되도록 규칙을 정한 것.

```javascript
// 일반 JSON.stringify (문제 있음)
JSON.stringify({ name: "민수", age: 30 })
// → '{"name":"민수","age":30}'

JSON.stringify({ age: 30, name: "민수" })
// → '{"age":30,"name":"민수"}'  ← 같은 데이터인데 결과 다름

// Canonical serialization (해결)
canonicalStringify({ name: "민수", age: 30 })
// → '{"age":30,"name":"민수"}'  ← 항상 키 알파벳 순

canonicalStringify({ age: 30, name: "민수" })
// → '{"age":30,"name":"민수"}'  ← 동일
```

**왜 필요한가**: 같은 데이터인데 직렬화 결과가 다르면 해시도 달라져서, 위변조 안 했는데도 검증에서 깨진 것처럼 보임. 직렬화 일관성이 hash chain의 생명.

### 2.5 데코레이터 (Decorator)

함수/클래스 위에 `@` 표시로 **자동 기능을 부여**하는 TypeScript 문법.

```typescript
@AuditLog({ action: 'student.update', resource: 'student' })
async updateStudent(id, dto) { ... }
//↑ 데코레이터 한 줄로 메서드 호출 시 자동 audit 기록
```

### 2.6 인터셉터 (Interceptor)

메서드 실행 **전후에 끼어드는** NestJS의 도구. 우리 라이브러리에선 인터셉터가 audit 기록을 자동으로 처리.

### 2.7 어댑터 패턴 (Adapter Pattern)

서로 다른 저장소(메모리/MySQL/Postgres)를 **같은 인터페이스**로 다룰 수 있게 만드는 디자인 패턴. 라이브러리 코어는 한 가지 인터페이스만 알면, 사용자가 어떤 DB를 쓰든 동작.

---

## 3. 사용 시나리오 (Before / After)

### 3.1 Before — 라이브러리 없이 직접 구현

```typescript
@Injectable()
export class StudentsService {
  constructor(
    private readonly repo: StudentsRepository,
    private readonly auditService: AuditService,  // 직접 주입
  ) {}

  async updateStudent(id: string, dto: UpdateStudentDto, user: User) {
    const before = await this.repo.findOne(id);           // 감사용 추가 조회
    const result = await this.repo.update(id, dto);

    // 감사 로그 코드 (모든 메서드에 반복)
    await this.auditService.log({
      actorId: user.id,
      action: 'student.update',
      resource: 'student',
      resourceId: id,
      before,
      after: result,
      occurredAt: new Date(),
    });

    return result;
  }
}
```

**문제점:**
- 메서드마다 8~12줄 반복
- 위변조 감지 안 됨 (단순 INSERT)
- 빠뜨리면 컴플라이언스 위반
- 비즈니스 로직과 감사 로그가 얽혀 가독성 저하

### 3.2 After — `@guardrail/audit` 적용

```typescript
@Injectable()
export class StudentsService {
  constructor(private readonly repo: StudentsRepository) {}

  @AuditLog({ action: 'student.update', resource: 'student' })
  async updateStudent(id: string, dto: UpdateStudentDto) {
    return this.repo.update(id, dto);
  }
}
```

**개선점:**
- 메서드당 코드: 8~12줄 → **1줄**
- 비즈니스 로직 깨끗
- **Hash chain으로 위변조 자동 감지 (v0.2의 verify CLI로 검증)**
- 사용자 ID는 `actorResolver`가 자동 추출

### 3.3 모듈 설정 (앱 시작 시 한 번)

```typescript
@Module({
  imports: [
    AuditLogModule.forRoot({
      storage: 'memory',                              // v0.1은 메모리만
      actorResolver: (req) => req.user?.id ?? null,   // 사용자 ID 추출 콜백
    }),
  ],
})
export class AppModule {}
```

---

## 4. 설계 원칙

1. **마찰 없는 통합 (Frictionless Integration)**
   비즈니스 로직에 감사 로그 코드를 섞지 않는다. 데코레이터 한 줄로 끝.

2. **Fail-Fast 철학**
   설정 오류(필수 필드 누락 등)는 **앱 시작 시점에** 예외 발생. 런타임에 발견되지 않도록.

3. **확장 가능한 스토리지**
   인메모리(v0.1) → TypeORM(v0.2) → Prisma(v0.3) 어댑터 패턴.

4. **민감 정보 보호 기본값**
   `maskFields`로 비밀번호/결제 정보를 저장 전에 가린다.

5. **비즈니스 로직 비차단 (Non-Blocking)**
   감사 로그 시스템 장애가 메인 비즈니스 흐름을 막지 않는다.

6. **위변조 감지 우선 (Tamper-Evident First)** ⭐ 신규
   모든 엔트리는 hash chain으로 묶인다. 위변조 시 검증 단계에서 반드시 발견되도록 설계.

7. **정직한 한계 명시 (Honest Limits)** ⭐ 신규
   "위변조 방지"는 약속하지 않는다. "위변조 감지"만 약속한다. README에 한계 명시.

---

## 5. 제품 개요

| 항목 | 내용 |
|---|---|
| 이름 | `@guardrail/audit` |
| 한 줄 요약 | NestJS 백엔드에 데코레이터 한 줄로 위변조 감지 가능한 감사 로그 추가 |
| 목적 | 컴플라이언스(GDPR/HIPAA/SOC2/PIPA), 디버깅, 사고 대응을 위한 신뢰 가능한 audit 인프라 |
| 타겟 사용자 | NestJS 백엔드 개발자, 특히 의료/핀테크/교육/B2B SaaS 도메인 |
| 라이선스 | MIT |
| 시리즈 | `@guardrail/*` (보안/컴플라이언스 NestJS 모듈 시리즈, 향후 multi-tenant/rate-limit/quota 확장 예정) |

---

## 6. 핵심 용어 정의

| 용어 | 정의 |
|---|---|
| Audit Log | WHO-WHAT-WHEN-OUTCOME 구조의 불변 기록 |
| Actor | 액션을 수행한 주체 (사용자 ID, 시스템 ID). `actorResolver`로 추출 |
| Action | 행위의 고유 이름 (예: `student.update`) |
| Resource | 액션 대상 도메인 객체 종류 (예: `student`) |
| Before / After | 메서드 인자(Args)와 반환값(Result) |
| Hash Chain | 각 엔트리에 이전 엔트리의 해시를 포함시켜 만든 연결 구조 |
| Self Hash | 현재 엔트리의 해시 (이전 해시 + 현재 데이터를 SHA-256으로) |
| Prev Hash | 이전 엔트리의 self hash. 첫 엔트리는 `null` 또는 genesis 값 |

---

## 7. 기능 명세

### [F-01] 선언적 로깅 데코레이터 (`@AuditLog`)

**사용자 스토리**: 백엔드 개발자로서 메서드 위에 데코레이터 한 줄만 붙여 audit 기록을 자동화하고 싶다.

**적용 위치**: NestJS 서비스 또는 컨트롤러 메서드.

#### 입력 필드 (`AuditLogOptions`)

| 필드 | 타입 | 필수 | 존재 이유 + 동작 |
|---|---|---|---|
| `action` | `string` | ✅ | **존재 이유**: 로그 쿼리의 1순위 필터 키. 라이브러리는 도메인을 모르므로 사용자가 명시.<br>**형식**: 네임스페이스 점 표기(`student.update`).<br>**검증**: 빈 문자열 불가 (Fail-Fast). |
| `resource` | `string` | ✅ | **존재 이유**: 자원별 보관/접근 정책 적용의 기준.<br>**형식**: 단수형 명사(`student`).<br>**검증**: 빈 문자열 불가. |
| `captureArgs` | `boolean` | 기본 `true` | **존재 이유**: 가장 흔한 요구는 "무엇이 입력되었나" 기록. 비밀번호 변경 같은 메서드는 `false`로 명시적 안전 옵션. |
| `captureResult` | `boolean` | 기본 `true` | **존재 이유**: 반환값이 크거나 다른 곳에 캡처된 데이터일 때 비활성화. |
| `maskFields` | `string[]` | 선택 | **존재 이유**: GDPR/PIPA 컴플라이언스. 캡처는 하되 민감 필드만 가리는 중간 옵션.<br>**형식**: dot notation 경로 배열(`['user.password']`). |

#### 동작

1. 앱 부팅 시 `action`/`resource` 누락 → 즉시 `Error` (Fail-Fast).
2. Symbol 기반 메타데이터 키 (`AUDIT_LOG_METADATA`)로 충돌 방지.
3. 데코레이터는 메타데이터만 부착. 실제 로깅은 `AuditLogInterceptor`가 수행.

---

### [F-02] 모듈 설정 (`AuditLogModule.forRoot`)

**사용자 스토리**: 앱 루트에서 스토리지와 사용자 추출 방식을 한 번만 설정하고 싶다.

#### 설정 필드 (`AuditLogModuleOptions`)

| 필드 | 타입 | 필수 | 존재 이유 + 동작 |
|---|---|---|---|
| `storage` | `'memory'` | ✅ | v0.1은 `'memory'`만 지원. v0.2에서 `'database'` 추가. |
| `actorResolver` | `(request: unknown) => string \| null` | 선택 | 인증 방식이 앱마다 다르므로 콜백으로 받음. 미제공 시 모든 `actorId`가 `null`. |
| `genesisHash` | `string` | 선택 | **존재 이유**: hash chain의 첫 엔트리에 사용할 시작 해시. 없으면 `'0'.repeat(64)` 사용.<br>**용도**: 환경별 분리(prod/staging) 또는 외부 anchor 연결 (v0.3). |

#### 동작

- 글로벌 모듈로 등록되어 모든 도메인 모듈에서 별도 임포트 없이 `@AuditLog` 사용 가능.

---

### [F-03] 글로벌 인터셉션 (`AuditLogInterceptor`)

**사용자 스토리**: 메서드 호출 시 자동으로 인자/결과를 캡처하고 hash chain에 추가하고 싶다.

#### 동작 흐름

1. 요청 진입 시 `actorResolver`로 `actorId` 추출 (실패 시 `null`).
2. `captureArgs`가 `true`면 인자 캡처 후 `maskFields` 적용.
3. 원본 메서드 실행.
4. **정상 완료**: 반환값 캡처 후 마스킹, `succeeded: true`로 엔트리 구성.
5. **예외 발생**: 에러 메시지 캡처(스택 트레이스 제외), `succeeded: false`. 원본 예외 재throw.
6. **Hash chain 처리** ⭐ 신규:
   - 스토리지에서 마지막 엔트리의 `selfHash`를 조회 (없으면 `genesisHash`).
   - 현재 엔트리 데이터를 canonical serialization으로 직렬화.
   - `selfHash = SHA256(prevHash + canonicalEntry)` 계산.
   - `prevHash`와 `selfHash`를 엔트리에 포함.
7. `await storage.write(entry)` 호출. 실패 시 `Logger.error`로 기록 후 비즈니스 흐름은 차단하지 않음.

#### Hash chain 동시성 고려사항 ⭐ 신규

여러 요청이 동시에 들어올 때 hash chain이 깨지지 않도록 **순차 처리** 필요.

**v0.1 인메모리 구현**: JavaScript는 단일 스레드라 단순 mutex 불필요. 다만 `async` 사이에 다른 요청이 끼어들 수 있으므로 **쓰기 큐** 또는 **메모리 락** 사용.

```typescript
// 단순화된 의사 코드
class InMemoryStorage {
  private writeQueue = Promise.resolve();
  
  async write(entry) {
    this.writeQueue = this.writeQueue.then(async () => {
      const prev = this.entries[this.entries.length - 1];
      entry.prevHash = prev?.selfHash ?? this.genesisHash;
      entry.selfHash = sha256(canonicalStringify(entry));
      this.entries.push(entry);
    });
    return this.writeQueue;
  }
}
```

**v0.2 DB 구현**: `SELECT FOR UPDATE` 또는 advisory lock으로 순차성 보장.

---

### [F-04] 스토리지 어댑터 (`AuditLogStorage`)

**사용자 스토리**: DB를 바꿔도 audit 코어 로직은 그대로 유지하고 싶다.

#### 규격

```typescript
interface AuditLogStorage {
  write(entry: AuditLogEntry): Promise<AuditLogEntry>; // 해시 채워진 엔트리 반환
  query(filter: AuditLogFilter): Promise<AuditLogEntry[]>;
  getLast(): Promise<AuditLogEntry | null>;            // 체인 연결용
}
```

#### 구현체

- **v0.1**: `InMemoryAuditLogStorage` (배열 + 쓰기 큐).
- **v0.2**: `TypeOrmAuditLogStorage`.
- **v0.3**: `PrismaAuditLogStorage`.

---

### [F-05] Hash Chain 코어 ⭐ 신규

**사용자 스토리**: 라이브러리가 자동으로 모든 엔트리를 hash chain으로 묶어주길 원한다.

#### 컴포넌트

1. **`canonicalStringify(obj)` 유틸**
   - 객체 키를 알파벳 순 정렬
   - 숫자/문자열/null/undefined 표준화
   - 자체 구현 (외부 의존성 0)

2. **`computeHash(prevHash, entry)` 유틸**
   - `SHA-256(prevHash + canonicalStringify(entry))`
   - Node.js 내장 `crypto` 사용

3. **체인 검증 함수 (v0.1엔 라이브러리 내부 테스트용, v0.2부터 Public API)**
   - 엔트리 배열을 받아 모든 hash chain 무결성 확인
   - 깨진 첫 엔트리 인덱스 + 예상/실제 해시 반환

#### 보안 결정

- **알고리즘**: SHA-256 (널리 검증, Node.js 내장).
- **솔트(salt)**: v0.1에선 미사용. v0.3에서 옵션 추가 검토.
- **HMAC**: v0.1에선 미사용. 외부 anchor(v0.3)에서 검토.

---

## 8. 데이터 모델 (`AuditLogEntry`)

```typescript
interface AuditLogEntry {
  // 식별자
  id?: string;                              // 저장소 자동 생성

  // WHO
  actorId: string | null;                   // 액션 수행자 ID

  // WHAT
  action: string;                           // 행위 이름
  resource: string;                         // 자원 종류
  resourceId?: string;                      // v0.1: 항상 undefined (Out of Scope)

  // WHEN
  occurredAt: Date;                         // ISO 8601

  // PAYLOAD
  before: Record<string, unknown> | null;   // 마스킹된 인자
  after: Record<string, unknown> | null;    // 마스킹된 반환값

  // OUTCOME
  succeeded: boolean;
  errorMessage?: string;

  // HASH CHAIN ⭐ 신규
  prevHash: string;                         // 64자 hex (이전 엔트리의 selfHash, 없으면 genesisHash)
  selfHash: string;                         // 64자 hex (현재 엔트리의 SHA-256)
  sequence: number;                         // 0부터 시작하는 순번 (검증/디버그용)
}
```

### 8.1 `resourceId` 처리 정책 (v0.1)

**v0.1에서는 `resourceId`를 자동 추출하지 않는다.** 메서드 인자 중 어느 것이 ID인지 라이브러리가 추측하면 오답 위험. v0.2에서 `@ResourceId()` 파라미터 데코레이터로 명시적 지정 도입.

---

## 9. 예외 케이스 처리

| 케이스 | 처리 방식 |
|---|---|
| `@AuditLog`에 `action`/`resource` 누락 | 앱 기동 시 `Error` throw (Fail-Fast) |
| `actorResolver` 미제공 또는 추출 실패 | `actorId`를 `null`로 기록 |
| 원본 비즈니스 로직 예외 | `succeeded: false`, `errorMessage` 기록 후 원본 예외 재throw |
| `storage.write()` 실패 (예: DB 장애) | `Logger.error` 출력, 비즈니스 로직 정상 진행 (롤백 X) |
| `maskFields` 경로가 객체에 없음 | 무시하고 정상 로깅 |
| 캡처 데이터에 순환 참조 | `'[Unserializable]'` 대체 |
| 동시 호출로 인한 hash chain 경쟁 | 쓰기 큐로 순차 처리 |

---

## 10. 비기능 요구사항

| 항목 | 기준 |
|---|---|
| 성능 (목표) | 인터셉터 오버헤드 10ms 이내 (v0.1엔 측정만, 자동 회귀 검증은 백로그) |
| 의존성 | `peerDependencies`: `@nestjs/common`, `@nestjs/core`, `rxjs`, `reflect-metadata`. 자체 의존성 0. |
| 번들링 | tsup으로 CJS + ESM + .d.ts 빌드 |
| 타입 지원 | 완벽한 `.d.ts` + JSDoc + `@example` |
| 노드 버전 | Node.js >= 18 |
| 해시 알고리즘 | SHA-256 (Node.js `crypto` 내장) |

---

## 11. 범위 제외 (Out of Scope) — v0.1

1. **DB 연동**: TypeORM/Prisma는 v0.2/v0.3.
2. **Verify CLI**: `@guardrail/audit-verify` 별도 도구는 v0.2.
3. **Append-only 강제**: DB 레벨 UPDATE/DELETE 차단은 v0.2.
4. **컴플라이언스 프리셋**: GDPR/HIPAA 자동 설정은 v0.2.
5. **외부 anchor**: Git/S3 백업은 v0.3.
6. **Diff 계산**: before/after의 변경점 계산은 사용자 책임.
7. **`forRootAsync`**: 비동기 의존성 주입은 v0.1.x 패치.
8. **`resourceId` 자동 추출**.
9. **다국어 에러 메시지**: 영어만.
10. **HMAC / 솔트**: 외부 키 도입은 v0.3.

---

## 12. 백로그 (시리즈 로드맵)

### `@guardrail/audit` 자체 로드맵

1. **v0.2 — 검증 도구**
   - Verify CLI (`npx @guardrail/audit verify`)
   - TypeORM 어댑터
   - Append-only 강제 (Subscriber로 UPDATE/DELETE 차단)
   - 컴플라이언스 프리셋 v1 (GDPR 기본값)
   - 체인 검증 Public API

2. **v0.3 — 외부 앵커링**
   - Git commit hash 백업
   - S3 immutable bucket 연동
   - Prisma 어댑터
   - HMAC 옵션

3. **v1.0 — 프로덕션 준비**
   - 성능 벤치마크 자동화
   - 보안 감사 (커뮤니티 리뷰)
   - 안정 API 보증
   - 완전 영어/한국어 문서

### `@guardrail/*` 시리즈 확장 (장기)

- `@guardrail/multi-tenant` — 자동 tenant 격리 (audit log도 tenant 분리)
- `@guardrail/rate-limit` — 선언적 rate limiting + quota
- `@guardrail/secrets` — 환경 변수 마스킹 + 시크릿 회전 (검토 단계)

---

## 13. 구현 마일스톤

### v0.0.1 (Week 1) — Foundation ✅ 진행 중
- [x] PRD 작성 (v0.1 → v0.2 → v0.3)
- [ ] Repo 스캐폴드 (`@guardrail/audit`)
- [ ] 빌드 파이프라인 (pnpm + tsup)
- [ ] 4개 핵심 인터페이스 (`AuditLogOptions`, `AuditLogEntry`, `AuditLogStorage`, `AuditLogFilter`)
- [ ] `@AuditLog` 데코레이터 골격 (메타데이터만)
- [ ] `AuditLogModule` 골격
- [ ] README v0.1 (영문/한글)

### v0.0.2 (Week 2) — Hash Chain Core ⭐ 차별화 핵심
- [ ] `canonicalStringify` 유틸 + 단위 테스트
- [ ] `computeHash` 유틸 + 단위 테스트
- [ ] 체인 검증 함수 (내부 테스트용)
- [ ] 직렬화 안전 래퍼 (순환 참조 처리)

### v0.0.3 (Week 3) — Interceptor + Storage
- [ ] `AuditLogInterceptor` 구현
- [ ] `InMemoryAuditLogStorage` (쓰기 큐 포함)
- [ ] `maskFields` 유틸 (자체 구현)
- [ ] 동시성 시나리오 통합 테스트 (hash chain 무결성)

### v0.0.4 (Week 4) — Module Wiring + Demo
- [ ] `AuditLogModule.forRoot()` 완성
- [ ] 글로벌 인터셉터 자동 부착
- [ ] `examples/basic-nestjs/` 데모 (NestJS 앱 + 데코레이터 예시)
- [ ] `examples/verify-chain/` 데모 (체인 검증 시연)

### v0.1.0 (Week 5) — Public Release
- [ ] CHANGELOG.md
- [ ] CI 파이프라인 (GitHub Actions: lint + test + build)
- [ ] README 영문/한글 최종 (한계 명시 포함)
- [ ] 보안 한계 문서 (`SECURITY.md`)
- [ ] npm publish (`@guardrail/audit@0.1.0`)
- [ ] 공개 채널: dev.to (영문), 본인 블로그 (한글), X(트위터), NestJS Discord, r/node, 긱뉴스, OKKY

**총 예상 기간**: 5주 (매일 1시간 × 35일 = 35시간). 본업 영향 시 유연하게.

---

## 14. 보안 고려사항

### 14.1 정직한 한계 명시 (필수)

README와 SECURITY.md에 다음을 명확히 적어야 함:

> **`@guardrail/audit` provides tamper-evidence, NOT tamper-prevention.**
>
> What this library does:
> - Detects unauthorized modifications via hash chain verification
> - Provides cryptographic evidence of log integrity at point of read
> - Helps satisfy compliance requirements that require "demonstrable integrity"
>
> What this library does NOT do:
> - Prevent a database administrator with write access from modifying logs
> - Prevent application bugs from writing wrong data
> - Provide cryptographic non-repudiation without external anchoring (v0.3)
> - Replace proper access control on your audit storage

### 14.2 데이터 노출

- audit log 자체가 가장 큰 정보 자산
- v0.1 인메모리는 프로덕션 부적합 (README 경고)
- 스토리지 접근 권한은 호스트 앱 책임

### 14.3 마스킹의 한계

- `maskFields`는 알려진 경로만 가림
- 권장 패턴: 비밀번호 메서드는 `captureArgs: false` 강제

### 14.4 GDPR / 개인정보보호법

- "삭제 요청권" 처리는 호스트 앱 책임
- Hash chain 특성상 중간 엔트리 삭제 시 체인 깨짐 → "tombstone" 패턴 (v0.2 검토)

### 14.5 알고리즘 선택 근거

- **SHA-256**: NIST 권고, Node.js 내장, 충돌 저항성 검증.
- **MD5/SHA-1**: 사용 안 함 (충돌 알려짐).
- **SHA-3 / Blake2**: v0.3에서 옵션화 검토.

---

## 15. 실패 모드 분석

| # | 실패 모드 | 영향 | 완화책 |
|---|---|---|---|
| 1 | 인메모리 메모리 누수 | OOM 위험 | "프로덕션 부적합" 경고. 최대 엔트리 옵션은 백로그 |
| 2 | 캡처 객체에 순환 참조 | 직렬화 실패 | `JSON.stringify` replacer로 감지, `'[Unserializable]'` 대체 |
| 3 | `reflect-metadata` 미설치 | 데코레이터 무동작 | peerDependencies 명시, README 가이드 |
| 4 | `actorResolver` throw | 인터셉터 실패 가능 | try/catch로 감싸고 `actorId: null` fallback |
| 5 | 거대한 인자/반환값 (10MB+) | 메모리/성능 폭발 | v0.1 단순 캡처. v0.2 `maxCaptureSize` 백로그 |
| 6 | hash chain 동시 쓰기 | 체인 깨짐 | 쓰기 큐로 순차 처리 (F-03) |
| 7 | NestJS 외부에서 사용 | 인터셉터 미동작 | "NestJS 컨텍스트 필수" README 명시 |
| 8 | 직렬화 비결정성 (Date, undefined 등) | 검증 시 false positive | canonical 규칙에 모든 타입 처리 명시, 단위 테스트 |
| 9 | genesisHash 누락/오용 | 환경 간 체인 혼선 | forRoot에서 검증, 권장 패턴 README |

---

## 16. 의존성 결정

### 16.1 SHA-256 구현 — Node.js 내장 `crypto`
- 외부 라이브러리(`js-sha256`, `crypto-js`) 미사용
- 이유: 내장 모듈이 가장 빠르고 검증됨

### 16.2 Canonical JSON — 자체 구현
- 외부 라이브러리(`canonical-json`, `json-stable-stringify`) 검토 후 미사용
- 이유: 핵심 로직은 직접 통제, 50줄 이내 구현 가능

### 16.3 lodash — 미사용
- `maskFields`의 dot notation은 자체 구현
- 이유: 의존성 0 유지, 30~50줄 자체 구현 가능

### 16.4 의존성 최종 목록

**peerDependencies** (사용자 앱이 가진 것):
- `@nestjs/common` (^10 || ^11)
- `@nestjs/core` (^10 || ^11)
- `rxjs` (^7)
- `reflect-metadata` (^0.1.13 || ^0.2)

**dependencies** (라이브러리 자체): **없음** (의도적, v0.1 기준)

---

## 17. 버전 정책

- **v0.x**: API 변경 가능 (semver 0.x.y는 모두 breaking 가능)
- **v1.0 이후**: semver 엄격 적용
- **v0.1 → v0.2 호환 약속**: `@AuditLog` 시그니처 + `AuditLogEntry` 타입 변경 없음
- **모든 breaking change**: `BREAKING.md` + GitHub release notes 명기

---

## 18. 기존 라이브러리 비교 (시장 조사 기반)

| 라이브러리 | 별 (대략) | 마지막 업데이트 | 위변조 감지 | NestJS 통합 |
|---|---|---|---|---|
| `nestjs-auditlog` (thanhlcm90) | 적음 | 활성 | ❌ | ✅ |
| `@appstellar/nestjs-audit` | ~7 | 2024 | ❌ | ✅ |
| `@forlagshuset/nestjs-audit-logging` | ~21 | 2024 | ❌ | ✅ |
| `@solunertech/audit` | 매우 적음 | 2026-03 | ❌ | ✅ |
| `@pavel_martinez/nestjs-auditlog` | 2 | 2025 | ❌ | ✅ |
| **`@guardrail/audit`** | (신규) | 2026-05 | ✅ | ✅ |

### 18.1 `@guardrail/audit` 차별화 포인트

1. **Hash chain 기반 위변조 감지** — NestJS 생태계 유일 (2026-05 기준)
2. **`@guardrail/*` 시리즈 일부** — 향후 multi-tenant/rate-limit 등과 통합
3. **정직한 한계 명시** — "tamper-evident, not tamper-prevention" 명확화로 신뢰 확보
4. **활발한 유지보수 의지** — 시리즈의 1번 모듈이라 장기 유지 동기 명확

---

## 19. 변경 이력

| 버전 | 일자 | 주요 변경 |
|---|---|---|
| v0.1 | 2026-05-02 | 초안 (8 섹션) |
| v0.2 | 2026-05-02 | 사용 시나리오, 필드 존재 이유, 보안/실패모드/의존성/버전정책/타사비교 추가 |
| v0.3 | 2026-05-02 | **컨셉 전환**: `@academykit/audit-log` → `@guardrail/audit`. Hash chain 차별화 도입. 시장 조사 기반 빈자리 공략. v0.1 마일스톤 5주로 재조정. |