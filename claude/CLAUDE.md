# nestjs-tenant-shield — Claude Harness

## Project Identity

**Package**: `nestjs-tenant-shield`
**Purpose**: A NestJS decorator library that automates multi-tenant data isolation for B2B SaaS backends, preventing cross-tenant data leakage at the application layer.
**Core differentiator**: Discriminator-pattern auto-WHERE injection + cache key isolation + cross-tenant detection — no other NestJS library combines these as of 2026-05.

**Authoritative documents** (always read before writing any code):
- [`docs/tenant-shield-PRD.md`](../docs/tenant-shield-PRD.md) — Product requirements, milestones, design principles
- [`docs/tenant-shield-api-spec.md`](../docs/tenant-shield-api-spec.md) — Public API surface and data contracts
- [`multi-tenant-explainer.md`](../multi-tenant-explainer.md) — Conceptual primer (analogies, isolation patterns)
- [`claude/ARCHITECTURE.md`](./ARCHITECTURE.md) — Component graph and module boundaries
- [`claude/IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — Milestone breakdown with acceptance criteria
- [`claude/DECISIONS.md`](./DECISIONS.md) — Architecture Decision Records (ADRs)

---

## Non-Negotiable Rules

### ⚠️ RULE 0 — Company Code Copyright Boundary (MUST READ FIRST)

**`nestjs-tenant-shield` is a personal open-source project. It must remain free of any code owned by the employer (슈퍼러닝 / Superlearning).**

The following directories contain company-owned source code. They are identified by the keywords `eduspace` and `classday`:

```
/Users/admin/Project/eduspace               ← company property
/Users/admin/Project/classday-attendance-v2 ← company property
```

**Hard prohibitions — violation of any of these constitutes an IP/copyright conflict:**

1. **Do NOT copy any file, function, class, type, or snippet** from `eduspace` or `classday-attendance-v2` into this project.
2. **Do NOT read those files and then rewrite "similar" code** for this project — deriving code from company source still constitutes a derivative work.
3. **Do NOT use those files as a template or reference** when implementing any feature in `nestjs-tenant-shield`.
4. **Do NOT import or depend on any package** that was created exclusively for or within those company projects.

**Special caution for this project**: Multi-tenancy with a `spaceId` discriminator is the exact pattern used inside ClassDay (the company product). It is fine to support a `spaceId` field name as an example because the *concept* is industry-standard, but the *implementation* must come from public NestJS/TypeORM documentation only — never from inspecting company code.

**What you may do**:
- Reference publicly documented NestJS, TypeScript, TypeORM, and Node.js APIs.
- Reference the specs and docs **within this repository** (`docs/`, `multi-tenant-explainer.md`, `claude/`).
- Reference public OSS libraries' source/docs (e.g., `nestjs-cls`, `@needle-innovision/nestjs-tenancy`) for inspiration — they are MIT/Apache licensed and public.
- Write all implementation from scratch using public documentation and general engineering knowledge.

**If you are uncertain whether a pattern comes from company code or public NestJS knowledge, choose the public documentation route and do not reference the company directories at all.**

---

### Rule 1 — Use This Repository's Own Specs as the Source of Truth

**Before writing any new code, check if a pattern, interface, or utility is already defined within this repository.**

- Read the PRD (`docs/tenant-shield-PRD.md`) and API spec (`docs/tenant-shield-api-spec.md`) before proposing or implementing anything.
- All interface shapes (`TenantShieldOptions`, `RequireTenantOptions`, `CacheableOptions`, `TenantContextOptions`) are already defined in the API spec — copy them verbatim, do not invent variants.
- All design principles (Automation-first, Fail-Loud, Defense in Depth, Test enforcement, Progressive adoption, ORM neutrality, Performance non-blocking) are specified in PRD §3 — follow them exactly.
- Milestones and out-of-scope items are defined in PRD §7 and §8 — do not implement features beyond the current milestone's scope.

**Rationale**: The specs in this repo are the only legitimate reference for implementation. Company codebases are off-limits (see Rule 0 above).

### Rule 2 — Zero Runtime Dependencies

The library's `dependencies` field in `package.json` must remain empty for v0.1.

- AsyncLocalStorage: use Node.js built-in `node:async_hooks` only.
- Reflect metadata: provided via `reflect-metadata` peer dep (already required by NestJS).
- Subdomain parsing: self-implement (~30 lines), do not add `tldts` or similar.
- Cache key building: self-implement string concatenation, do not add hashing/lib helpers.

Allowed `peerDependencies` (already in user's app, never bundled):

| Package | Version | Required for |
|---|---|---|
| `@nestjs/common` | `^10 \|\| ^11` | Always |
| `@nestjs/core` | `^10 \|\| ^11` | Always |
| `rxjs` | `^7` | Always |
| `reflect-metadata` | `^0.1.13 \|\| ^0.2` | Always |
| `typeorm` | `^0.3` | Only if user uses TypeORM strategy (v0.1 main path) |
| `@prisma/client` | `^5` | v0.2 (Prisma adapter) |

### Rule 3 — Scope Lock per Milestone

Never implement features from a future milestone while working on the current one.

| Milestone | Scope |
|---|---|
| v0.0.1 | Interfaces + AsyncLocalStorage context + middleware skeleton + build pipeline |
| v0.0.2 | `@RequireTenant()` decorator + tenant resolvers (header/jwt/subdomain/custom) |
| v0.0.3 | TypeORM Subscriber: auto WHERE injection + afterLoad cross-tenant detection (CORE) |
| v0.0.4 | `@Cacheable({ tenantScoped })` + `runWithTenant` / `runWithoutTenant` test helpers |
| v0.0.5 | Strict mode wiring + `@SystemAction()` + example apps |
| v0.1.0 | CI, CHANGELOG, SECURITY.md, README polish, npm publish |

Items **explicitly out of scope for v0.1**:
- Schema/Database isolation strategies (`'schema'`, `'database'`) → v0.2
- Prisma adapter → v0.2
- BullMQ/Bull `@TenantContext()` decorator → v0.2
- Mongoose adapter → v0.3
- Postgres RLS auto-setup → v0.3
- GraphQL DataLoader integration → v0.3
- `forRootAsync` → v0.1.x patch
- Tenant purge helper (`purgeTenant`) → v0.2
- Auto migration tool → backlog

### Rule 4 — Fail-Loud at Boot, Fail-Loud at Runtime

This is the **opposite** of "non-blocking." Tenant isolation is a **security boundary**, not observability.

- Missing required option (e.g., `customResolver` when `tenantSource: 'custom'`) → throw `InvalidTenantSourceError` at `forRoot()` evaluation time (app boot).
- Missing tenant context at request time + `strictMode: true` (default) → throw `MissingTenantContextError`. Never silently fall through.
- Cross-tenant entity detected in `afterLoad` → throw `CrossTenantAccessError` immediately. Never log-and-continue.

**Why different from audit-log's Non-Blocking policy**: A failed audit log loses observability data. A failed tenant check leaks customer data across companies — orders of magnitude worse. Default to failure.

### Rule 5 — Discriminator Strategy First (v0.1 Only)

`strategy: 'discriminator'` is the only supported value for v0.1. The other values (`'schema'`, `'database'`) must:
- Be present in the type union (so v0.2 doesn't break the API).
- Throw `InvalidTenantSourceError` at boot if selected in v0.1.
- Be documented as "v0.2" in JSDoc and README.

### Rule 6 — Honest Limits Wording

The library provides **application-layer auto-isolation**, NOT **complete tenant security**. Always preserve this distinction in comments, docs, and error messages. The canonical phrasing is:

> **"흔한 사고의 90%를 자동 차단. 나머지 10%는 한계 인지 후 수동 처리. 만능 보안이 아니라 다층 방어(defense in depth)의 한 층."**

The TypeORM Subscriber **does NOT** auto-protect:

1. **Raw SQL** (`repo.query`, `dataSource.query`) — provide `withTenantWhere(sql, columnName)` helper.
2. **JOIN clauses to other tables** — Subscriber adds WHERE on the main entity only. Joined tables need explicit `ON c.tenant_id = :tid` from the user. Document loudly.
3. **Subqueries** — outer query gets the WHERE, but inner `subQuery().from(...)` is on its own. User must add tenant filter.
4. **TypeORM Migration / CLI** — runs without request context; intentional (migrations span all tenants).
5. **Multi-DataSource transactions** — v0.1 only guarantees single-DataSource context propagation. v0.2 backlog.
6. **Raw `addParameters` / dynamic SQL** — bypasses QueryBuilder, bypasses Subscriber.
7. **Tenant ID tampering at HTTP layer** — auth middleware's job, not this library's.
8. **DB admin direct access** — library cannot intercept anything outside the Node.js process.
9. **AsyncLocalStorage context loss** — Node.js 18+ propagates across native promises, but EventEmitter/setTimeout/queue libraries may break the chain. Recommend explicit capture (`const tid = getCurrentTenantId(); runWithTenant(tid, ...)`).

Postgres RLS (v0.3) is the proper second layer — the library is the first layer of defense in depth, never claim it as the only layer.

### Rule 7 — `tenantIdField` Is User-Defined, Not Hardcoded

The library MUST work with arbitrary column names. Common values include but are not limited to:

`tenantId`, `spaceId`, `hospitalId`, `workspaceId`, `orgId`, `accountId`, `companyId`, `clientId`, `customerId`.

**Hard rules**:
- Never hardcode `'tenantId'` anywhere except as a default in option defaults / examples.
- All Subscriber WHERE injections MUST use `options.tenantIdField`.
- All `afterLoad` checks MUST use `entity[options.tenantIdField]`, never `entity.tenantId` directly.
- Documentation examples should rotate through different field names to demonstrate flexibility.

### Rule 8 — Distinguish `@SystemAction` (declarative) vs `runWithoutTenant` (procedural)

These two are NOT interchangeable:

| Tool | Nature | When to recommend |
|---|---|---|
| `@SystemAction()` | Declarative — method is *always* a system action | Method-level invariant; visible in code review |
| `runWithoutTenant(fn)` | Procedural — *this call* runs without tenant | Runtime decision; iterating over all tenants; suppressing context for an external lib call |

When suggesting code, prefer `@SystemAction()` whenever possible — it's statically analyzable. Only suggest `runWithoutTenant` for genuinely dynamic scenarios (e.g., a cron iterating over all tenants and re-entering each via `runWithTenant`).

Both require `forRoot.allowSystemActions: true`. The default `false` keeps insecure escape hatches off until explicitly enabled.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript 5.x | Decorator support, strong typing for DI tokens |
| Framework | NestJS 10/11 | Target runtime; middleware + interceptor + module system |
| Build | tsup | CJS + ESM + `.d.ts` in one config |
| Package manager | pnpm | Lock file commits for reproducible builds |
| Test runner | Jest | Standard NestJS ecosystem |
| Context | Node.js `async_hooks.AsyncLocalStorage` | Built-in, no extra dep, designed for request-scoped state |
| ORM (v0.1) | TypeORM `^0.3` (peer) | Subscriber API supports `beforeQuery`/`afterLoad` hooks needed for auto-WHERE |
| Node | >=18 | Stable AsyncLocalStorage propagation across native promises |

---

## File Layout (target for v0.1)

```
nestjs-tenant-shield/
├── src/
│   ├── index.ts                                # Public exports only
│   ├── tenant-shield.module.ts                 # TenantShieldModule.forRoot()
│   ├── tenant-context.middleware.ts            # AsyncLocalStorage entry point
│   ├── tenant-context.storage.ts               # AsyncLocalStorage<TenantStore>
│   ├── decorators/
│   │   ├── require-tenant.decorator.ts         # @RequireTenant()
│   │   ├── system-action.decorator.ts          # @SystemAction()
│   │   ├── cacheable.decorator.ts              # @Cacheable() — tenantScoped cache key
│   │   └── tenant-context.decorator.ts         # @TenantContext() — v0.2 stub
│   ├── resolvers/
│   │   ├── tenant-resolver.interface.ts
│   │   ├── header.resolver.ts
│   │   ├── jwt.resolver.ts
│   │   ├── subdomain.resolver.ts
│   │   └── custom.resolver.ts
│   ├── orm/
│   │   ├── typeorm/
│   │   │   ├── tenant.subscriber.ts            # beforeQuery/afterLoad/beforeInsert
│   │   │   └── with-tenant-where.util.ts       # Raw SQL helper
│   │   └── prisma/                             # v0.2 placeholder (empty in v0.1)
│   ├── helpers/
│   │   ├── get-current-tenant-id.ts
│   │   ├── run-with-tenant.ts
│   │   └── run-without-tenant.ts
│   ├── errors/
│   │   ├── missing-tenant-context.error.ts
│   │   ├── cross-tenant-access.error.ts
│   │   └── invalid-tenant-source.error.ts
│   └── interfaces/
│       ├── tenant-shield-options.interface.ts
│       ├── require-tenant-options.interface.ts
│       └── cacheable-options.interface.ts
├── test/
│   ├── unit/
│   │   ├── decorators/
│   │   ├── resolvers/
│   │   └── helpers/
│   └── integration/
│       ├── auto-where-injection.spec.ts
│       ├── cross-tenant-detection.spec.ts
│       └── cache-key-isolation.spec.ts
├── examples/
│   ├── basic-typeorm/                          # Header-based, single tenant column
│   ├── jwt-multitenancy/                       # JWT claim-based extraction
│   └── subdomain-saas/                         # academy-a.example.com style
├── docs/
│   ├── tenant-shield-PRD.md                    # (existing)
│   └── tenant-shield-api-spec.md               # (existing)
├── claude/
│   ├── CLAUDE.md                               # (this file)
│   ├── ARCHITECTURE.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── DECISIONS.md
├── multi-tenant-explainer.md                   # (existing) conceptual primer
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── jest.config.ts
├── CHANGELOG.md
├── SECURITY.md
└── README.md                                   # (existing)
```

---

## Key Invariants to Preserve

1. **Tenant context is request-scoped, not global**: every tenant lookup MUST go through AsyncLocalStorage. Never store tenant ID in a singleton, module property, or static field. Concurrent requests would clobber each other.

2. **`afterLoad` is the last line of defense, not the first**: the auto-WHERE injection in `beforeQuery` should make cross-tenant rows impossible. `afterLoad` is a paranoia check that catches escape hatches (raw SQL, subscriber misconfiguration). If `afterLoad` ever throws in production, treat it as a P0 incident — something bypassed the WHERE injection.

3. **`@RequireTenant()` only marks intent — Subscriber does the work**: the decorator stores metadata. The TypeORM Subscriber reads `getCurrentTenantId()` and injects WHERE. This separation lets the same Subscriber serve all decorated services without per-method wiring.

4. **Default = secure**: `strictMode: true` and `allowSystemActions: false` are the defaults. A user who copy-pastes the minimal `forRoot` example must already be safe.

5. **Subscriber registration is automatic when strategy is `'discriminator'`**: users should never have to manually register the Subscriber with TypeORM. The module wires it via `DataSource` injection at boot.

6. **Cache key prefix order is stable**: `${tenantId}:${className}.${methodName}:${argsHash}`. Changing this order between versions invalidates all caches across upgrades — treat as breaking change.

7. **Errors carry actionable context**: `CrossTenantAccessError` must include `currentTenant`, `attemptedTenant`, and `entityName`. `MissingTenantContextError` must include the configured `source` (header/jwt/etc) so the user knows where to look.

8. **`tenantIdField` is dynamic, never hardcoded**: every reference must read from `options.tenantIdField`. The library must work for `spaceId`, `hospitalId`, `workspaceId`, `orgId`, etc. interchangeably. Hardcoding `'tenantId'` anywhere outside default values is a bug.

9. **Subscriber covers ~90%, not 100%**: any code path that bypasses TypeORM's QueryBuilder (raw SQL, JOIN inner tables, subqueries, migrations, multi-DataSource transactions) is NOT auto-protected. The harness, README, SECURITY.md, and `claude/DECISIONS.md` must all preserve this honest framing — never claim 100% coverage in a docstring or example.

10. **AsyncLocalStorage propagation is best-effort across boundaries**: Node.js 18+ handles native async/await well, but cross-process queues, EventEmitters, and some timer-based patterns may lose context. Whenever a code suggestion crosses such a boundary, recommend explicit capture: `const tid = getCurrentTenantId(); runWithTenant(tid, fn)`.
