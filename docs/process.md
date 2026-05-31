# 개발 프로세스 & 진행 현황

> 이 문서는 "지금 어디까지 왔고, 다음에 무엇을 할지"를 한눈에 보기 위한 작업 일지다.
> 마일스톤 단위로 갱신한다. 운영 규칙은 [claude.md](./claude.md), 함정 목록은
> [critical-notes.md](./critical-notes.md), 회고 워크플로는 [workflow.md](./workflow.md).
> 상세 사양은 [tenant-shield-PRD.md](./tenant-shield-PRD.md) /
> [tenant-shield-api-spec.md](./tenant-shield-api-spec.md) 참고.

---

## 📌 지금 여기 (Live Dashboard)

```
0단계 ✅ → 1번 ✅ → 2번 ✅ → 3번 ✅ → 4번 ✅ → 5번 ✅ → 6번 ✅ → 7번 ✅ → 8번 ✅ → 9번 ⏳ → 10번 🔒
```

| 항목 | 값 |
|---|---|
| **현재 진입점** | 9번 — 커뮤니티 발표 + Gate B |
| **최신 릴리즈** | v0.2.1 (npm publish ✅) |
| **다음 체크포인트** | 9번 — 커뮤니티 발표 후 외부 피드백 3건 수집 |
| **Gate B 상태** | ❌ 미달성 — 외부 피드백 0건 / 파일럿 0건 |
| **다음 회고 시점** | 평가 20건 누적 시 `/eval-review` (Opus) |
| **블로커** | 없음 |
| **마지막 갱신** | 2026-05-31 |
| **테스트 현황** | 13 suites / 81 passed / 5 skipped (TSC clean) |

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
| 2 | 기능 확장 | 캐시 어댑터 DI, @SystemAction 세분화, Bull/BullMQ, Prisma | ✅ |
| 3 | 보안/안정성 | cross-tenant 감사 콜백, strict=false 경고 체계 (RLS → v0.3) | ✅ |
| 4 | 개발자 경험 | 에러 메시지 한/영, SecurityViolationEvent 타입, 코드 간소화 | ✅ |
| 5 | 배포/운영 | prepublishOnly lint, CHANGELOG, CI/CD, 첫 공식 릴리즈 | ✅ |
| 6 | 문서/커뮤니티 | FAQ/트러블슈팅, GitHub 템플릿, CONTRIBUTING.md | ✅ |
| **7** | **신뢰도 최소 기준** | **벤치마크 실측, npm fresh install 검증** | ⏳ |
| **8** | **글로벌 접근성** | **영문 README, 예제 실코드(prisma/bullmq/redis)** | ⏳ |
| **9** | **커뮤니티 + Gate B** | **공개 발표, 외부 피드백 3건 / 파일럿 1건 수집** | ⏳ |
| **10** | **v0.3 (Gate B 통과 후)** | **Postgres RLS 자동 주입** | 🔒 |

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

### 2-b ✅ `@SystemAction` 세분화 + 테스트 강화

**커밋**: `82422e8` — `feat(decorator): @SystemAction + allowSystemActions wrapMethod 연결 (#2-b)`

- `src/options/options.registry.ts` 신설: `setGlobalOptions` / `getGlobalOptions` /
  `resetGlobalOptions`. cache.registry.ts와 동일 패턴.
- `TenantShieldModule.onApplicationBootstrap`에서 `setGlobalOptions(this.options)` 호출.
- `wrapMethod` 수정: `isSystemActionDecorated`(originalMethod 메타데이터) +
  `globalAllowSystemActions`(registry)로 `shouldBypass` 산출.
  데코레이터 올바른 순서 → `@RequireTenant` 위, `@SystemAction` 아래.
- `test/unit/system-action.decorator.spec.ts` 신설 — 4 케이스 × 7 tests.

