# Architecture — nestjs-tenant-shield

> Source of truth for component relationships and module boundaries.
> For design rationale behind each decision, see [`DECISIONS.md`](./DECISIONS.md).
> For the full requirements behind this architecture, see [`docs/tenant-shield-PRD.md`](../docs/tenant-shield-PRD.md).

> Implementation status note: this document describes the **target architecture** for v0.x. It is not evidence that the corresponding runtime code already exists.

---

## High-Level Overview

The diagram below is the intended end state after milestone implementation.

```
Host NestJS App
│
├── AppModule
│   └── TenantShieldModule.forRoot(options)        ← one-time global setup
│       └── registers TenantContextMiddleware globally
│       └── registers TenantSubscriber on TypeORM DataSource
│
├── HTTP Request lifecycle
│   ├── TenantContextMiddleware
│   │   ├── tenantResolver(req) → tenantId | null
│   │   └── tenantContextStorage.run({ tenantId }, next)   ← AsyncLocalStorage
│   │
│   └── Controller / Service (decorated with @RequireTenant)
│       └── repository.find() / find()
│           └── TenantSubscriber.beforeQuery
│               └── reads getCurrentTenantId()
│               └── injects WHERE tenantIdField = ?
│           └── result rows
│           └── TenantSubscriber.afterLoad
│               └── verifies entity.tenantIdField === currentTenantId
│               └── throws CrossTenantAccessError on mismatch
│
└── Test / Background lifecycle
    └── runWithTenant('academy-A', async () => { ... })
        └── tenantContextStorage.run({ tenantId: 'academy-A' }, fn)
```

---

## Component Catalog

### `TenantShieldModule`

**File**: `src/tenant-shield.module.ts`
**Role**: NestJS dynamic module. Bootstraps the entire library with a single `forRoot()` call.

Responsibilities:
- Validate `TenantShieldOptions` at boot (Fail-Loud) — throw `InvalidTenantSourceError` for misconfiguration.
- Instantiate the correct `TenantResolver` (header / jwt / subdomain / custom).
- Register `TenantContextMiddleware` as a global middleware.
- Subscribe `TenantSubscriber` to the user's TypeORM `DataSource` (when `strategy: 'discriminator'`).
- Export `getCurrentTenantId`, `runWithTenant`, `runWithoutTenant` as injectable providers (for DI ergonomics) + as plain functions (for static use).

Boot-time validation matrix:

| Condition | Error |
|---|---|
| `strategy` not `'discriminator'` (in v0.1) | `InvalidTenantSourceError('strategy not supported in v0.1')` |
| `tenantSource: 'custom'` but `customResolver` missing | `InvalidTenantSourceError('customResolver required')` |
| `tenantSource: 'subdomain'` but `subdomainPattern` missing | `InvalidTenantSourceError('subdomainPattern required')` |
| `tenantIdField` empty/missing | `InvalidTenantSourceError('tenantIdField required')` |

---

### `tenantContextStorage` (AsyncLocalStorage)

**File**: `src/tenant-context.storage.ts`
**Role**: The single source of truth for "which tenant is this code running for, right now."

```typescript
export interface TenantStore {
  tenantId: string | null;
  isSystemAction?: boolean;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantStore>();
```

Read access:
- `getCurrentTenantId()` → `tenantContextStorage.getStore()?.tenantId ?? null`

Write access (only these three places enter the storage):
- `TenantContextMiddleware` (per HTTP request)
- `runWithTenant(id, fn)` (test helper / explicit context)
- `runWithoutTenant(fn)` (system action)

**Invariant**: no other code path writes to this storage. Anything else would risk concurrent-request leakage.

---

### `TenantContextMiddleware`

**File**: `src/tenant-context.middleware.ts`
**Role**: HTTP entry point. Establishes the tenant context for the request before any controller/service runs.

Flow:
```
1. resolverInstance.resolve(req) → tenantId | null
2. tenantContextStorage.run({ tenantId }, () => next())
   ├── if tenantId is null AND strictMode AND no @SystemAction:
   │       downstream code throws MissingTenantContextError on first
   │       @RequireTenant boundary (deferred — middleware itself never throws,
   │       since some routes are intentionally public)
   └── else: downstream sees getCurrentTenantId() === tenantId
```

