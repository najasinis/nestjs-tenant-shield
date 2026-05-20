# 개발 프로세스 & 진행 현황

> 이 문서는 "지금 어디까지 왔고, 다음에 무엇을 할지"를 한눈에 보기 위한 작업 일지다.
> 마일스톤 단위로 갱신한다. 운영 규칙은 [claude.md](./claude.md), 함정 목록은
> [critical-notes.md](./critical-notes.md), 회고 워크플로는 [workflow.md](./workflow.md).
> 상세 사양은 [tenant-shield-PRD.md](./tenant-shield-PRD.md) /
> [tenant-shield-api-spec.md](./tenant-shield-api-spec.md) 참고.

---

## 📌 지금 여기 (Live Dashboard)

```
0단계 ✅ → 1번 ✅ → 2번 🔄 (2-a ✅ / 2-b ◀ 다음 진입 / 2-c ⏳ / 2-d ⏳) → 3~6번 ⏳
```

| 항목 | 값 |
|---|---|
| **현재 진입점** | To-Do 2번-b — `@SystemAction` 세분화 + 테스트 강화 (§5) |
| **최신 커밋** | `ab180ae` — feat(cache): forRoot의 cache 슬롯으로 외부 어댑터 주입 지원 |
| **다음 체크포인트** | 2-b 완료 후 `/eval` 호출 + 회고 누적 건수 확인 |
| **다음 회고 시점** | 평가 20건 누적 시 `/eval-review` (Opus) |
| **블로커** | 없음 |
| **마지막 갱신** | 2026-05-13 |

### 매 세션 시작 시 자가 점검

```bash
# 1. 현재 브랜치/미커밋 변경 확인
git status

# 2. 빌드/테스트 그린 라인 유지 확인
npx tsc -p tsconfig.build.json --noEmit && npx jest

# 3. origin과 동기화 상태 확인
git log --oneline origin/main..HEAD
git log --oneline HEAD..origin/main
```

위 3개가 깨끗하지 않으면 신규 작업 진입 금지. 우선 정리한다.

---

## 1. 전체 로드맵 (큰 그림)

원본 To-Do 리스트 (6 카테고리):

| # | 카테고리 | 핵심 작업 | 상태 |
|---|---|---|---|
| **0** | (재정렬로 추가) v0.1 약속 완성 | Subscriber 자동 등록, @Cacheable DI 연결, 와이어링 정리 | ✅ |
| 1 | 안정화 및 문서화 | README 정밀 범위, runWithoutTenant 가이드, examples 보강, e2e 커버리지 | ✅ |
| 2 | 기능 확장 | 캐시 어댑터 DI, @SystemAction 세분화, Bull/BullMQ, Prisma | 🔄 |
| 3 | 보안/안정성 | Postgres RLS(v0.3), cross-tenant 감사 로그, strict=false 경고 체계 | ⏳ |
| 4 | 개발자 경험 | 타입 추론 개선, NestJS 11.x 호환, 실행 가능한 예제, 에러 메시지 한/영 | ⏳ |
| 5 | 배포/운영 | prepublishOnly lint, CHANGELOG, CI/CD, 첫 공식 릴리즈 | ⏳ |
| 6 | 문서/커뮤니티 | FAQ/트러블슈팅, GitHub 템플릿, CONTRIBUTING.md | ⏳ |

### 우선순위 재정렬 (직전 점검 반영)

원본 To-Do에는 없던 **"0단계"** 를 1번 앞에 끼움.

- **이유**: 점검에서 P1으로 짚은 "v0.1이 실제로 동작하기 위한 핵심 와이어링"이
  누락된 채 1번(문서화) → 2번(확장)으로 가면 README 약속이 안 지켜지는 상태에서
  Prisma/Bull을 쌓는 모양이 됨.
- **결정**: 0단계 = v0.1 약속 완성을 먼저 끝낸 뒤 1번 문서화로 진입.

---

## 2. ✅ 0단계 — v0.1 약속 완성

**커밋**: `599bde9` — `feat(v0.1): Subscriber 자동 등록 + @Cacheable DI fallback 완성`

### 변경 요약

- **P1-2**: `TenantShieldModule.onApplicationBootstrap`에서 `ModuleRef`로
  `DataSource` 동적 lookup → `subscribers` 배열 자동 push. 사용자가
  `TypeOrmModule.forRoot({ subscribers: [...] })`를 직접 적을 필요 없음.
  TypeORM 미사용자는 silently skip.
- **P2-3**: `src/cache/cache.registry.ts` 추가. 모듈 bootstrap 시
  `setGlobalCache(this.cache)` 호출 → `@Cacheable`이
  `this.cacheService ?? getGlobalCache()` 순서로 fallback. 둘 다 없으면
  dev 환경에서 1회 경고 로그.
