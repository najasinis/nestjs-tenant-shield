# @guardrail/audit 라이브러리 명세서 (API Spec)

NestJS 백엔드에서 위변조 감지(Tamper-evident) 기능을 갖춘 감사 로그를 자동으로 생성하는 `@guardrail/audit` 라이브러리의 프로그래밍 인터페이스(API) 전체를 다룬다. REST API가 아닌 **NestJS 모듈 및 데코레이터 형태의 Public API Surface**를 명세한다.

관련 PRD: `@guardrail/audit — PRD (v0.3)`

- 패키지명: `@guardrail/audit`
- 버전: `v0.1.x` (사전 출시, 인메모리 스토리지 기준)
- 환경: NestJS (`@nestjs/common`, `@nestjs/core`), TypeScript

---

## 1. 공통 규칙

### 해시 체인 (Hash Chain) 및 위변조 감지
모든 감사 로그 엔트리는 직전 엔트리의 해시값(`prevHash`)을 포함하여 자신의 해시(`selfHash`)를 계산한다. 이를 통해 중간에 데이터가 변조되거나 삭제되면 체인이 끊어져 검증 단계에서 즉각 발각된다.

- **해시 알고리즘**: SHA-256 (Node.js 내장 `crypto` 모듈 사용)
- **직렬화 규칙**: 객체 속성의 순서가 달라도 동일한 문자열을 생성하는 정규 직렬화(Canonical Serialization)를 거친 후 해싱한다.
- **초기 해시**: 첫 번째 엔트리의 `prevHash`는 모듈 설정 시 주입받은 `genesisHash`를 사용한다. (미지정 시 `'0'.repeat(64)`)

### 예외 처리 (Fail-Fast vs Non-Blocking)
- **부팅 시점 (Fail-Fast)**: 필수 파라미터 누락, 잘못된 타입 등 설정 오류는 앱 기동 시 데코레이터 평가 단계에서 즉시 `Error`를 던져 배포 전에 발견되도록 한다.
- **런타임 시점 (Non-Blocking)**: 로깅 과정(직렬화, 해싱, 스토리지 저장)에서 발생하는 오류는 `Logger.error`로 기록할 뿐, 원본 비즈니스 로직의 트랜잭션을 롤백시키거나 흐름을 차단하지 않는다.

---

## 2. 모듈 API 명세

### 2.1 루트 모듈 설정: `AuditLogModule.forRoot()`

애플리케이션 루트(`AppModule`)에서 한 번만 호출하여 감사 로그 시스템을 전역으로 초기화한다.

#### 파라미터 (AuditLogModuleOptions)