Why deferred validation: routes like `/health` or `/auth/login` legitimately have no tenant. The middleware can't know which routes are tenant-required — that's `@RequireTenant`'s job. So the middleware just establishes context (or null) and lets decorators enforce.

---

### Tenant Resolvers

**Files**: `src/resolvers/{header,jwt,subdomain,custom}.resolver.ts`
**Interface**:

```typescript
export interface TenantResolver {
  resolve(request: unknown): string | null;
}
```

| Resolver | Logic |
|---|---|
| `HeaderResolver` | `request.headers[headerName.toLowerCase()] ?? null` |
| `JwtResolver` | `request.user?.[jwtClaim] ?? request.jwt?.[jwtClaim] ?? null`. Does NOT decode JWT — assumes auth middleware already populated `request.user` |
| `SubdomainResolver` | `request.hostname` matched against `subdomainPattern`, returns the captured subdomain |
| `CustomResolver` | Calls user-provided `customResolver(request)`. Wraps in try/catch — exceptions become `null` to fall through to `MissingTenantContextError` at the decorator level |

The chosen resolver is instantiated once at `forRoot` time and bound into the middleware via DI.

---

### `@RequireTenant()` Decorator

**File**: `src/decorators/require-tenant.decorator.ts`
**Role**: Pure metadata attachment + a small interceptor that validates context presence.

Two-part implementation:

1. **Metadata attachment** (boot time):
   ```typescript
   Reflect.defineMetadata(REQUIRE_TENANT_METADATA, options, target, methodKey);
   ```

2. **Interceptor** (request time):
   - Reads metadata. If absent, passes through.
   - Calls `getCurrentTenantId()`.
   - If null AND `strictMode` AND not `@SystemAction()`: throw `MissingTenantContextError`.
   - Otherwise: invoke handler.

The decorator does NOT inject WHERE clauses — that is the Subscriber's job. The decorator only enforces "context must exist."

When applied to a class: NestJS's reflection walks all method descriptors and applies the metadata to each.

---

### `@SystemAction()` Decorator

**File**: `src/decorators/system-action.decorator.ts`
**Role**: Marks a method as exempt from tenant context requirement.

Behavior:
- Sets `tenantContextStorage` store's `isSystemAction = true` for the method's execution scope.
- Only honored when `forRoot.allowSystemActions: true`. Otherwise still throws.
- The TypeORM Subscriber checks `isSystemAction` and skips WHERE injection (so cron-like cleanup can scan all tenants).

---

### `@Cacheable({ tenantScoped })` Decorator

**File**: `src/decorators/cacheable.decorator.ts`
**Role**: Result caching with optional automatic per-tenant key prefix.

Cache key construction (when `tenantScoped: true`):
```
${tenantId}:${className}.${methodName}:${stableHashOfArgs}
```

`stableHashOfArgs`: deterministic string from args (JSON.stringify with sorted keys + truncate). Self-implemented to avoid an external dep.

Storage: pluggable via NestJS's `CacheModule` (host app provides). The decorator just builds the key and delegates.

When `tenantScoped: false`: no prefix — useful for genuinely shared data (e.g., country list).

⚠️ Mixing `@Cacheable({ tenantScoped: false })` with tenant-specific data is a data-leak vector. Document explicitly.

---

### `TenantSubscriber` (TypeORM)

**File**: `src/orm/typeorm/tenant.subscriber.ts`
**Role**: The actual security boundary. Runs around every TypeORM query for entities that have the configured `tenantIdField`.

Hooks:

#### `beforeQuery(event)`
1. Get `tenantId = getCurrentTenantId()`.
2. If `null` AND `strictMode` AND not `isSystemAction`: throw `MissingTenantContextError`.
3. If `event.queryBuilder` exists: `event.queryBuilder.andWhere('${tenantIdField} = :__tid__', { __tid__: tenantId })`.
4. The `__tid__` parameter name is namespaced to avoid collision with user-provided params.