**데코레이터 순서 발견**: 역순(`@SystemAction` 위)이면 `originalMethod`에 메타데이터가
없어 `allowSystemActions: true`여도 우회 불가. 테스트로 명세화 완료. → [critical-notes.md §1.3](./critical-notes.md) 업데이트 완료.

### 2-c → v0.2 Bull/BullMQ `@TenantContext` 실제 구현 + 예시

PRD §7에 의해 v0.2로 이관. v0.1 scope 밖.

- 데코레이터 스켈레톤은 있으나 큐 통합 테스트와 예시 부재.
- `examples/queue-bullmq/` 신설은 v0.2에서 진행.

### 2-d ✅ Prisma 어댑터

**커밋**: `8bfb015` — `feat(prisma): Prisma 어댑터 추가 — createTenantAwarePrisma()`

- `src/prisma/prisma-tenant.extension.ts` 신설: `createTenantAwarePrisma(client, options)`.
  Prisma `$extends` duck-type 패턴으로 `@prisma/client` 직접 import 없이 동작.
- 보호 범위: findMany/findFirst/findFirstOrThrow/count/aggregate/groupBy → WHERE 자동 주입.
  create/createMany → data tenantId 주입. update/updateMany/delete/deleteMany/upsert → WHERE 주입.
  findUnique/findUniqueOrThrow → 결과 사후 검증 (unique 제약으로 WHERE 직접 주입 불가).
- afterLoad 상당: 결과 row tenantId 불일치 시 CrossTenantAccessError (최후 안전망).
- `package.json` peerDependencies에 `@prisma/client ^5.0.0` optional 추가.
- `test/unit/prisma-tenant.extension.spec.ts` 신설 — 8 케이스 / 19 tests pass.
- `examples/prisma-saas/README.md` 신설.

### 2-e ✅ PostgreSQL e2e (Docker testcontainers)

**커밋**: `b01f4b6` — `test(e2e): PostgreSQL Docker testcontainers e2e 추가 + v0.1 scope 확정`

- `test/e2e/postgres-integration.spec.ts` 신설.
- Docker 미실행 환경에서 자동 skip (`isDockerAvailable()` 가드).
- 검증 시나리오: 자동 WHERE 격리 / cross-tenant INSERT 차단 / PK 접근 격리 / strict MissingTenantContextError / runWithoutTenant 전체 조회.

---

## 5. ✅ To-Do 3 ~ 6번 — 완료 (v0.2.1)

**커밋**: `3dab27f`, `28b66f2`, `056c13a` — v0.2.0 / v0.2.1 릴리즈

- **3 보안/안정성**: `SecurityViolationEvent` + `onSecurityViolation` 콜백, `strictMode=false` 부팅 경고
- **4 개발자 경험**: 에러 메시지 한/영 기본값, `SecurityViolationEvent` 타입 공개, 코드 간소화
- **5 배포/운영**: `prepublishOnly` 가드, CHANGELOG, GitHub Actions(Node 18/20/22 매트릭스), v0.2.1 npm publish
- **6 문서/커뮤니티**: `docs/FAQ.md`, `docs/troubleshooting.md`, `.github/ISSUE_TEMPLATE/` 한/영 이중 언어, `CONTRIBUTING.md`

---

## 6. ✅ To-Do 7번 — 신뢰도 최소 기준 (Gate C 완성)

> **왜 먼저 해야 하나**: PRD §10.1이 "미측정값을 추측으로 채우지 말 것"이라고 명시했다.
> README Performance 섹션이 현재 비어 있으면 Gate C("README 예시와 실제 구현 불일치 0건") 위반이다.
> npm 배포 후 실제 설치 경로 검증도 빠져 있어 사용자가 첫 install에서 막힐 수 있다.

### 7-a 벤치마크 실측 후 README 채우기

**목표**: `benchmark/simple-bench.ts` 실행 결과를 README "Performance" 섹션 실수치로 채운다.

