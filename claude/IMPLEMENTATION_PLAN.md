# Implementation Plan — nestjs-tenant-shield

> Milestone breakdown with acceptance criteria.
> Milestone boundaries come from PRD §8. Out-of-scope items come from PRD §7.
> Always verify the current milestone before starting work — never implement ahead.

---

## How to Use This Document

1. Read the **current milestone** section fully before writing any code.
2. Check the **acceptance criteria** — every item must pass before the milestone is closed.
3. Mark items `[x]` as you complete them.
4. Do not touch items in future milestones.

Total target: **6 weeks**, ~1 hour/day × 42 days = ~42 hours.

## Reality Gates (Go / No-Go)

- **Gate A (Week 4)**: A working minimum path plus integration tests must exist.
- **Gate B (Week 6-8)**: At least 3 pieces of external user feedback OR 1 pilot adoption.
- **Gate C (Pre-publish)**: README samples and actual behavior mismatch count must be 0.

If a gate fails, reduce scope or stop long-term investment instead of extending indefinitely.

---

## Milestone v0.0.1 — Foundation

**Goal**: Project scaffolding, build pipeline, AsyncLocalStorage context primitive, and middleware skeleton. No decorators or Subscriber yet.
**Estimated effort**: ~7 hours (Week 1)

### Tasks

- [ ] Initialize `package.json` with `name: "nestjs-tenant-shield"`, `version: "0.0.1"`, `peerDependencies` (NestJS, rxjs, reflect-metadata, typeorm), empty `dependencies`
- [ ] Configure `tsconfig.json` — `emitDecoratorMetadata: true`, `experimentalDecorators: true`, strict mode, target ES2022
- [ ] Configure `tsup.config.ts` — output CJS + ESM + `.d.ts`, entry `src/index.ts`, externalize peer deps
- [ ] Configure `jest.config.ts` — ts-jest, coverage threshold 80%, separate unit + integration test paths
- [ ] Define all interfaces:
  - `TenantShieldOptions` (forRoot input — full surface from API spec §1)
  - `RequireTenantOptions` (decorator input)
  - `CacheableOptions` (decorator input)
  - `TenantContextOptions` (v0.2 stub, type-only)
  - `TenantStore` (AsyncLocalStorage payload)
  - `TenantResolver` (resolver interface)
- [ ] Define all error classes (`MissingTenantContextError`, `CrossTenantAccessError`, `InvalidTenantSourceError`)
- [ ] Implement `tenantContextStorage` (the `AsyncLocalStorage<TenantStore>` singleton)
- [ ] Implement `getCurrentTenantId`, `runWithTenant`, `runWithoutTenant` helpers
- [ ] `TenantContextMiddleware` skeleton — calls a stub resolver, runs `tenantContextStorage.run`
- [ ] `TenantShieldModule` skeleton — `forRoot()` returns a `DynamicModule`, validates options at boot (throws `InvalidTenantSourceError` for misconfigured cases)
- [ ] `src/index.ts` — re-export all public types, helpers, errors, and the module

### Acceptance Criteria

- [ ] `pnpm build` succeeds and produces `dist/index.cjs`, `dist/index.mjs`, `dist/index.d.ts`
- [ ] `forRoot({ strategy: 'schema', ... })` throws `InvalidTenantSourceError` (v0.1 only supports `'discriminator'`)
- [ ] `forRoot({ tenantSource: 'custom' })` without `customResolver` throws `InvalidTenantSourceError`
- [ ] `runWithTenant('A', async () => getCurrentTenantId())` resolves to `'A'`
- [ ] `runWithoutTenant(async () => getCurrentTenantId())` resolves to `null`
- [ ] Concurrent `runWithTenant` calls do not leak context across each other (test with `Promise.all` of two different tenants)
- [ ] All interfaces compile with zero TypeScript errors
- [ ] No external packages in `dependencies` (pnpm-lock confirms)

---

## Milestone v0.0.2 — Core Decorator + Resolvers

