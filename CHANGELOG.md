# Changelog

모든 주목할 만한 변경 사항을 이 파일에 기록합니다.

형식: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
버전 정책: [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — v0.x 단계에서는 MINOR에서 API 변경 가능.

---

## [Unreleased]

---

## [0.2.0] - 2026-05-24

### Added

- **Prisma 어댑터** (`createTenantAwarePrisma`): `$extends` duck-type 패턴으로 `@prisma/client` 직접 import 없이 동작.
  - `findMany / findFirst / count / aggregate / groupBy` → WHERE tenantId 자동 주입
  - `create / createMany` → data.tenantId 자동 주입
  - `update / updateMany / delete / deleteMany / upsert` → WHERE tenantId 자동 주입
  - `findUnique / findUniqueOrThrow` → 결과 사후 검증 (`CrossTenantAccessError`)
  - `strictMode: false` 시 컨텍스트 없어도 통과
- **BullMQ 통합** (`withTenantPayload`, `@TenantContext`): 큐 작업에서 tenant 컨텍스트 자동 전파.
  - `withTenantPayload(data)` — enqueue 시 현재 컨텍스트의 tenantId를 payload에 자동 첨부
  - `@TenantContext()` — processor에서 `job.data.tenantId`로 ALS 컨텍스트 자동 복원
  - 커스텀 추출: `@TenantContext({ extractFrom: j => j.data.orgId })`
- **SECURITY.md** — 자동 보호 범위·한계 명시, 취약점 제보 방법
- **CHANGELOG.md** — 이 파일
- **CONTRIBUTING.md** — 기여 가이드
- **GitHub 이슈/PR 템플릿** — cross-tenant 우회 사유 명시란 포함
- **docs/FAQ.md** — 자주 묻는 질문
- **GitHub Actions CI** — push/PR마다 Node 18.x + 20.x에서 tsc + jest 자동 실행
- **GitHub Actions publish** — `v*` 태그 push 시 npm publish 자동화
- **benchmark/simple-bench.ts** — ALS 오버헤드, `@TenantContext` 오버헤드 측정 스크립트

### Changed

- `prepublishOnly`에 `npm run lint` 추가 (빌드 → lint → 테스트 순서)
- `@TenantContext` 데코레이터: `throw new Error(...)` → `throw new MissingTenantContextError(...)` 타입 일관성 개선

---

## [0.1.1] - 2026-05-24

### Fixed

- README에 git merge conflict 마커(`=======`)가 그대로 포함된 버그 수정

### Added

- `unpatch()` 테스트 헬퍼: e2e `afterAll`에서 TypeORM 프로토타입 패치 원복 (`nestjs-tenant-shield/testing`에서 import)

---

## [0.1.0] - 2026-05-24

### Added

첫 공개 릴리즈.

- **TypeORM 어댑터** — Repository/QueryBuilder/Subscriber 자동 WHERE 주입 (discriminator 패턴)
- **`@RequireTenant()`** — 클래스/메서드 레벨 tenant 컨텍스트 강제
- **`@SystemAction()`** — 시스템 작업(cron 등) tenant 우회 허용
- **`@Cacheable()`** — tenant 단위 캐시 키 자동 분리
- **`TenantShieldModule.forRoot() / forRootAsync()`** — DynamicModule, global: true
- **미들웨어 기반 컨텍스트** — header / JWT / subdomain / custom resolver
- **`runWithTenant()` / `runWithoutTenant()`** — 프로그래매틱 컨텍스트 제어
- **`MissingTenantContextError` / `CrossTenantAccessError`** — Fail-Loud 에러 타입
- **In-memory 캐시 어댑터** + 외부 캐시 어댑터 슬롯 (`useFactory / useValue / useClass`)
- **`examples/academy-saas/`** — SQLite 기반 학원 SaaS 데모 (`npm run demo`)
- **PostgreSQL Docker testcontainers e2e** — CI에서 실제 Postgres로 격리 검증