체크리스트:
- [x] `npm run benchmark` 실행 — 측정 항목: `@RequireTenant` 오버헤드(메서드당), Subscriber `beforeQuery`(쿼리당), `afterLoad`(row당), ALS 접근(요청당)
- [x] 결과를 README의 다음 형식에 실측값으로 채운다 (v0.2.1, Node.js v24.13.1, ~0.00069 ms/call)
- [x] "추정값이 아닌 실측값" 문구를 README에 명시

### 7-b npm fresh install → 실제 설치 경로 검증

**목표**: npm 패키지 기준으로 설치했을 때 `examples/academy-saas/` 흐름이 동작하는지 확인한다.

체크리스트:
- [x] 임시 빈 디렉토리에서 `npm install nestjs-tenant-shield @nestjs/common @nestjs/core typeorm reflect-metadata rxjs`
- [x] npm 패키지 정상 설치 + 주요 exports (TenantShieldModule, RequireTenant, etc.) 확인
- [x] 타입 오류 없음 — dist/index.d.ts 정상 포함
- [x] 발견된 문제 없음 — v0.2.2 패치 불필요

---

## 7. ✅ To-Do 8번 — 글로벌 접근성

> **왜 필요한가**: npm 검색으로 유입되는 글로벌 사용자는 Quick Start 코드를 보기 전에 이탈한다.
> 영문 섹션이 없으면 GitHub Star, 이슈, PR 기여 모두 한국 사용자로만 제한된다.
> 예제 실코드 없는 README-only 예제는 "직접 써봤더니 안 됩니다"의 원인이 된다.

### 8-a 영문 README 보강

**목표**: 영어권 사용자가 README만 읽고 30분 내 기동 가능한 수준.

체크리스트:
- [x] `README.md` 상단에 영문 Quick Start 섹션 추가 — 한국어 섹션 위에 배치 (TypeORM + Prisma + curl)
- [x] "Honest Limits (90% rule)" 섹션 영문 병기 (table 형식)
- [x] API Reference 핵심 4개 항목 영문 추가 (forRoot options, @RequireTenant, @SystemAction, @Cacheable, helpers, errors)
- [x] npm version badge 추가
- [x] CI status badge 추가

### 8-b 예제 실코드 완성

**목표**: `examples/` 세 곳 모두 `git clone → pnpm install → pnpm start` 한 번에 동작.

#### `examples/prisma-saas/`
- [x] `src/app.module.ts` — `TenantShieldModule.forRoot` + Prisma provider 설정
- [x] `src/main.ts`
- [x] `src/students/students.service.ts` — `createTenantAwarePrisma` + `findMany` / `create`
- [x] `src/students/students.controller.ts` — `GET /students`, `POST /students`
- [x] `prisma/schema.prisma` — `Student` 모델 (`tenantId` 포함)
- [x] `package.json` — npm 패키지 참조 (workspace 아님)
- [x] README에 `prisma migrate dev` + `pnpm start` + curl 명령 추가

#### `examples/queue-bullmq/`
- [x] `src/app.module.ts` — `BullModule` + `TenantShieldModule` 통합
- [x] `src/main.ts`
- [x] `src/reports/reports.service.ts` — `withTenantPayload` enqueue
- [x] `src/reports/report.processor.ts` — `@TenantContext()` + `WorkerHost`
- [x] `src/reports/reports.controller.ts` — `POST /reports/schedule`
- [x] `package.json` — npm 패키지 참조, Redis 연결 환경변수 가이드
- [x] README에 `docker run -p 6379:6379 redis:7-alpine` + `pnpm start` + curl 명령 추가

#### `examples/redis-cache/`
- [x] `src/app.module.ts` — `TenantShieldModule.forRoot({ cache: { useFactory: ... } })` redis 어댑터 주입
- [x] `src/main.ts`
- [x] `src/students/students.service.ts` — `@Cacheable({ tenantScoped: true })` 적용
- [x] `package.json` — `ioredis` 포함, npm 패키지 참조
- [x] README에 Redis 기동 방법 + `pnpm start` + 캐시 hit/miss 확인 방법 추가