**Goal**: `@RequireTenant()` decorator and all four tenant resolvers wired through the middleware.
**Estimated effort**: ~7 hours (Week 2)

### Tasks

- [ ] `HeaderResolver` — reads `request.headers[headerName.toLowerCase()]`
- [ ] `JwtResolver` — reads `request.user?.[jwtClaim] ?? request.jwt?.[jwtClaim]`. Documented assumption: auth middleware populates `request.user`.
- [ ] `SubdomainResolver` — parses `request.hostname` against `subdomainPattern` (e.g., `*.example.com` → captures the `*` segment). Self-implemented regex builder.
- [ ] `CustomResolver` — wraps user's `customResolver` in try/catch (exceptions → null)
- [ ] `forRoot()` instantiates the right resolver based on `tenantSource` and provides it to the middleware
- [ ] `@RequireTenant()` decorator — metadata attachment for class + method targets
- [ ] `RequireTenantInterceptor` — global interceptor that:
  - Reads `REQUIRE_TENANT_METADATA` from handler (or class)
  - If absent: passthrough
  - If present: check `getCurrentTenantId()`. If null AND `strictMode` AND not `@SystemAction`: throw `MissingTenantContextError`
- [ ] `@SystemAction()` decorator — sets `isSystemAction: true` in the store for the method's scope
- [ ] Wire `RequireTenantInterceptor` as `APP_INTERCEPTOR` in `forRoot`

### Acceptance Criteria

- [ ] HTTP request with `x-tenant-id: academy-A` → `getCurrentTenantId()` inside controller returns `'academy-A'`
- [ ] HTTP request without `x-tenant-id` to a `@RequireTenant()` route → returns 500 with `MissingTenantContextError` in the chain (default strict)
- [ ] HTTP request to a route WITHOUT `@RequireTenant()` → no error even when context is null (public endpoints work)
- [ ] `@RequireTenant({ allowSystem: true })` + `@SystemAction()` method → no error when context is null
- [ ] Subdomain resolver: `academy-a.example.com` with pattern `*.example.com` → `'academy-a'`
- [ ] Subdomain resolver: bare `example.com` → `null`
- [ ] Custom resolver throwing → `null` (not propagated as error from middleware)
- [ ] Class-level `@RequireTenant()` applied to a service: all public methods are protected without per-method annotation

---

## Milestone v0.0.3 — TypeORM Subscriber (CORE)

**Goal**: The actual security boundary. Auto WHERE injection + cross-tenant detection.
**Estimated effort**: ~10 hours (Week 3) — most complex milestone

### Tasks

- [ ] `TenantSubscriber` implements `EntitySubscriberInterface`
- [ ] `beforeQuery` hook:
  - Read `getCurrentTenantId()` and `isSystemAction`
  - If `isSystemAction`: skip injection
  - If null AND strict: throw `MissingTenantContextError`
  - Otherwise: `event.queryBuilder.andWhere('${tenantIdField} = :__tid__', { __tid__: tenantId })`
  - Use `__tid__` as a namespaced parameter name to avoid collision
- [ ] `afterLoad` hook:
  - Per-entity check: `entity[tenantIdField] === currentTenantId`
  - On mismatch: throw `CrossTenantAccessError` with `currentTenant`, `attemptedTenant`, `entityName`
  - Skip if `isSystemAction`
- [ ] `beforeInsert` hook:
  - If `entity[tenantIdField]` is unset → assign current tenant
  - If set AND differs → throw `CrossTenantAccessError`
- [ ] Subscriber registration in `forRoot`:
  - Inject `DataSource`, call `dataSource.subscribers.push(subscriberInstance)`
  - Honor `forRoot.entities` filter if provided
- [ ] `withTenantWhere(sql: string, columnName: string): string` — raw SQL helper that appends `WHERE ${columnName} = '${escapedTenantId}'` (or `AND` if WHERE exists)

### Acceptance Criteria

