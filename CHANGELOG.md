# Changelog

All notable changes to nestjs-tenant-shield are documented here.
[keepachangelog.com](https://keepachangelog.com) 형식 준수.

## [Unreleased]

## [0.2.0] - 2026-05-24

### Added
- `SecurityViolationEvent` interface — structured audit event for security violations / 보안 위반 구조화 이벤트 인터페이스
- `onSecurityViolation` callback in `TenantShieldOptions` — fires just before throwing `CrossTenantAccessError` or `MissingTenantContextError`; errors in the callback are silently swallowed so the security error always propagates / throw 직전 호출, 콜백 에러는 삼킴
- `onSecurityViolation` wired to all throw sites: TypeORM Subscriber (`beforeInsert`, `afterLoad`, QueryBuilder & Repository patches), Prisma extension, `@RequireTenant` decorator / 모든 throw 지점 연결
- `strictMode: false` startup warning via `logger.warn()` in `onApplicationBootstrap` / strictMode 비활성화 시 부팅 경고 로그
- `CHANGELOG.md` (this file), `CONTRIBUTING.md`, `docs/troubleshooting.md` — project documentation / 프로젝트 문서
- `.github/workflows/ci.yml` — Node 18/20/22 matrix CI (lint + type-check + test + build) / GitHub Actions CI
- `.github/ISSUE_TEMPLATE/` — bilingual bug report, feature request, and config / 한영 이슈 템플릿

### Changed
- Error classes (`MissingTenantContextError`, `CrossTenantAccessError`, `InvalidTenantSourceError`): constructor parameters now optional with bilingual `DEFAULT_MESSAGE` static fields / 생성자 파라미터 선택적으로 변경 + 한영 기본 메시지
- Code simplification: removed step-numbered restatement comments, collapsed single-use variables, flattened nested-if guards / 불필요한 주석 제거 및 코드 간소화

## [0.1.1] - 2026-05-24

### Fixed
- Remove merge conflict markers from README / README 머지 마커 제거

### Added
- `unpatch()` helper to restore all TypeORM prototype patches (useful in e2e test `afterAll`) / TypeORM prototype 패치 원복 헬퍼 추가
- Runnable `academy-saas` demo via `npm run demo` / `npm run demo`로 실행 가능한 데모 추가

## [0.1.0] - 2026-05-23

### Added
- Prisma adapter: `createTenantAwarePrisma()` — auto WHERE injection for all Prisma operations / Prisma 어댑터 추가
- PostgreSQL e2e tests with Testcontainers (Docker required) / Docker Testcontainers 기반 PostgreSQL e2e 테스트
- `@SystemAction` wired to `allowSystemActions` option via global options registry / `@SystemAction`이 `allowSystemActions`와 연결됨
- Cache adapter DI slot: `useFactory` / `useValue` / `useClass` patterns in `forRoot.cache` / 캐시 어댑터 DI 슬롯 (세 가지 패턴 지원)
- `forRootAsync()` for async option factories (e.g., ConfigService) / 비동기 옵션 팩토리 지원
- TypeORM `TenantSubscriber` auto-registration via `onApplicationBootstrap` / TypeORM Subscriber 자동 등록

### Fixed
- `applyTenantToFindOptions` merge bug: `runWithoutTenant` no longer injects `WHERE tenantId=null` / `runWithoutTenant` 블록에서 `null` 주입 버그 수정
- Sync `throw` in Repository patch functions unified to `Promise.reject()` / Repository 패치 함수의 sync throw를 `Promise.reject()`로 통일

## [0.0.5] - 2026-05-17

### Added
- `@Cacheable` decorator with DI fallback to global cache registry / `@Cacheable` 데코레이터 및 글로벌 캐시 레지스트리 fallback
- Test helpers: `runWithTenant`, `expectCurrentTenant`, `resetTenantContext` / 테스트 헬퍼 추가
- `examples/academy-saas`: TypeORM + SQLite runnable example / 실행 가능한 예제 추가

## [0.0.4] - 2026-05-14

### Added
- Cache key auto-isolation with `tenantScoped: true` default / 캐시 키 자동 격리
- `strict=false` mode for gradual migration / 점진적 마이그레이션을 위한 strict=false 모드

## [0.0.3] - 2026-05-13

### Added
- TypeORM `TenantSubscriber`: auto WHERE injection for `SelectQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder` / 자동 WHERE 주입
- Repository prototype patching: `find`, `findOne`, `findBy`, `findOneBy`, `count`, `save` / Repository 메서드 패치
- `afterLoad` cross-tenant validation — last safety net / afterLoad 크로스 테넌트 검증 (최후 안전망)
- `beforeInsert` tenant auto-fill / beforeInsert 자동 tenant 주입

## [0.0.2] - 2026-05-11

### Added
- `@RequireTenant()` decorator (class-level and method-level) / 클래스/메서드 레벨 데코레이터
- `@SystemAction()` decorator skeleton / 스켈레톤 추가
- Tenant resolvers: `header`, `jwt`, `subdomain`, `custom` / tenant 소스 리졸버 4종

## [0.0.1] - 2026-05-09

### Added
- Initial release: `AsyncLocalStorage`-based tenant context / AsyncLocalStorage 기반 tenant 컨텍스트
- `TenantContextMiddleware` — auto-extracts and stores tenant ID per request / 요청당 tenant ID 자동 추출
- `TenantShieldModule.forRoot()` — dynamic module setup / 동적 모듈 셋업
- `getCurrentTenantId()`, `runWithTenant()`, `runWithoutTenant()` context utilities
- `MissingTenantContextError`, `CrossTenantAccessError`, `InvalidTenantSourceError`

[Unreleased]: https://github.com/jinyeongjung/nestjs-tenant-shield/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/jinyeongjung/nestjs-tenant-shield/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jinyeongjung/nestjs-tenant-shield/compare/v0.0.5...v0.1.0
[0.0.5]: https://github.com/jinyeongjung/nestjs-tenant-shield/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/jinyeongjung/nestjs-tenant-shield/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/jinyeongjung/nestjs-tenant-shield/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/jinyeongjung/nestjs-tenant-shield/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/jinyeongjung/nestjs-tenant-shield/releases/tag/v0.0.1
