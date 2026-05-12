# Architecture Decision Records — nestjs-tenant-shield

> Each ADR captures a significant technical choice: what was decided, why, and what alternatives were rejected.
> New decisions should be added here before implementation begins.

---

## ADR-001: AsyncLocalStorage via Node.js Built-in `async_hooks`

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: Use `node:async_hooks.AsyncLocalStorage` for request-scoped tenant context. No external library.

**Rationale**:
- Built-in to Node.js ≥18 with stable propagation across native promises and async/await.
- The exact mechanism designed for this use case (request-scoped state without manual threading).
- Zero dependency cost; zero supply chain risk.
- Used by `nestjs-cls` and most of the NestJS ecosystem — proven track record.

**Rejected alternatives**:
- `cls-hooked` — older API, deprecated in favor of AsyncLocalStorage.
- Passing tenant ID as an explicit parameter — defeats the entire library's purpose (declarative isolation).
- `REQUEST` scoped providers — work, but force every consumer to be `REQUEST`-scoped, ballooning DI cost across the app.

---

## ADR-002: Discriminator-First Strategy in v0.1

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: v0.1 supports only `strategy: 'discriminator'`. The `'schema'` and `'database'` strategies are reserved type values that throw `InvalidTenantSourceError` if selected.

**Rationale**:
- Discriminator is the most common pattern in B2B SaaS (single DB, single schema, `tenant_id` column).
- It's also the most error-prone — easiest to forget the WHERE clause — so it benefits most from auto-injection.
- Schema/Database isolation are operationally heavier and less commonly customized; deferring lets v0.1 ship faster with a focused value prop.
- Keeping the type union open for future strategies preserves API stability (no breaking change in v0.2).

**Rejected alternatives**:
- Ship all three strategies in v0.1 — triples the implementation surface, delays public release by months.
- Drop `'schema'`/`'database'` from the type union — would force a breaking change in v0.2.

---

## ADR-003: TypeORM Subscriber, Not Repository Wrapper

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: Auto-WHERE injection runs in a TypeORM `EntitySubscriberInterface`, not by wrapping the `Repository` class.

**Rationale**:
- Subscriber hooks (`beforeQuery`, `afterLoad`, `beforeInsert`) fire for ALL queries — `find`, `findOne`, `update`, `delete`, custom QueryBuilder, even some raw paths through `manager.query`. A repository wrapper would only cover what we explicitly proxy.
- Subscribers are first-class TypeORM API; they survive TypeORM upgrades better than monkey-patching the Repository.
- The user keeps using the standard `Repository<T>` injection — no new pattern to learn.

**Rejected alternatives**:
- Custom `Repository<T>` extension — partial coverage, breaks raw QueryBuilder calls.
- Proxying via `@InjectRepository` — same coverage gap, plus DI complications.
- TypeORM `relationLoadStrategy` interception — wrong layer, only covers eager-loaded relations.

---

## ADR-004: Fail-Loud, Not Non-Blocking

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: Missing tenant context, cross-tenant entity detection, and configuration errors all throw immediately. The library is **not** non-blocking.

**Rationale**:
- Tenant isolation is a security boundary. A failed isolation check means customer data may leak across companies — far worse than the cost of a 500 response.
- Audit-log-style "log and continue" would silently allow data leaks to ship to production. Unacceptable for this domain.
- Strict mode is the default, and disabling it requires explicit opt-in (`strictMode: false`), which is documented as production-discouraged.

**Trade-off acknowledged**: A misconfigured route causes user-visible 500s during development. This is a feature: it forces the developer to configure the resolver correctly before shipping.

---

## ADR-005: `afterLoad` as Defense-in-Depth (Not Primary Defense)

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: The `afterLoad` cross-tenant check is a paranoia layer. The primary defense is `beforeQuery` WHERE injection.

**Rationale**:
- If `beforeQuery` works correctly, no row with mismatched tenant should ever reach `afterLoad`. So `afterLoad` should normally be a no-op.
- Including `afterLoad` catches escape hatches we cannot fully cover from `beforeQuery`: raw `query()` calls, custom QueryRunners, third-party plugins that bypass QueryBuilder, etc.
- An `afterLoad` throw in production should be treated as a P0 incident — it means something bypassed our primary defense.

**Implication**: Documentation must clarify this. Users should not rely on `afterLoad` as their isolation strategy, but as a tripwire.

---

## ADR-006: Zero Runtime Dependencies

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: The published `nestjs-tenant-shield` package has an empty `dependencies` field.