- [ ] Integration test: `runWithTenant('A', () => repo.find())` produces a query with `WHERE tenantId = 'A'` (verified via query logging)
- [ ] Integration test: cross-tenant escape hatch (manual `repo.query`) returning a row with mismatched `tenantId` triggers `CrossTenantAccessError`
- [ ] Integration test: `repo.save({ name: 'foo' })` inside `runWithTenant('A')` persists with `tenantId: 'A'` automatically
- [ ] Integration test: `repo.save({ name: 'foo', tenantId: 'B' })` inside `runWithTenant('A')` throws `CrossTenantAccessError`
- [ ] Integration test: 100 concurrent requests with different tenant IDs — every query has the correct WHERE, zero cross-contamination
- [ ] `@SystemAction()` + `runWithoutTenant`: subscriber skips both WHERE injection AND afterLoad check, scans return all rows
- [ ] Entities without `tenantIdField` column are NOT affected (subscriber detects column presence)
- [ ] **Field name flexibility test (ADR-014)**: same test suite passes with `tenantIdField: 'tenantId'` AND `tenantIdField: 'spaceId'` — no hardcoded `'tenantId'` regression
- [ ] **Subscriber-bypass documentation**: README + SECURITY.md list raw SQL, JOIN inner tables, subqueries as KNOWN gaps with mitigations
- [ ] `withTenantWhere(sql, columnName)` raw SQL helper exists and produces correct WHERE/AND output for both empty-WHERE and existing-WHERE inputs

---

## Milestone v0.0.4 — Cache Isolation + Test Helpers

**Goal**: Per-tenant cache key separation and test ergonomics.
**Estimated effort**: ~7 hours (Week 4)

### Tasks

- [ ] `@Cacheable({ ttl, tenantScoped, keyGenerator })` decorator
- [ ] `CacheableInterceptor` — global interceptor that:
  - Reads `CACHEABLE_METADATA`
  - Builds key: `${tenantId}:${className}.${methodName}:${stableHashOfArgs}` when `tenantScoped: true`
  - Otherwise: `${className}.${methodName}:${stableHashOfArgs}`
  - Delegates to NestJS `CacheManager` (host app provides `CacheModule`)
- [ ] `stableHashOfArgs(args: unknown[]): string` — deterministic, sorted-keys JSON; truncate at N chars
- [ ] `runWithTenant` and `runWithoutTenant` already exist (v0.0.1) — write integration tests for test usage patterns
- [ ] Document the test pattern: `await runWithTenant('A', async () => { ... })`

### Acceptance Criteria

- [ ] Two consecutive calls within `runWithTenant('A', ...)` to the same method with same args → second call hits cache
- [ ] `runWithTenant('A', () => svc.method())` then `runWithTenant('B', () => svc.method())` → different cache entries (no cross-tenant cache hit)
- [ ] `@Cacheable({ ttl: 300, tenantScoped: false })` → both tenants share the same cache entry (and a warning is documented but NOT logged at runtime — would be too noisy)
- [ ] TTL expiry causes recomputation
- [ ] Custom `keyGenerator` is used when provided
- [ ] Test using `runWithTenant` is ergonomic enough that an integration test can be written in 5 lines

---

## Milestone v0.0.5 — Strict Mode Polish + Examples

**Goal**: Final polish on edge cases and three working example apps.
**Estimated effort**: ~7 hours (Week 5)

### Tasks

- [ ] Wire `strictMode: false` path: log warning instead of throwing on missing context. Default stays `true`.
- [ ] Method-level `@RequireTenant({ strictMode })` overrides module-level setting
- [ ] `examples/basic-typeorm/` — minimal NestJS + TypeORM app:
  - `Student` entity with `tenantId` column
  - Header-based resolver
  - `@RequireTenant()` on `StudentsService`
  - One controller route: `GET /students`
  - README showing curl with/without `x-tenant-id`
- [ ] `examples/jwt-multitenancy/` — JWT-based extraction:
  - Mock auth middleware that populates `request.user.tenant_id`
  - `tenantSource: 'jwt'`, `jwtClaim: 'tenant_id'`