- **P1-1**: 자동 WHERE 주입은 별도 작업에서 Repository/QueryBuilder
  prototype patching으로 이미 구현되어 있어, 중복으로 만들었던
  `where-injector.ts`를 제거.
- **부수 정리**: `forRoutes`를 wildcard 대신 `{ path, method }` 형태로,
  DynamicModule에 `global: true` 명시.

### 이 단계에서 학습한 함정 → [critical-notes.md](./critical-notes.md)
- forRoutes wildcard 함정
- Subscriber 자동 등록 시 ModuleRef 패턴
- @Cacheable DI fallback 패턴

---

## 3. ✅ To-Do 1번 — 안정화 및 문서화

### 커밋 (2개)

| 커밋 | 내용 |
|---|---|
| `06f3e73` | `docs: v0.1 자동 보호 정밀 범위/우회 가이드 추가` |
| `7567670` | `test(e2e): TypeORM 통합 시나리오 확장 + 시스템 작업 머지 버그 수정` |

### 변경 요약

- **README**: "v0.1 자동 보호 정밀 범위" 섹션 신설. Repository / QueryBuilder /
  Subscriber hook 별 동작 표 + 보호 안 되는 API 대응법 + 의도적 우회 경로
  (`@SystemAction`, `runWithoutTenant`, `runWithTenant`) 정리.
- **`runWithoutTenant` JSDoc**: 정당한/금지된 사용 케이스 명시, 대안으로
  `runWithTenant` 루프 패턴 제시.
- **examples/academy-saas**: 다른 `tenantSource`(JWT/subdomain/custom)로
  바꿔보는 안내 주석을 `app.module.ts`와 `README`에 추가. 시스템 작업
  정석 패턴(`@SystemAction` + `runWithTenant` 루프) 강조.
- **e2e 시나리오 4 → 8개**: `findBy` 자동 WHERE, QueryBuilder.getMany 자동
  andWhere, cross-tenant PK 격리, strict throw 검증.

### 작업 중 발견·수정한 버그 (모두 [critical-notes.md](./critical-notes.md) 등재)

- **isSystemAction 머지 버그**: `applyTenantToFindOptions`가
  `runWithoutTenant` 안에서도 머지를 진행해 `WHERE tenantId=null`이 박힘.
  tenant 없는 모든 케이스를 한 분기로 묶고 시스템 작업/strict-off에서는
  원본 옵션 그대로 통과하도록 수정.
- **sync throw → expect.rejects 불일치**: Repository.prototype.find 등
  patch 함수의 sync throw를 `Promise.reject(err)`로 통일.

---

## 4. 🔄 To-Do 2번 — 기능 확장 (진행 중)

### 2-a ✅ 캐시 어댑터 DI/확장성 개선

**커밋**: `ab180ae` — `feat(cache): forRoot의 cache 슬롯으로 외부 어댑터 주입 지원`

- `TenantShieldOptions`에 `cache` 필드 추가. `useFactory` / `useValue` /
  `useClass` 세 형태 모두 지원.
- `forRoot` / `forRootAsync`가 옵션을 보고 적절한 Provider 또는 인스턴스
  생성. 미지정 시 `InMemoryTenantAwareCacheService` 유지(기존 사용자 무영향).
- `examples/redis-cache/`: ioredis 같은 외부 SDK 위에 어댑터를 얇게
  작성하는 레퍼런스 + README에 세 가지 등록 패턴.

### 2-b ◀ **다음 진입점** — `@SystemAction` 세분화 + 테스트 강화

#### 진입 전 체크리스트
- [ ] [critical-notes.md](./critical-notes.md) §시스템 작업 패턴 재독
- [ ] `src/decorators/require-tenant.decorator.ts` 클래스/메서드 레벨 wrap 로직 파악
- [ ] `src/decorators/system-action.decorator.ts` 메타데이터 키 확인
- [ ] `test/unit/` 기존 데코레이터 spec 패턴 파악

#### 해야 할 일
1. `forRoot.allowSystemActions`가 `tenant-context.middleware.ts:52`에서는 이미
   사용되지만 `@RequireTenant`의 `wrapMethod`에서는 안 읽히는 비대칭 해소.
   채택 방안: **글로벌 옵션 레지스트리 패턴** (cache.registry와 동일 패턴).
   `src/options/options.registry.ts` 신설 → `setGlobalOptions` / `getGlobalOptions`,
   `TenantShieldModule` bootstrap 시 `setGlobalOptions(this.options)` 호출,
   `wrapMethod`가 `getGlobalOptions()?.allowSystemActions`를 fallback으로 읽음.
2. `@RequireTenant` **메서드 레벨** + `@SystemAction` 조합 동작 명세화.
   현재 클래스 레벨 wrapping(`require-tenant.decorator.ts:78-79`)에서만
   `SYSTEM_ACTION_METADATA`를 검사 → 메서드 레벨(`:57-60`) 분기에도 동일 검사 추가.
   데코레이터 적용 순서 의존성을 피하려면 wrap 내부 런타임 검사가 더 안전한지
   테스트로 검증.