---

## 8. ⏳ To-Do 9번 — 커뮤니티 발표 + Gate B

> **왜 이 순서인가**: 7번(신뢰도) + 8번(접근성)이 완료되기 전에 발표하면
> "설치했더니 안 돼요"나 "영어 문서 없어요" 이슈가 첫 인상으로 박힌다.
> 발표는 제품이 준비된 뒤에 한다.

### 9-a 커뮤니티 발표

체크리스트:
- [ ] **dev.to (영문 포스트)**
  - 제목 예: "Automatic multi-tenant data isolation in NestJS with one decorator"
  - 포함: 문제 정의 → 코드 before/after → install + 30초 Quick Start → honest limits 섹션
- [ ] **긱뉴스 (한국)**
  - 제목 예: "NestJS B2B SaaS 멀티테넌시 데이터 격리를 데코레이터 한 줄로 — nestjs-tenant-shield"
- [ ] **NestJS Discord** (`#libraries` 채널)
- [ ] **r/node** (dev.to 포스트 링크)
- [ ] **GitHub Discussions** 오픈 (첫 포스트: "Roadmap & Feedback" 핀 고정)

### 9-b Gate B 달성 트래킹

**Gate B 기준**: 외부 피드백 3건 이상 OR 파일럿 채택 1건.
여기서 "피드백"은 GitHub Issue / Discussion / DM / 이메일 모두 포함. 단, 내가 스스로 남긴 이슈는 카운트하지 않는다.

| # | 채널 | 내용 | 날짜 |
|---|---|---|---|
| 1 | — | — | — |
| 2 | — | — | — |
| 3 | — | — | — |

> 3건 채워지면 §9 변경 이력에 기록하고 Gate B ✅로 갱신.

### 9-c Gate B 결과 → v0.3 여부 결정

- Gate B 통과: 10번(v0.3 RLS) 진입
- Gate B 미통과 (피드백 0건, 6~8주 경과): 장기 투자 중단 검토 → 라이브러리 유지보수 모드 전환

---

## 9. 🔒 To-Do 10번 — v0.3 Postgres RLS (Gate B 통과 후)

> **Gate B 통과 전에는 진입하지 않는다.** 사용자가 없는 기능을 만드는 것은 낭비다.

### 배경

현재 라이브러리는 "흔한 사고의 90% 차단"을 표방한다. 나머지 10%는 raw SQL / JOIN / 서브쿼리처럼 QueryBuilder를 우회하는 경우다.
Postgres RLS(Row-Level Security)를 활성화하면 DB 레벨에서 두 번째 방어선이 생긴다:
- 애플리케이션 레이어 격리(라이브러리)가 우회돼도 DB가 재차 차단
- raw SQL / JOIN 내부 등 라이브러리가 잡지 못하는 경로 커버

### 구현 스코프 (v0.3)

- [ ] `TenantShieldModule.forRoot({ rls: true })` 옵션 추가
- [ ] `onApplicationBootstrap`에서 `SET app.tenant_id = ?` 트리거 SQL 자동 생성 헬퍼
- [ ] 쿼리 실행 전 `SET LOCAL app.tenant_id = '<tenantId>'` 자동 주입 (TypeORM DataSource 이벤트 훅)
- [ ] `ENABLE ROW LEVEL SECURITY` + `POLICY` DDL 예시 문서화 (자동 실행 아님 — 사용자가 직접 적용)
- [ ] e2e 테스트: RLS 활성화된 PG 컨테이너에서 raw SQL이 RLS로 차단되는지 검증

---

## 10. 검증 현황 스냅샷