```typescript
export interface AuditLogModuleOptions {
  storage: 'memory'; // v0.1은 'memory'만 지원. v0.2에서 'database' 추가 예정
  actorResolver?: (request: unknown) => string | null;
  genesisHash?: string;
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `storage` | string | Y | 사용할 스토리지 어댑터 지정. 현재는 `'memory'`만 유효하다. |
| `actorResolver` | Function | N | 들어오는 요청(Request) 객체에서 행위자(Actor) ID를 추출하는 콜백 함수. 미제공 시 모든 액션은 `null` (시스템/익명)로 기록된다. |
| `genesisHash` | string | N | 해시 체인의 첫 번째 엔트리가 참조할 초기 해시값. 미입력 시 64자리의 '0' 문자열이 사용된다. 환경(prod/dev) 분리용으로 유용하다. |

#### 동작 방식
이 메서드를 통해 모듈이 `global: true`로 등록되며, 내부적으로 `AuditLogInterceptor`가 전역 인터셉터로 바인딩된다. 따라서 각 도메인 모듈에서 별도로 임포트할 필요가 없다.

---

### 2.2 선언적 로깅: `@AuditLog()` 데코레이터

특정 서비스 또는 컨트롤러 메서드에 부착하여 해당 메서드의 호출을 감사 로그로 기록한다.

#### 파라미터 (AuditLogOptions)

```typescript
export interface AuditLogOptions {
  action: string;
  resource: string;
  captureArgs?: boolean;
  captureResult?: boolean;
  maskFields?: string[];
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `action` | string | Y | 액션의 고유 식별자. (예: `'student.update'`) 빈 문자열 불가. |
| `resource` | string | Y | 대상 리소스의 종류. (예: `'student'`) 빈 문자열 불가. |
| `captureArgs` | boolean | N | 메서드 인자 캡처 여부. 기본값은 `true`. 민감한 인자(비밀번호 등)만 받는 경우 `false` 권장. |
| `captureResult`| boolean | N | 메서드 반환값 캡처 여부. 기본값은 `true`. 반환값이 너무 크거나 불필요할 때 `false` 지정. |
| `maskFields` | string[] | N | 캡처된 객체에서 값을 `[REDACTED]`로 치환할 필드 경로 배열. (예: `['user.password']`) 점(dot) 표기법을 지원한다. |

#### 동작 방식
- 부팅 시 `action` 또는 `resource`가 유효하지 않으면 예외를 던진다.
- 런타임 시 글로벌 인터셉터가 이 메타데이터를 읽어 동작한다.

---

### 2.3 스토리지 어댑터 인터페이스: `AuditLogStorage`

스토리지 구현체가 반드시 준수해야 하는 규격이다. v0.1은 `InMemoryAuditLogStorage`를 내장한다.

#### 인터페이스 정의

```typescript
export interface AuditLogStorage {
  write(entry: AuditLogEntry): Promise<void>;
  query(filter: AuditLogFilter): Promise<AuditLogEntry[]>;
}
```

| 메서드 | 파라미터 | 반환 타입 | 설명 |
| --- | --- | --- | --- |
| `write` | `AuditLogEntry` | `Promise<void>` | 단일 감사 로그 엔트리를 스토리지에 저장한다. 동시성 보장을 위해 내부적으로 쓰기 큐(Write Queue)나 락(Lock)을 사용해야 한다. |
| `query` | `AuditLogFilter` | `Promise<AuditLogEntry[]>` | 조건에 맞는 감사 로그 엔트리 목록을 반환한다. |

---

## 3. 데이터 모델 (AuditLogEntry)

스토리지에 최종 저장되고, 해시 계산의 대상이 되는 로그 엔트리의 규격이다.

```typescript
export interface AuditLogEntry {
  id?: string;
  actorId: string | null;
  action: string;
  resource: string;
  occurredAt: Date;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  succeeded: boolean;
  errorMessage?: string;
  
  // Hash Chain 관련 필드 (인터셉터가 자동 계산)
  prevHash: string;
  selfHash: string;
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 스토리지 어댑터가 부여하는 고유 ID (UUID 등). |
| `actorId` | string \| null | `actorResolver`가 추출한 사용자 ID. |
| `action` | string | `@AuditLog` 데코레이터에서 선언한 액션명. |
| `resource` | string | `@AuditLog` 데코레이터에서 선언한 리소스명. |
| `occurredAt` | Date | 액션이 발생한 시각 (인터셉터 진입 시점). |
| `before` | Record \| null | `captureArgs`가 `true`일 때 마스킹 처리된 파라미터 맵. |
| `after` | Record \| null | `captureResult`가 `true`일 때 마스킹 처리된 반환값. |
| `succeeded` | boolean | 원본 메서드가 예외 없이 정상 종료되었는지 여부. |
| `errorMessage` | string | 실패 시 발생한 예외의 메시지 (스택 트레이스 제외). |
| `prevHash` | string | 직전 엔트리의 `selfHash` (첫 엔트리는 `genesisHash`). |
| `selfHash` | string | `prevHash`와 현재 엔트리 데이터를 정규 직렬화한 문자열을 SHA-256으로 해싱한 값. |

---

## 4. 내부 로직 전략 (동시성 및 해싱)

### 4.1 해시 체인 생성 및 쓰기 큐 전략
해시 체인의 무결성을 유지하려면, `prevHash`를 읽고 새로운 `selfHash`를 계산하여 저장하는 일련의 과정이 **원자적(Atomic)**으로 이루어져야 한다.

```typescript
// InMemoryStorage 내부의 단순화된 쓰기 큐 로직
class InMemoryAuditLogStorage implements AuditLogStorage {
  private entries: AuditLogEntry[] = [];
  private writeQueue: Promise<void> = Promise.resolve();
  private genesisHash: string;