**Rationale**:
- Library consumers should not inherit transitive dependencies from a tenant-isolation utility.
- All required functionality fits within Node.js built-ins and NestJS peer dependencies.
- Reduces supply chain attack surface (security-sensitive library).
- Subdomain pattern matching, args hashing for cache keys, etc. are all small enough to self-implement (<100 lines combined).

**peerDependencies**:
- `@nestjs/common ^10 || ^11`, `@nestjs/core ^10 || ^11`, `rxjs ^7`, `reflect-metadata ^0.1.13 || ^0.2`
- Optional peers (only required if user uses that ORM): `typeorm ^0.3` (v0.1), `@prisma/client ^5` (v0.2)

---

## ADR-007: Single Package, Not a Series

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: Ship as a single `nestjs-tenant-shield` package. Do NOT use `@guardrail/*` or any namespace from earlier explorations.

**Rationale**:
- Multi-package series add publishing/versioning overhead before there's a track record.
- v0.1 success is the gate for "should this become a series?" — making that call now is premature.
- A well-named single package is more discoverable on npm than a niche scope.
- If v0.2/v0.3 split adapters into separate packages (e.g., `nestjs-tenant-shield-prisma`), we can do so without renaming the core.

**Rejected alternatives**:
- `@guardrail/multi-tenant` series — explored and rejected before this PRD; overengineered for a v0.1.

---

## ADR-008: Default `strictMode: true` and `allowSystemActions: false`

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: Both safety settings default to their secure value. Users must explicitly opt out.

**Rationale**:
- A copy-pasted minimal `forRoot` config must be safe for a B2B SaaS by default.
- Insecure defaults invite production incidents from devs who don't read every option.
- The cost of opting out is one boolean — trivial when actually needed.