| 항목 | 상태 | 마지막 확인 |
|---|---|---|
| 타입체크 (`tsc --noEmit`) | ✅ 깨끗 | 2026-05-31 |
| Jest | ✅ 13 suites / 81 passed / 5 skipped (PG suite: Docker 없으면 skip) | 2026-05-31 |
| origin/main 동기화 | ⏳ 미push — 로컬 커밋 대기 | 2026-05-31 |
| npm publish | ✅ v0.2.1 | 2026-05-24 |
| 벤치마크 실측 | ✅ ~0.00069 ms/call (Node.js v24.13.1, 100,000 iter) — README 반영 완료 | 2026-05-31 |
| npm fresh install 검증 | ✅ 패키지 설치 + exports 확인 완료 | 2026-05-31 |
| 영문 README | ✅ Quick Start + Honest Limits + API Reference + badges 추가 | 2026-05-31 |
| 예제 실코드 (prisma/bullmq/redis) | ✅ 3개 예제 모두 src + package.json + README 완성 | 2026-05-31 |
| Gate B (외부 피드백) | ❌ 0 / 3건 | — |

> 단계 마무리마다 이 표를 새 날짜로 갱신한다. "마지막 확인"이 7일 이상 지나면 신규 작업 진입 전 재검증.

---

## 11. 작업 운영 컨벤션

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

## 12. 회고 누적 (Retrospective Log)

`/eval-review` (Opus 회고) 결과를 여기에 1~2주마다 요약한다. 상세는
`~/.claude/evaluations.md`.

| 회고 일자 | 누적 평가 건수 | 채택된 패턴 (4건+) | claude.md 반영 |
|---|---|---|---|
| (예정) | — | — | — |

> 다음 회고: 평가 20건 누적 시점에 `/eval-review` 실행.

---

## 13. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-13 | 초안 작성 — 0단계 / 1번 / 2-a 완료 시점에서 진행 상황 정리 |
| 2026-05-17 | 하네스 엔지니어링 셋업 반영: 자가 점검 체크리스트, 진입 체크리스트, 회고 누적 슬롯, claude.md/critical-notes.md/workflow.md 링크 |
| 2026-05-20 | §6 검증 스냅샷 재확인 (1df8a7c, TSC clean, 40/40 pass). §4 2-b 1번 설명을 코드 grep 결과에 맞춰 수정 (middleware는 이미 연결, wrapMethod 미연결) — 글로벌 옵션 레지스트리 채택 결정. |
| 2026-05-23 | 2-b 완료 (82422e8). Live Dashboard 진입점→publish scope 결정으로 갱신. §6 스냅샷 47 tests로 업데이트. |
| 2026-05-23 | 2-c/2-d → v0.2 확정(PRD §7). PostgreSQL e2e(2-e) 추가. Live Dashboard: To-Do 4→5 직행으로 갱신. |
| 2026-05-24 | 2-d Prisma 어댑터 완료. createTenantAwarePrisma + 19 tests. 진입점 → 2-c(BullMQ). |
| 2026-05-24 | To-Do 3~6 완료. SecurityViolationEvent + onSecurityViolation 콜백, strictMode=false 경고, 에러 메시지 한영, CI/CD, CHANGELOG, CONTRIBUTING, 이슈 템플릿, troubleshooting 추가. v0.2.0 준비. TSC clean / 81 passed. |
| 2026-05-28 | 전체 로드맵 재점검. 남은 단계(7~10번) 추가: 벤치마크 실측, npm fresh install 검증, 영문 README, 예제 실코드 완성, 커뮤니티 발표 + Gate B 트래킹, v0.3 RLS(Gate B 잠금). 검증 스냅샷 갱신. |
| 2026-05-31 | 7번 + 8번 완료. 벤치마크 실측(~0.00069 ms, Node v24), npm fresh install 검증, README 영문 Quick Start + badges + Honest Limits + API Reference, examples/prisma-saas·queue-bullmq·redis-cache 실코드 완성. 진입점 → 9번. |
