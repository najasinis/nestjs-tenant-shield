# 개발 프로세스 & 진행 현황

> 이 문서는 "지금 어디까지 왔고, 다음에 무엇을 할지"를 한눈에 보기 위한 작업 일지다.
> 마일스톤 단위로 갱신한다. 운영 규칙은 [claude.md](./claude.md), 함정 목록은
> [critical-notes.md](./critical-notes.md), 회고 워크플로는 [workflow.md](./workflow.md).
> 상세 사양은 [tenant-shield-PRD.md](./tenant-shield-PRD.md) /
> [tenant-shield-api-spec.md](./tenant-shield-api-spec.md) 참고.

---

## 📌 지금 여기 (Live Dashboard)

```
0단계 ✅ → 1번 ✅ → 2번 🔄 (2-a ✅ / 2-b ✅ / 2-c ⏳ / 2-d ✅) → 5번 ✅ → 3~4·6번 ⏳
```

| 항목 | 값 |
|---|---|
| **현재 진입점** | 2-c BullMQ @TenantContext 실제 구현 |
| **최신 릴리즈** | v0.1.1 (npm publish ✅) |
| **다음 체크포인트** | 2-d 커밋 후 2-c(BullMQ) 또는 6(커뮤니티) 선택 |
| **다음 회고 시점** | 평가 20건 누적 시 `/eval-review` (Opus) |
| **블로커** | 없음 |
| **마지막 갱신** | 2026-05-24 |

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

**커밋**: (다음 커밋) — `feat(prisma): createTenantAwarePrisma $extends 어댑터 구현 (#2-d)`

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

## 5. ⏳ To-Do 3 ~ 6번 — 예정

- **3 보안/안정성**: Postgres RLS PoC(v0.3), cross-tenant 감사 로그, strict=false 경고 체계
- **4 개발자 경험**: 타입 추론 개선, NestJS 11.x 호환성 검증, 예제 실행 가능화, 에러 메시지 한/영
- **5 배포/운영**: prepublishOnly lint, CHANGELOG, GitHub Actions CI/CD, 첫 공식 릴리즈 태깅
- **6 문서/커뮤니티**: FAQ/트러블슈팅, GitHub Discussions/Issues 템플릿, CONTRIBUTING.md

---

## 6. 검증 현황 스냅샷

| 항목 | 상태 | 마지막 확인 |
|---|---|---|
| 타입체크 (`tsc --noEmit`) | ✅ 깨끗 | 2026-05-24 |
| Jest | ✅ 12 suites / 66 tests pass (PG suite: Docker 없으면 skip) | 2026-05-24 |
| origin/main 동기화 | ⏳ 2-d 커밋 대기 중 | 2026-05-24 |
| 최신 커밋 | `d185be3` (미커밋 변경 있음) | 2026-05-24 |

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
| 2026-05-23 | 2-b 완료 (82422e8). Live Dashboard 진입점→publish scope 결정으로 갱신. §6 스냅샷 47 tests로 업데이트. |
| 2026-05-23 | 2-c/2-d → v0.2 확정(PRD §7). PostgreSQL e2e(2-e) 추가. Live Dashboard: To-Do 4→5 직행으로 갱신. |
| 2026-05-24 | 2-d Prisma 어댑터 완료. createTenantAwarePrisma + 19 tests. 진입점 → 2-c(BullMQ). |
