# Implementation Plan — @guardrail/audit

> Milestone breakdown with acceptance criteria.
> Milestone boundaries come from PRD §13. Out-of-scope items come from PRD §11.
> Always verify the current milestone before starting work — never implement ahead.

---

## How to Use This Document

1. Read the **current milestone** section fully before writing any code.
2. Check the **acceptance criteria** — every item must pass before the milestone is closed.
3. Mark items `[x]` as you complete them.
4. Do not touch items in future milestones.

---

## Milestone v0.0.1 — Foundation

**Goal**: Project scaffolding, build pipeline, and all type definitions. No runtime logic yet.
**Estimated effort**: ~7 hours (Week 1)

### Tasks

- [ ] Initialize `package.json` with correct `name`, `version: "0.0.1"`, `peerDependencies`, empty `dependencies`
- [ ] Configure `tsconfig.json` — `emitDecoratorMetadata: true`, `experimentalDecorators: true`, strict mode
- [ ] Configure `tsup.config.ts` — output CJS + ESM + `.d.ts`, entry `src/index.ts`
- [ ] Configure `jest.config.ts` — ts-jest, coverage threshold 80%
- [ ] Define all interfaces in `src/`:
  - `AuditLogOptions` (decorator input)
  - `AuditLogModuleOptions` (module config)
  - `AuditLogEntry` (storage data model, including `prevHash`, `selfHash`, `sequence`)
  - `AuditLogFilter` (query criteria)
  - `AuditLogStorage` (adapter interface)
- [ ] `@AuditLog()` decorator skeleton — metadata attachment only, Fail-Fast validation
- [ ] `AuditLogModule` skeleton — `forRoot()` returns a `DynamicModule` (providers not wired yet)
- [ ] `src/index.ts` — re-export all public types and the module

### Acceptance Criteria

- [ ] `pnpm build` succeeds and produces `dist/index.cjs`, `dist/index.mjs`, `dist/index.d.ts`
- [ ] `@AuditLog({ action: '', resource: 'x' })` throws at decorator evaluation time (Fail-Fast test)
- [ ] `@AuditLog({ action: 'x', resource: 'x' })` does not throw
- [ ] All interfaces compile with zero TypeScript errors
- [ ] No external packages in `node_modules` beyond `peerDependencies` dev-installs and dev tools

---

## Milestone v0.0.2 — Hash Chain Core

**Goal**: Implement and fully test the cryptographic utilities. No NestJS runtime yet.
**Estimated effort**: ~7 hours (Week 2)

### Tasks

- [ ] `canonicalStringify(obj: unknown): string`
  - [ ] Sorts object keys alphabetically at every level
  - [ ] Handles `Date` → `toISOString()`
  - [ ] Handles circular references → `'[Unserializable]'`
  - [ ] Handles `undefined` values → key omitted
  - [ ] Handles `null`, primitives, nested arrays
- [ ] `computeHash(prevHash: string, entry: object): string`
  - [ ] Uses `node:crypto` SHA-256
  - [ ] Input: `prevHash + canonicalStringify(entry)`
  - [ ] Output: 64-char lowercase hex string
- [ ] Internal chain verifier `verifyChain(entries: AuditLogEntry[], genesisHash: string): VerifyResult`
  - [ ] Returns `{ isValid: true, tamperedAt: null }` for clean chain
  - [ ] Returns `{ isValid: false, tamperedAt: <index> }` for broken link
- [ ] Unit tests for all three utilities (100% branch coverage target)

### Acceptance Criteria

- [ ] `canonicalStringify({ b: 1, a: 2 })` === `canonicalStringify({ a: 2, b: 1 })`
- [ ] `computeHash` returns same result on repeated calls with same inputs (deterministic)
- [ ] Mutating any character in a stored entry causes `verifyChain` to return `isValid: false`
- [ ] Circular reference input does not throw — produces `'[Unserializable]'`
- [ ] Zero external dependencies added
- [ ] All unit tests pass (`pnpm test`)

---

## Milestone v0.0.3 — Interceptor + Storage

**Goal**: Full runtime behavior — interceptor captures calls and persists to in-memory storage with hash chain.
**Estimated effort**: ~10 hours (Week 3)

### Tasks

- [ ] `InMemoryAuditLogStorage`
  - [ ] Implements `AuditLogStorage` interface
  - [ ] Write queue (`Promise` chain) ensures sequential hash computation
  - [ ] `write()` computes `prevHash` (from last entry or genesisHash) and `selfHash` atomically
  - [ ] `query()` supports filtering by `action`, `resource`, `actorId`, `startDate`, `endDate`
  - [ ] `getLast()` returns last entry or `null`