**Implication**: Documentation should NOT show `strictMode: true` in examples (it's redundant) — but the `forRoot` example in this repo's README does include it for clarity. That is a deliberate readability choice, not a hint that it's optional.

---

## ADR-009: Tenant Resolvers Return `string | null`, Never Throw

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: All four built-in resolvers (`HeaderResolver`, `JwtResolver`, `SubdomainResolver`, `CustomResolver`) return `string | null`. They never throw.

**Rationale**:
- The middleware is global and runs on every request, including public routes (`/health`, `/auth/login`). A throwing resolver would break those.
- Decision authority belongs to `@RequireTenant()`. The decorator decides whether `null` is acceptable for a given route.
- Clean separation: resolvers know "where to look," decorators know "is null OK here."

**Implication**: `CustomResolver` wraps the user's function in try/catch, converting exceptions to `null`. This is a deliberate choice — a buggy custom resolver should not crash unrelated public routes.

---

## ADR-010: Cache Key Format `${tenantId}:${className}.${methodName}:${argsHash}`

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: When `@Cacheable({ tenantScoped: true })` is used, cache keys follow the format above, in that exact order.

**Rationale**:
- Tenant prefix first → enables `KEYS academy-A:*` style debugging in Redis.
- ClassName.methodName → human-readable, easy to identify in cache inspector.
- argsHash last → variable-length suffix.
- This format is documented as part of the public contract. Changing it between versions invalidates all caches across upgrades — treat as breaking change.

**Rejected alternatives**:
- Hash the entire key for opacity — kills debuggability for marginal benefit.
- Tenant ID as suffix — hurts Redis pattern matching for tenant-scoped operations (purge, scan, etc.).

---

## ADR-011: Subscriber Auto-Registers from `forRoot` (No Manual Wiring)

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: Users do NOT need to register `TenantSubscriber` with their TypeORM `DataSource` manually. `forRoot()` does it automatically.

**Rationale**:
- One-step integration is a top selling point. Manual subscriber registration would be one more step the user can forget — a forgotten subscriber means zero protection.
- We can detect the user's `DataSource` via NestJS DI and call `dataSource.subscribers.push(...)` at module init.
- If a user wants opt-in registration for advanced cases, they can omit `forRoot` and use the lower-level exports — but that is intentionally an advanced path.

**Implication**: Order of module imports matters slightly — `TypeOrmModule.forRoot()` must be initialized before our subscriber registration. Document this clearly. NestJS module dependency declaration handles ordering when set up correctly.

---

## ADR-012: Honest Limits Framing — "90% Coverage, Not 100%"

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: The library publicly markets itself as catching the **common ~90% of cross-tenant accidents**, NOT as a complete tenant security solution. README, SECURITY.md, and the API spec (§6.2) all preserve this framing.

**Rationale**:
- Claiming 100% coverage when the Subscriber demonstrably misses raw SQL, JOIN inner tables, subqueries, migrations, and multi-DataSource transactions is a security lie. Users will skip Postgres RLS, skip code review of raw queries, skip pen tests — and a leak will eventually happen.
- The competitive position is honest: "we catch what's easy to forget; you still own the hard cases." This builds trust with security-conscious users (B2B SaaS).
- Audit-log uses identical framing ("tamper-evidence, not tamper-prevention"). Consistency across the developer's OSS portfolio.

**Implication**:
- Every README/PRD/API-spec change must preserve the "90% / 10%" wording.
- `afterLoad` is documented as a tripwire for the 10%, not as the primary defense.
- v0.3 Postgres RLS integration is positioned as the proper second layer that closes the remaining ~10%.

---

## ADR-013: `@SystemAction` Preferred Over `runWithoutTenant` for Recommendations

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: When suggesting code that bypasses tenant context, the library and its documentation prefer the declarative `@SystemAction()` decorator over the procedural `runWithoutTenant(fn)` helper.

**Rationale**:
- `@SystemAction()` lives at the method definition site — visible in code review, statically analyzable, lint-able.
- `runWithoutTenant(fn)` is a runtime call that's easy to miss in PR review (one extra line buried in a function body).
- For genuinely dynamic scenarios (cron iterating over all tenants, suppressing context for an external lib call), `runWithoutTenant` is still the right tool — but those cases are the minority.

**Implication**:
- Examples and snippets use `@SystemAction()` first, then mention `runWithoutTenant` for dynamic cases.
- Both require `forRoot.allowSystemActions: true` (default `false`) — the secure-by-default principle.
- API spec §6.1 documents the decision matrix: declarative vs procedural.

---

## ADR-014: `tenantIdField` Is Always Dynamic, Never Hardcoded

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: Every reference to the tenant column (Subscriber WHERE injection, `afterLoad` check, `beforeInsert` assignment, error messages) reads from `options.tenantIdField` at runtime. The literal string `'tenantId'` appears only in default values and example documentation.

**Rationale**:
- Real-world B2B SaaS uses domain-specific column names: ClassDay uses `spaceId`, hospital systems use `hospitalId`, Slack-style apps use `workspaceId`, Salesforce-style apps use `orgId`. Forcing `tenantId` would make the library unusable in established codebases.
- Hardcoding is a refactor hazard: a future contributor renaming "tenant" to something else would silently break user code.
- Keeps the library single-package: no need for `nestjs-tenant-shield-spaceId` etc.

**Implication**:
- Tests cover at least two distinct field names (`tenantId` and one alternative like `spaceId`) per test suite.
- Documentation rotates examples through different field names to demonstrate flexibility.
- README "다양한 도메인 예시" / "어떤 컬럼명이든 OK" is the primary onboarding evidence of this property.

---

## ADR-015: AsyncLocalStorage Loss Is User-Surfaced, Not Library-Hidden

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: When AsyncLocalStorage context is lost (EventEmitter, queue libraries, certain timer patterns), the library does NOT attempt magical reconstruction. Instead, it documents the boundaries and recommends explicit capture-and-reentry.

**Rationale**:
- Magical context restoration would require monkey-patching Node.js internals or hooking every async primitive — fragile, version-dependent, and a maintenance nightmare.
- Explicit capture (`const tid = getCurrentTenantId(); runWithTenant(tid, fn)`) is a 2-line pattern that every NestJS developer can understand and review.
- Failing loudly (via the `@RequireTenant` interceptor or Subscriber `MissingTenantContextError`) is the correct response — silently dropping context would cause data leaks downstream.

**Implication**:
- API spec §6.3 documents which patterns lose context and the recommended capture pattern.
- v0.2's `@TenantContext()` for BullMQ is the framework-specific exception (the queue is the boundary; the decorator handles the capture/reentry).

---

## ADR-016: Reserved Parameter Name `__tid__` for Auto-Injected WHERE

**Status**: Accepted
**Date**: 2026-05-09

**Decision**: The auto-injected WHERE uses parameter name `__tid__` (double-underscore prefix and suffix).

**Rationale**:
- Avoids collision with user-provided parameter names (`tenantId`, `tid`, etc.) in their own QueryBuilder calls.
- Underscore-bracketed names are conventionally reserved for internal use.
- Documented as a reserved name in the library — users must not use `__tid__` in their own queries.

**Rejected alternatives**:
- `tenantId` — high collision risk; many user codebases already use it.
- A randomly generated name per query — works, but harder to debug query logs.