- [ ] `examples/subdomain-saas/` — subdomain extraction:
  - Local hosts file note: `127.0.0.1 academy-a.local academy-b.local`
  - `subdomainPattern: '*.local'`
- [ ] All three examples have a passing integration test
- [ ] Document the `withTenantWhere` raw SQL helper with one example

### Acceptance Criteria

- [ ] Each example: `pnpm install && pnpm start` works from a fresh checkout
- [ ] Each example responds correctly to a tenant-scoped curl request
- [ ] Each example responds with 500 + clear error to a request missing tenant context (in strict mode)
- [ ] Method-level strictMode override behaves as documented

---

## Milestone v0.1.0 — Public Release

**Goal**: Production-ready documentation, CI pipeline, performance benchmark, and npm publish.
**Estimated effort**: ~5 hours (Week 6)

### Tasks

- [ ] `CHANGELOG.md` — initial entry for v0.1.0
- [ ] `SECURITY.md`:
  - "흔한 사고의 90%를 자동 차단, 나머지 10%는 한계 인지 후 수동 처리" framing (ADR-012)
  - Six known gaps: raw SQL / JOIN inner tables / subqueries / migrations / multi-DataSource / dynamic addParameters
  - `withTenantWhere` recommendation for raw SQL
  - Auth middleware boundary (we do not validate tenant ID origin)
  - DB admin direct access is out of scope
  - AsyncLocalStorage context-loss patterns (EventEmitter, queues, timers) + capture/reentry recommendation
  - Recommend Postgres RLS as a second layer (v0.3 will integrate)
- [ ] **Performance benchmark** (PRD §10.1):
  - Measure baseline (manual `where: { tenantId }`) vs library (`runWithTenant`)
  - Use `autocannon` or `k6` for ~100k requests
  - Record `@RequireTenant`, Subscriber, AsyncLocalStorage individual overhead
  - Publish actual numbers in README "Performance" section
  - Do NOT estimate — only commit measured values
- [ ] CI pipeline (GitHub Actions):
  - Lint (ESLint)
  - Type-check (`tsc --noEmit`)
  - Test (`pnpm test`)
  - Build (`pnpm build`)
  - Trigger on: push to `main`, pull request
- [ ] README final review:
  - Confirm "Honest Limits / 90% framing" section is prominent
  - Confirm v0.1 vs future scope is clearly marked
  - Verify all code samples in the existing README compile against the actual implementation
  - Migration guide section (how to convert existing manual-WHERE code) is present
- [ ] `npm publish --access public` (`nestjs-tenant-shield@0.1.0`)
- [ ] Public announcement: dev.to (English) + personal blog (Korean) + NestJS Discord + r/node + 긱뉴스

### Acceptance Criteria

- [ ] GitHub Actions CI passes on a clean branch
- [ ] `npm pack` produces no unexpected files (use `files` in `package.json` allowlist)
- [ ] README clearly states the application-layer-only scope
- [ ] Package is published and `pnpm add nestjs-tenant-shield` works from a fresh project
- [ ] Installing in the `examples/basic-typeorm/` from npm (instead of workspace) works end-to-end

---

## Out-of-Scope Reference (Do Not Implement)

These items are explicitly deferred. If asked to implement them, refuse and redirect to the appropriate future milestone.

| Item | Planned milestone |
|---|---|
| `'schema'` strategy (Postgres schema-per-tenant) | v0.2 |
| `'database'` strategy (DB-per-tenant) | v0.2 |
| Prisma adapter | v0.2 |
| BullMQ/Bull `@TenantContext()` queue propagation | v0.2 |
| `forRootAsync` | v0.1.x patch |
| `purgeTenant(id)` GDPR helper | v0.2 |
| Mongoose adapter | v0.3 |
| Postgres RLS auto-setup | v0.3 |
| GraphQL DataLoader integration | v0.3 |
| Auto-migration tool (manual → auto) | backlog |
| Performance benchmark automation | v1.0 |
| Tenant registry / valid-ID lookup | not planned (out of library scope) |
| HTTP-layer tenant ID validation/signing | not planned (auth middleware concern) |
