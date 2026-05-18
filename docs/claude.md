# Claude 작업 규칙 — nestjs-tenant-shield

> 이 파일은 Claude Code가 이 프로젝트에서 일할 때 따르는 운영 규칙이다.
> 100줄 안팎 유지. 데이터 4건 이상 반복된 패턴만 규칙으로 격상한다.
> 변경 시 [process.md](./process.md) §변경 이력에 기록.

---

## 0. 작업 시작 전 필수 확인 (Top of the loop)

매 세션 시작 또는 새 작업 진입 시 다음을 **순서대로** 읽는다.

1. [process.md](./process.md) — "지금 여기"와 "다음 진입점" 확인
2. [critical-notes.md](./critical-notes.md) — 이 프로젝트에서 이미 발견된 함정 목록
3. [tenant-shield-PRD.md](./tenant-shield-PRD.md) §3 설계 원칙 — 7가지 원칙 위반 여부 셀프체크
4. 작업 디렉토리 git status — 미커밋 변경 사항 파악

이 4가지 없이 코드 손대지 않는다.

---

## 1. 프로젝트 정체성

- **이름**: nestjs-tenant-shield (단일 npm 패키지)
- **목표**: NestJS B2B SaaS의 자동 멀티테넌시 격리. 데코레이터 한 줄로 `WHERE tenant_id` 자동 주입.
- **현재 버전**: v0.1 (discriminator 패턴, TypeORM 어댑터)
- **핵심 가치**: Fail-Loud (cross-tenant 접근은 즉시 throw)

---

## 2. 모델 선택 가이드

| 작업 유형 | 모델 | 이유 |
|---|---|---|
| 신규 기능 플래닝, ADR | Opus | 누락 적음, 트레이드오프 판단 |
| 멀티테넌시 격리 로직 (subscriber, decorator) | Opus | 격리 깨지면 보안 사고 → 신중하게 |
| 테스트 작성, 문서 보강 | Sonnet | 비용 효율 |
| 단순 리팩토링, 타입 정리 | Sonnet | 충분 |
| 회고 (/eval-review) | Opus | 패턴 추출은 Opus가 깊다 |

**자동 승격 트리거는 신뢰하지 않는다.** 위 표 기준으로 매번 명시적 선택.

---

## 3. 코딩 컨벤션 (검증된 것만)

### 3.1 격리 규칙 (절대)
- `tenant_id` 컬럼이 있는 entity는 모두 `@RequireTenant()` 통과 보장돼야 한다.
- `runWithoutTenant`는 **시스템 작업 + `@SystemAction`** 조합에서만 사용. 일반 비즈니스 로직에서 호출 금지.
- cross-tenant 우회 코드를 추가할 때는 **반드시** PR 본문에 우회 사유 명시.

### 3.2 NestJS 와이어링
- `DynamicModule`에 `global: true` 명시. forRoutes는 wildcard 대신 `{ path, method }` 형태.
- Subscriber 자동 등록은 `onApplicationBootstrap`에서 `ModuleRef`로 DataSource lookup. TypeORM 미사용 시 silent skip.
- `@Cacheable`은 `this.cacheService ?? getGlobalCache()` fallback 패턴 유지.

### 3.3 테스트
- Repository prototype patch 함수는 sync throw 금지. **`Promise.reject(err)` 통일** (과거 expect.rejects 불일치 사고).
- e2e는 cross-tenant 격리 검증을 항상 포함한다.

### 3.4 커밋
- conventional prefix(`feat`/`docs`/`test`/`fix`) + scope + 한국어 본문.
- 마일스톤 단위로 커밋. 단계 끝에서 `npx tsc -p tsconfig.build.json --noEmit && npx jest` 통과 확인 후 1 커밋.
- push는 사용자 confirm 후. 한 번 동의가 다음 동의를 의미하지 않는다.

---

## 4. 슬래시 커맨드 (자가 개선 루프)

상세는 [workflow.md](./workflow.md).

- `/eval` — 작업 직후 호출. `~/.claude/evaluations.md`에 양식대로 append.
- `/eval-review` — 평가 20건 이상 누적 시 Opus 회고 호출. 4건 이상 반복 패턴만 이 파일에 반영.
- `ccusage` — 비용 추적. 큰 작업 전후로 차분 확인.

---

## 5. 절대 금지

- **데이터 없는 규칙 추가**: "이러면 좋지 않을까?" 추측으로 이 파일 줄 늘리지 않는다. 4건 이상 반복 패턴만.
- **자동 트리거**: "X 상황이면 자동으로 Opus" 류 규칙. 명시 호출이 신뢰성 높다.
- **destructive git**: `git reset --hard`, `push --force`, `rebase -i`, `--no-verify`. 사용자 명시 요청 시에만.
- **무단 의존성 추가**: peer dep 정책 (Nest 10/11, rxjs 7) 깨지지 않도록.
- **cross-tenant 우회 코드 무신고**: PR 본문에 우회 사유 없으면 절대 머지 금지.

---

## 6. 응답 스타일

- 결과·결정 중심. 사고 과정 나열 금지.
- 파일·라인 인용은 markdown link 형식: `[process.md:42](./process.md#L42)`.
- 코드 블록 안 주석은 **WHY**가 비자명할 때만. 식별자가 설명하면 주석 없음.
- 단계 마무리 시 보고: 무엇을 끝냈고, 다음 진입점은 무엇이고, 선택지가 있는지.

---

## 7. 변경 정책

이 파일을 수정할 때:
1. 추가하려는 규칙이 4건 이상 반복된 패턴인지 [evaluations.md](~/.claude/evaluations.md)에서 검증.
2. 신규 규칙 추가 시 효과 없는 기존 규칙 1개 제거 검토 (총량 유지).
3. [process.md](./process.md) §변경 이력에 기록.