  constructor(genesisHash: string) {
    this.genesisHash = genesisHash;
  }

  async write(entry: AuditLogEntry): Promise<void> {
    // 이전 작업이 끝날 때까지 대기하여 순차 처리 보장
    this.writeQueue = this.writeQueue.then(async () => {
      const prev = this.entries[this.entries.length - 1];
      entry.prevHash = prev ? prev.selfHash : this.genesisHash;
      
      // selfHash 계산 전, selfHash 필드는 제외하고 직렬화
      const dataToHash = { ...entry };
      delete dataToHash.selfHash;
      
      entry.selfHash = sha256(canonicalStringify(dataToHash));
      this.entries.push(entry);
    });
    
    return this.writeQueue;
  }
}
```

### 4.2 정규 직렬화 (Canonical Serialization) 전략
자바스크립트 객체의 키 순서가 달라져 해시값이 변경되는 것을 방지하기 위해 자체 직렬화 유틸리티를 사용한다.

- 모든 객체의 키는 알파벳 오름차순으로 정렬한다.
- 순환 참조(Circular Reference)가 발견되면 해당 값을 `'[Unserializable]'` 문자열로 치환하여 직렬화 실패를 방지한다.
- `Date` 객체는 `toISOString()`으로 변환한다.

---

## 5. 오류 코드 (설정 및 런타임)

| 분류 | 예외 종류 | 발생 조건 | 클라이언트/시스템 영향 |
| --- | --- | --- | --- |
| 설정 오류 | `Error` | `@AuditLog`의 `action` 또는 `resource` 누락 시 | 앱 부팅 실패 (Fail-Fast). 배포 전 수정 필수. |
| 런타임 | `Error` (로깅됨) | `canonicalStringify` 실패 또는 스토리지 `write` 실패 | `Logger.error`로 터미널에 출력됨. 원본 비즈니스 로직은 정상 진행됨. |
| 비즈니스 | (원본 예외) | 원본 서비스 메서드 내부에서 예외 발생 시 | 로그 엔트리의 `succeeded: false` 처리 후 원본 예외 재발생 (투명한 예외 전파). |

---

## 6. 비즈니스 규칙 요약

| 규칙 | 내용 |
| --- | --- |
| 위변조 감지 최우선 | 모든 신규 엔트리는 예외 없이 해시 체인에 묶여야 한다. 검증 시 체인이 끊어지면 위변조로 간주한다. |
| 비차단 (Non-Blocking) | 감사 로그 생성/저장 실패가 사용자의 핵심 비즈니스 요청을 실패하게 만들어서는 안 된다. |
| 민감 정보 마스킹 | `maskFields`에 지정된 경로는 저장 전 반드시 `[REDACTED]` 문자열로 치환되어야 한다. |
| 스택 트레이스 제외 | 에러 로깅 시 내부 경로 유출을 막기 위해 `errorMessage`만 저장하고 스택 트레이스는 제외한다. |

---

## 7. 미결 사항 (v0.2 이후 백로그)

| # | 항목 | 내용 |
| --- | --- | --- |
| 1 | DB 동시성 제어 | TypeORM 등 RDBMS 도입 시 해시 체인 무결성을 위한 `SELECT FOR UPDATE` 또는 Advisory Lock 적용 방안 확정 필요. |
| 2 | 검증 CLI 도구 | 해시 체인을 순회하며 위변조 지점을 찾아내는 `verify` 스크립트 또는 Public API 규격 설계. |
| 3 | Tombstone 패턴 | 개인정보 삭제 요청 시 체인을 깨지 않으면서 특정 엔트리의 데이터를 지우는(Tombstone) 방안 검토. |