- [ ] `maskFields(obj: object, paths: string[]): object`
  - [ ] Deep clone before mutating
  - [ ] Dot-notation path traversal (e.g., `'user.password'`)
  - [ ] Silently skips non-existent paths
  - [ ] Replaces value with `'[REDACTED]'` string
- [ ] `AuditLogInterceptor`
  - [ ] Reads `AUDIT_LOG_METADATA` from handler — skips if absent
  - [ ] Resolves `actorId` via `actorResolver` from module options (fallback: `null`)
  - [ ] Captures args when `captureArgs: true`, runs `maskFields`
  - [ ] Wraps `next.handle()` with `tap` + `catchError` for result/error capture
  - [ ] Builds `RawEntry` (no hash fields) and calls `storage.write()` non-blockingly
  - [ ] Re-throws original exceptions transparently

### Acceptance Criteria

- [ ] Integration test: 100 concurrent writes → `verifyChain` returns `isValid: true`
- [ ] `storage.write()` failure → business method still returns successfully
- [ ] `maskFields: ['password']` → stored entry has `before.password === '[REDACTED]'`
- [ ] Method that throws → entry has `succeeded: false`, `errorMessage` set, exception propagates to caller
- [ ] `captureArgs: false` → `before` is `null`
- [ ] `captureResult: false` → `after` is `null`
- [ ] All integration tests pass

---

## Milestone v0.0.4 — Module Wiring + Demo Apps

**Goal**: Complete NestJS module wiring and working example applications.
**Estimated effort**: ~7 hours (Week 4)

### Tasks

- [ ] Complete `AuditLogModule.forRoot()` — wire all providers, register `APP_INTERCEPTOR`
- [ ] `AuditLogService` — expose `query()` and `verify()` as public API
- [ ] `examples/basic-nestjs/` — minimal NestJS app demonstrating:
  - `AuditLogModule.forRoot()` in `AppModule`
  - Three service methods with `@AuditLog` (create/update/delete)
  - `GET /audit` endpoint that calls `auditService.query()`
- [ ] `examples/verify-chain/` — script that:
  - Generates N audit entries via the service
  - Calls `auditService.verify()` → prints chain status
  - Mutates one raw entry in storage, calls `verify()` again → shows tampered index
- [ ] End-to-end test: spin up NestJS app, call decorated methods, verify stored entries

### Acceptance Criteria

- [ ] `examples/basic-nestjs/` starts with `pnpm start` and responds to `GET /audit`
- [ ] `examples/verify-chain/` prints `isValid: true` before mutation, `isValid: false` after
- [ ] `AuditLogModule` can be imported without any other module imports in the host app
- [ ] End-to-end test passes

---

## Milestone v0.1.0 — Public Release

**Goal**: Production-ready documentation, CI pipeline, and npm publish.
**Estimated effort**: ~4 hours (Week 5)

### Tasks

- [ ] `CHANGELOG.md` — initial entry for v0.1.0
- [ ] `SECURITY.md` — tamper-evidence vs. tamper-prevention distinction, known limits
- [ ] CI pipeline (`GitHub Actions`):
  - Lint (ESLint)
  - Type-check (`tsc --noEmit`)
  - Test (`pnpm test`)
  - Build (`pnpm build`)
  - Trigger on: push to `main`, pull request
- [ ] README final review — English version, limits section mandatory
- [ ] `npm publish --access public` (`@guardrail/audit@0.1.0`)

### Acceptance Criteria

- [ ] GitHub Actions CI passes on clean branch
- [ ] `npm pack` produces no unexpected files (`.npmignore` or `files` in `package.json`)
- [ ] README clearly states "tamper-evidence, NOT tamper-prevention"
- [ ] Package is published and `npm install @guardrail/audit` works from a fresh project

---

## Out-of-Scope Reference (Do Not Implement)

These items are explicitly deferred. If asked to implement them, refuse and redirect to the appropriate future milestone.

| Item | Planned milestone |
|---|---|
| TypeORM adapter | v0.2 |
| Prisma adapter | v0.3 |
| `@guardrail/audit-verify` CLI | v0.2 |
| `AuditLogModule.forRootAsync()` | v0.1.x patch |
| `@ResourceId()` parameter decorator | v0.2 |
| Append-only DB enforcement | v0.2 |
| GDPR/HIPAA compliance presets | v0.2 |
| Tombstone pattern | v0.2+ |
| External anchoring (Git/S3) | v0.3 |
| HMAC / salt | v0.3 |
| SHA-3 / Blake2 options | v0.3 |
| `maxCaptureSize` option | v0.2 backlog |
| Performance benchmark automation | v1.0 backlog |
