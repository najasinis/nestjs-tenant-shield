# Architecture — @guardrail/audit

> Source of truth for component relationships and module boundaries.
> For design rationale behind each decision, see [`DECISIONS.md`](./DECISIONS.md).
> For the full requirements behind this architecture, see [`docs/Audit_Log_PRD.md`](../docs/Audit_Log_PRD.md).

---

## High-Level Overview

```
Host NestJS App
│
├── AppModule
│   └── AuditLogModule.forRoot(options)   ← one-time global setup
│
├── SomeService
│   └── @AuditLog({ action, resource })   ← decorator attaches metadata
│       └── someMethod(...)
│
└── [Every HTTP request flows through]
    └── AuditLogInterceptor (global)
        ├── reads @AuditLog metadata
        ├── resolves actorId via options.actorResolver
        ├── captures args + result (with masking)
        ├── delegates hash + write to AuditLogStorage
        └── never blocks business logic on failure
```

---

## Component Catalog

### `AuditLogModule`

**File**: `src/audit-log.module.ts`
**Role**: NestJS dynamic module. Bootstraps the entire library with a single `forRoot()` call.

Responsibilities:
- Accept `AuditLogModuleOptions` (storage type, actorResolver, genesisHash).
- Instantiate the correct `AuditLogStorage` implementation.
- Register `AuditLogInterceptor` as a `global` interceptor (`APP_INTERCEPTOR`).
- Export `AuditLogService` for programmatic access (query + verify).

Registration pattern:
```typescript
@Global()
@Module({})
export class AuditLogModule {
  static forRoot(options: AuditLogModuleOptions): DynamicModule {
    const storageProvider = {
      provide: AUDIT_STORAGE_TOKEN,
      useValue: new InMemoryAuditLogStorage(options.genesisHash),
    };
    return {
      module: AuditLogModule,
      global: true,
      providers: [
        storageProvider,
        { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
        AuditLogService,
        { provide: AUDIT_OPTIONS_TOKEN, useValue: options },
      ],
      exports: [AuditLogService],
    };
  }
}
```

---

### `@AuditLog()` Decorator

**File**: `src/decorators/audit-log.decorator.ts`
**Role**: Pure metadata attachment. Zero side effects.

- Validates `action` and `resource` are non-empty strings at boot time → throws `Error` if not (Fail-Fast).
- Stores `AuditLogOptions` on the method via `Reflect.defineMetadata(AUDIT_LOG_METADATA, options, target, key)`.
- The interceptor reads this metadata at request time.

```
Decorator (boot time)
  └── Reflect.defineMetadata(AUDIT_LOG_METADATA, options, target, methodKey)

Interceptor (request time)
  └── Reflect.getMetadata(AUDIT_LOG_METADATA, handler)
```

---

### `AuditLogInterceptor`

**File**: `src/audit-log.interceptor.ts`
**Role**: Core runtime engine. Runs around every method decorated with `@AuditLog`.

**Execution flow** (per request):

```
1. getMetadata(handler) → if no @AuditLog metadata, skip entirely
2. actorId = options.actorResolver(request) ?? null
3. captureArgs → mask → before
4. call next.handle() → observe()
   ├── success: captureResult → mask → after, succeeded = true
   └── error:   errorMessage = err.message, succeeded = false, re-throw
5. build AuditLogEntry (without prevHash/selfHash)
6. storage.write(entry) ← async, non-blocking (errors only log)
```

Non-blocking guarantee:
```typescript
storage.write(entry).catch((err) => {
  this.logger.error('AuditLog storage write failed', err);
  // business logic is unaffected
});
```

---

### `AuditLogStorage` Interface

**File**: `src/storage/audit-log-storage.interface.ts`

```typescript
export interface AuditLogStorage {
  write(entry: Omit<AuditLogEntry, 'prevHash' | 'selfHash'>): Promise<void>;
  query(filter: AuditLogFilter): Promise<AuditLogEntry[]>;
  getLast(): Promise<AuditLogEntry | null>;
}
```

> Note: `write()` receives an entry **without** hash fields. The storage implementation is responsible for computing `prevHash` and `selfHash` atomically. This keeps the interceptor decoupled from hash logic.

---

### `InMemoryAuditLogStorage`

**File**: `src/storage/in-memory-audit-log.storage.ts`
**Role**: v0.1 storage implementation. Production-unsafe (memory-only), development/test use only.

**Write queue pattern** (ensures sequential hash chain):