#### `afterLoad(entity)`
1. Get `tenantId = getCurrentTenantId()`.
2. If `entity[tenantIdField] !== tenantId` AND not `isSystemAction`: throw `CrossTenantAccessError(currentTenant: tenantId, attemptedTenant: entity[tenantIdField], entityName: entity.constructor.name)`.
3. This catches escape hatches: raw SQL, custom QueryRunner, etc.

#### `beforeInsert(entity)`
1. Get `tenantId = getCurrentTenantId()`.
2. If `entity[tenantIdField]` is unset: assign it to `tenantId`.
3. If `entity[tenantIdField]` is set AND differs from `tenantId`: throw `CrossTenantAccessError`. Prevents cross-tenant writes.

Entity opt-in:
- If `forRoot.entities` is provided: only those are subscribed.
- If absent: subscribe to all entities that have a column named `tenantIdField`.

---

### Helper Functions

#### `getCurrentTenantId()`
**File**: `src/helpers/get-current-tenant-id.ts`
```typescript
export function getCurrentTenantId(): string | null {
  return tenantContextStorage.getStore()?.tenantId ?? null;
}
```

#### `runWithTenant(id, fn)`
**File**: `src/helpers/run-with-tenant.ts`
```typescript
export function runWithTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return tenantContextStorage.run({ tenantId }, fn);
}
```

#### `runWithoutTenant(fn)`
**File**: `src/helpers/run-without-tenant.ts`
```typescript
export function runWithoutTenant<T>(fn: () => Promise<T>): Promise<T> {
  return tenantContextStorage.run({ tenantId: null, isSystemAction: true }, fn);
}
```

---

### Errors

**Files**: `src/errors/*.error.ts`

```typescript
class MissingTenantContextError extends Error {
  constructor(message: string, public readonly source: string) { super(message); }
}

class CrossTenantAccessError extends Error {
  constructor(
    message: string,
    public readonly currentTenant: string,
    public readonly attemptedTenant: string,
    public readonly entityName?: string,
  ) { super(message); }
}

class InvalidTenantSourceError extends Error {
  constructor(message: string, public readonly source: string) { super(message); }
}
```

All three extend `Error` (not `HttpException`) — the host app's exception filter decides HTTP mapping.

---

## Data Flow Diagrams

### Diagram 1 — HTTP Request → Tenant-Scoped Query

```
HTTP Request (with x-tenant-id: academy-A)
     │
     ▼
TenantContextMiddleware
     │
     ├─ resolver.resolve(req) → 'academy-A'
     │
     └─ tenantContextStorage.run({ tenantId: 'academy-A' }, () => next())
                │
                ▼
        Controller.findStudents()
                │
                ▼
        @RequireTenant() class
                ├─ interceptor checks getCurrentTenantId() → 'academy-A' ✓
                │
                ▼
        StudentsService.findAll()
                │
                ▼
        repository.find()  ← user's call
                │
                ▼
        TenantSubscriber.beforeQuery
                ├─ getCurrentTenantId() → 'academy-A'
                ├─ event.queryBuilder.andWhere('tenantId = :__tid__', { __tid__: 'academy-A' })
                │
                ▼
        SELECT * FROM student WHERE tenantId = 'academy-A'
                │
                ▼
        rows → entities
                │
                ▼
        TenantSubscriber.afterLoad (per row)
                ├─ entity.tenantId === 'academy-A' ✓
                │
                ▼
        Response to client
```

### Diagram 2 — Cross-Tenant Detection (Escape Hatch Catch)

```
HTTP Request (academy-A context)
     │
     ▼
StudentsService.findOneByRawSQL(id)
     │
     └─ repository.query(`SELECT * FROM student WHERE id = '${id}'`)   ← BAD: no auto-WHERE
            │
            ▼
        Returns row { id, tenantId: 'academy-B', ... }   ← LEAK
            │
            ▼
        TenantSubscriber.afterLoad
            ├─ getCurrentTenantId() → 'academy-A'
            ├─ entity.tenantId === 'academy-B' ✗
            ├─ throw CrossTenantAccessError(
            │     currentTenant: 'academy-A',
            │     attemptedTenant: 'academy-B',
            │     entityName: 'Student',
            │   )
            ▼
        Exception filter → 500 + alert
```