3. `test/unit/system-action.decorator.spec.ts` 신설:
   - `allowSystemActions: false` (기본) → `@SystemAction`이 박혀 있어도 throw
   - `allowSystemActions: true` → `@SystemAction` 메서드는 통과
   - 시스템 작업 내부에서 `runWithTenant`로 재진입하는 패턴

#### 완료 정의 (DoD)
- [ ] 위 3가지 모두 구현
- [ ] `npx tsc -p tsconfig.build.json --noEmit` 통과
- [ ] `npx jest` 통과 (신규 테스트 포함)
- [ ] 커밋 + push 후 사용자에게 보고
- [ ] `/eval` 호출하여 평가 기록

### 2-c ⏳ Bull/BullMQ `@TenantContext` 실제 구현 + 예시

- 데코레이터 스켈레톤은 있으나 큐 통합 테스트와 예시 부재.
- `examples/queue-bullmq/` 신설 검토.

### 2-d ⏳ Prisma 어댑터 스켈레톤

- `src/prisma/` 폴더 신설.
- Prisma의 `$extends` 또는 미들웨어 기반 자동 `WHERE tenantId` 주입.
- TypeORM 어댑터처럼 별도 ORM에 의존하지 않는 깔끔한 분리.

---

## 5. ⏳ To-Do 3 ~ 6번 — 예정

- **3 보안/안정성**: Postgres RLS PoC(v0.3), cross-tenant 감사 로그, strict=false 경고 체계
- **4 개발자 경험**: 타입 추론 개선, NestJS 11.x 호환성 검증, 예제 실행 가능화, 에러 메시지 한/영
- **5 배포/운영**: prepublishOnly lint, CHANGELOG, GitHub Actions CI/CD, 첫 공식 릴리즈 태깅
- **6 문서/커뮤니티**: FAQ/트러블슈팅, GitHub Discussions/Issues 템플릿, CONTRIBUTING.md

---

## 6. 검증 현황 스냅샷

| 항목 | 상태 | 마지막 확인 |
|---|---|---|
| 타입체크 (`tsc --noEmit`) | ✅ 깨끗 | 2026-05-20 |
| Jest | ✅ 10 suites / 40 tests pass | 2026-05-20 |
| origin/main 동기화 | ✅ 모든 커밋 푸시 완료 | 2026-05-20 |
| 최신 커밋 | `1df8a7c` | 2026-05-20 |

> 단계 마무리마다 이 표를 새 날짜로 갱신한다. "마지막 확인"이 7일 이상 지나면 신규 작업 진입 전 재검증.

---

## 7. 작업 운영 컨벤션

상세는 [claude.md](./claude.md) §3.

- **마일스톤 단위 커밋**: 각 단계 끝에서 빌드+테스트 통과 확인 후 1 커밋.
- **커밋 메시지**: conventional prefix(`feat`/`docs`/`test`/`fix`) + scope +
  한국어 본문. 본문에 변경 이유와 영향 범위 명시.
- **푸시**: 사용자 confirm 후. 한 번 동의가 다음번 자동 동의를 의미하지 않음.
- **검증 사이클**: `npx tsc -p tsconfig.build.json --noEmit && npx jest`.
- **단계 마무리 시 사용자에게 보고**: 무엇을 끝냈고, 다음 진입점은 무엇이고,
  몇 가지 선택지가 있는지.
- **단계 마무리 시 `/eval` 호출**: 평가 누적이 회고의 원료. 빼먹지 않는다.

---

## 8. 회고 누적 (Retrospective Log)

`/eval-review` (Opus 회고) 결과를 여기에 1~2주마다 요약한다. 상세는
`~/.claude/evaluations.md`.

| 회고 일자 | 누적 평가 건수 | 채택된 패턴 (4건+) | claude.md 반영 |
|---|---|---|---|
| (예정) | — | — | — |

> 다음 회고: 평가 20건 누적 시점에 `/eval-review` 실행.

---

## 9. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-13 | 초안 작성 — 0단계 / 1번 / 2-a 완료 시점에서 진행 상황 정리 |
| 2026-05-17 | 하네스 엔지니어링 셋업 반영: 자가 점검 체크리스트, 진입 체크리스트, 회고 누적 슬롯, claude.md/critical-notes.md/workflow.md 링크 |
| 2026-05-20 | §6 검증 스냅샷 재확인 (1df8a7c, TSC clean, 40/40 pass). §4 2-b 1번 설명을 코드 grep 결과에 맞춰 수정 (middleware는 이미 연결, wrapMethod 미연결) — 글로벌 옵션 레지스트리 채택 결정. |