```typescript
class InMemoryAuditLogStorage implements AuditLogStorage {
  private entries: AuditLogEntry[] = [];
  private writeQueue: Promise<void> = Promise.resolve();

  async write(rawEntry): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => {
      const prev = this.entries.at(-1);
      const prevHash = prev?.selfHash ?? this.genesisHash;
      const entry = { ...rawEntry, prevHash, selfHash: '' };
      const { selfHash: _, ...dataToHash } = entry;
      entry.selfHash = computeHash(prevHash, dataToHash);
      this.entries.push(entry);
    });
    return this.writeQueue;
  }
}
```

Concurrency model: JavaScript is single-threaded, but `async/await` yields between ticks. The write queue serializes all writes so no two requests compute hashes simultaneously.

---

### Hash Chain Utilities

#### `canonicalStringify(obj)`
**File**: `src/utils/canonical-stringify.util.ts`

Converts any object to a deterministic JSON string regardless of key insertion order.

Rules:
1. Sort object keys alphabetically at every level (recursive).
2. `Date` → `toISOString()`.
3. `undefined` → omit key (matches `JSON.stringify` default).
4. Circular references → `'[Unserializable]'` string value.
5. Arrays: preserve element order, but sort keys within each element object.

#### `computeHash(prevHash, entry)`
**File**: `src/utils/compute-hash.util.ts`

```typescript
import { createHash } from 'node:crypto';

export function computeHash(prevHash: string, entry: object): string {
  return createHash('sha256')
    .update(prevHash + canonicalStringify(entry))
    .digest('hex'); // 64-char lowercase hex
}
```

#### `maskFields(obj, paths)`
**File**: `src/utils/mask-fields.util.ts`

Deep-clones `obj`, then walks each dot-notation path (e.g. `'user.password'`) and replaces the value with `'[REDACTED]'`. If a path does not exist, silently skips. Never mutates the original.

---

### `AuditLogService`

**File**: `src/audit-log.service.ts`
**Role**: Public API for programmatic query and chain verification.

```typescript
class AuditLogService {
  query(filter: AuditLogFilter): Promise<AuditLogEntry[]>;
  verify(): Promise<VerifyResult>;
}

interface VerifyResult {
  isValid: boolean;
  tamperedAt: number | null;  // sequence index of first broken link
  message: string;
}
```

`verify()` walks all stored entries, recomputes each `selfHash`, and checks it matches the stored value and that `prevHash` equals the previous entry's `selfHash`.

---

## Data Flow Diagram

```
HTTP Request
     │
     ▼
AuditLogInterceptor.intercept()
     │
     ├─ [no @AuditLog metadata] ──────────────────────────► next.handle() (passthrough)
     │
     ├─ actorResolver(req) → actorId
     │
     ├─ captureArgs=true → args snapshot → maskFields → before
     │
     ├─ next.handle() ──────────────────────────────────────┐
     │                                                       │ (rxjs stream)
     │                                                       ▼
     │                                              succeeded=true, after=result
     │                                              OR
     │                                              succeeded=false, errorMessage
     │◄──────────────────────────────────────────────────────┘
     │
     ├─ build RawEntry (no prevHash/selfHash yet)
     │
     ├─ storage.write(rawEntry) ── async, non-blocking
     │       │
     │       ▼ (inside writeQueue, sequential)
     │   prevHash = lastEntry.selfHash ?? genesisHash
     │   dataToHash = { ...rawEntry, prevHash }
     │   selfHash = SHA256(prevHash + canonicalStringify(dataToHash))
     │   entries.push({ ...rawEntry, prevHash, selfHash })
     │
     └─ return observable to client (unblocked)
```

---

## Injection Tokens

| Token constant | Provided by | Consumed by |
|---|---|---|
| `AUDIT_LOG_METADATA` | `@AuditLog()` decorator | `AuditLogInterceptor` |
| `AUDIT_STORAGE_TOKEN` | `AuditLogModule.forRoot()` | `AuditLogInterceptor`, `AuditLogService` |
| `AUDIT_OPTIONS_TOKEN` | `AuditLogModule.forRoot()` | `AuditLogInterceptor` |
| `APP_INTERCEPTOR` | `AuditLogModule.forRoot()` | NestJS core (global interceptor registration) |

---

## What This Architecture Deliberately Does NOT Do (v0.1)

- No HTTP REST endpoints (library, not a server module)
- No database connections (TypeORM/Prisma in v0.2)
- No file I/O
- No external process calls
- No cron jobs or background tasks
- No `forRootAsync` (synchronous only in v0.1)
- No `resourceId` auto-extraction from method arguments