---

## Injection Tokens

| Token | Provided by | Consumed by |
|---|---|---|
| `REQUIRE_TENANT_METADATA` | `@RequireTenant()` | `RequireTenantInterceptor` |
| `SYSTEM_ACTION_METADATA` | `@SystemAction()` | `RequireTenantInterceptor`, `TenantSubscriber` |
| `CACHEABLE_METADATA` | `@Cacheable()` | `CacheableInterceptor` |
| `TENANT_SHIELD_OPTIONS` | `forRoot()` | All resolvers, middleware, subscriber, interceptors |
| `TENANT_RESOLVER` | `forRoot()` | `TenantContextMiddleware` |
| `APP_INTERCEPTOR` (× 2) | `forRoot()` | NestJS core (`RequireTenantInterceptor`, `CacheableInterceptor`) |

---

## TypeORM Subscriber Coverage Map

The Subscriber covers ~90% of common cases. The remaining ~10% must be handled by the user with documented escape hatches.

| Code path | Auto-protected? | Mitigation |
|---|---|---|
| `repo.find()`, `findOne()`, `save()`, `update()`, `delete()` | ✅ Yes | None needed |
| `repo.createQueryBuilder().where().getMany()` (single entity) | ✅ Yes | None needed |
| `repo.createQueryBuilder().leftJoinAndSelect(...)` (joined tables) | ⚠️ Main only | User must add `ON x.tenant_id = :tid` |
| `qb.subQuery().from(...)` (inner subquery) | ❌ No | User must add tenant filter inside subquery |
| `repo.query('SELECT ...')` (raw SQL) | ❌ No | Use `withTenantWhere(sql, columnName)` |
| TypeORM migrations | ❌ No (intentional) | Migrations span all tenants by design |
| TypeORM CLI commands | ❌ No (intentional) | Run outside request context |
| Multi-DataSource transactions | ⚠️ v0.1 unverified | v0.2 backlog; use single DataSource |
| `addParameters` / raw param binding | ❌ No | Use QueryBuilder API |

The `afterLoad` hook is the safety net for cases 3, 4, 5: any row whose `tenantIdField` does not match the current context throws `CrossTenantAccessError`. Treat any production occurrence as a P0 incident.

---

## Field Name Indirection (`tenantIdField`)

The Subscriber, the `@RequireTenant` interceptor, and the cache key builder all reference `options.tenantIdField` rather than the literal string `'tenantId'`. This must be preserved everywhere.

```typescript
// CORRECT — dynamic field reference
event.queryBuilder.andWhere(
  `${this.options.tenantIdField} = :__tid__`,
  { __tid__: getCurrentTenantId() }
);
if (entity[this.options.tenantIdField] !== currentTenantId) { /* throw */ }

// WRONG — hardcoded
event.queryBuilder.andWhere('tenantId = :__tid__', { __tid__: ... });
if (entity.tenantId !== currentTenantId) { /* throw */ }
```

Common field names users will configure: `tenantId`, `spaceId`, `hospitalId`, `workspaceId`, `orgId`, `accountId`, `companyId`, `clientId`, `customerId`.

Tests must cover at least two different field names to prevent accidental hardcoding regressions.

---

## What This Architecture Deliberately Does NOT Do (v0.1)

- No raw SQL auto-protection (only `withTenantWhere` helper as documented escape hatch).
- No automatic JOIN-table tenant filtering (user adds `ON ... tenant_id = :tid`).
- No automatic subquery tenant filtering.
- No HTTP layer tenant ID validation/signing — that is the auth middleware's job.
- No tenant registry / lookup of valid tenant IDs — strings are passed through as-is.
- No Database/Schema isolation strategies (v0.2).
- No Prisma adapter (v0.2).
- No BullMQ/Bull queue context propagation (v0.2).
- No Postgres RLS auto-setup (v0.3).
- No Mongoose adapter (v0.3).
- No `forRootAsync` (v0.1.x patch).
