# Architecture Decision Records — @guardrail/audit

> Each ADR captures a significant technical choice: what was decided, why, and what alternatives were rejected.
> New decisions should be added here before implementation begins.

---

## ADR-001: SHA-256 via Node.js Built-in `crypto`

**Status**: Accepted
**Date**: 2026-05-05

**Decision**: Use `node:crypto` `createHash('sha256')` for all hashing. No external hash library.

**Rationale**:
- NIST-approved, collision-resistant, industry standard for tamper-evidence use cases.
- Built-in to Node.js ≥18 — no bundle size cost, no supply chain risk.
- MD5 and SHA-1 are rejected due to known collision vulnerabilities.
- SHA-3 and Blake2 considered for v0.3 as options, but SHA-256 is sufficient and better known.

**Rejected alternatives**:
- `js-sha256` npm package — adds a dependency with no functional benefit over built-in.
- `crypto-js` — same reason, plus heavier bundle.

---

## ADR-002: Self-Implemented Canonical Serialization

**Status**: Accepted
**Date**: 2026-05-05

**Decision**: Implement `canonicalStringify` in ~50 lines internally. No external library.

**Rationale**:
- The invariant (sorted keys + stable output) is simple enough to self-implement with full test coverage.
- External libraries (`json-stable-stringify`, `canonical-json`) introduce dependencies and may drift in behavior between versions, which would silently break stored hash chains on upgrade.
- Self-implementation gives full control over edge case handling (circular refs, `Date`, `undefined`).

**Rejected alternatives**:
- `json-stable-stringify` — dependency, version drift risk.
- `JSON.stringify` with `replacer` for key sorting — not recursive by default, error-prone.

---

## ADR-003: Write Queue for In-Memory Concurrency

**Status**: Accepted
**Date**: 2026-05-05

**Decision**: Serialize all storage writes through a `Promise` chain (write queue).

**Rationale**:
- JavaScript is single-threaded, but `async/await` yields at every `await` point. Two concurrent requests can both read `getLast()` before either writes, producing a forked chain.
- A Promise chain (`this.writeQueue = this.writeQueue.then(...)`) guarantees each write sees the previous write's output before starting its own hash computation.
- This is the minimal, dependency-free solution for v0.1 in-memory storage.

**v0.2 note**: RDBMS adapters will use `SELECT FOR UPDATE` or advisory locks instead, since Promise chaining is per-process and breaks in multi-instance deployments.

**Rejected alternatives**:
- `async-mutex` npm package — adds a dependency; Promise chaining is equivalent for single-process use.
- Optimistic concurrency with retry — more complex, no benefit for in-memory single-process.

---

## ADR-004: Zero Runtime Dependencies

**Status**: Accepted
**Date**: 2026-05-05

**Decision**: The published `@guardrail/audit` package has an empty `dependencies` field.

**Rationale**:
- Library consumers should not inherit transitive dependencies from a logging utility.
- All required functionality fits within Node.js built-ins and NestJS peer dependencies.
- Reduces supply chain attack surface (audit libraries are security-sensitive).

**peerDependencies** (already present in host app, not bundled):
- `@nestjs/common ^10 || ^11`
- `@nestjs/core ^10 || ^11`
- `rxjs ^7`
- `reflect-metadata ^0.1.13 || ^0.2`

---

## ADR-005: Storage Computes Hash, Not Interceptor

**Status**: Accepted
**Date**: 2026-05-05

**Decision**: The `AuditLogStorage.write()` method is responsible for computing `prevHash` and `selfHash`, not `AuditLogInterceptor`.

**Rationale**:
- Hash chain correctness requires reading the last stored entry and computing the new hash **atomically** within the same serialized operation.
- If the interceptor computed the hash before calling `write()`, a race window would exist between the interceptor reading `getLast()` and the storage appending the new entry.
- Moving hash computation into the storage's write queue collapses this window to zero.

**Consequence**: `AuditLogStorage.write()` receives a `RawEntry` (without hash fields) and returns only after hash fields are populated and the entry is appended.

---

## ADR-006: Fail-Fast Validation at Decorator Evaluation

**Status**: Accepted
**Date**: 2026-05-05

**Decision**: Throw `Error` immediately when `@AuditLog({ action: '', resource: 'x' })` is evaluated (app boot), not at request time.

**Rationale**:
- Configuration errors discovered at request time mean: (a) the app shipped broken, (b) the error only surfaces when that code path is hit in production.
- Decorator evaluation happens synchronously during module initialization, so boot-time throws are caught by NestJS startup and prevent the app from starting — the earliest possible feedback loop.
- Consistent with NestJS Fail-Fast philosophy (e.g., required `ConfigService` values).

---

## ADR-007: Non-Blocking Logging at Runtime

**Status**: Accepted
**Date**: 2026-05-05

**Decision**: If `storage.write()` fails, log the error and continue. Never throw from the interceptor after the business method succeeds.

**Rationale**:
- Audit logging is an observability concern, not a business transaction concern.
- A storage failure should never degrade user-facing functionality.
- The alternative (rolling back the business transaction on log failure) would couple audit infrastructure to business correctness — unacceptable for a library.

**Limitation acknowledged**: In the rare case both the business operation and the audit write fail simultaneously, the lost log entry may be undetectable (it was never written). This is a known, documented trade-off.

---

## ADR-008: `selfHash` Field Excluded from Its Own Hash Input

**Status**: Accepted
**Date**: 2026-05-05

**Decision**: When computing `selfHash`, the entry object must be serialized with the `selfHash` field deleted.

**Rationale**:
- `selfHash = hash(entry)` where `entry` contains `selfHash` is circular — you cannot compute a value that includes itself.
- Standard approach (used by git commits, blockchain, etc.): compute hash over all fields except the hash field itself.

**Implementation note**: Spread the entry object, delete `selfHash`, then serialize and hash. The `prevHash` field IS included in the hash input.

---

## ADR-009: `@AuditLog` Attaches Metadata Only — No Proxy/Wrapping

**Status**: Accepted
**Date**: 2026-05-05

**Decision**: The `@AuditLog` decorator calls only `Reflect.defineMetadata(...)` and does nothing else. All interception logic lives exclusively in `AuditLogInterceptor`.

**Rationale**:
- Decorator-based method wrapping (replacing the original descriptor) creates multiple issues: loss of `this` context, incompatibility with NestJS DI, difficulty testing.
- NestJS's `APP_INTERCEPTOR` + `ExecutionContext` pattern is the idiomatic and framework-supported approach for cross-cutting concerns.
- Clean separation: decorator = "what to log", interceptor = "how to log".

---

## ADR-010: MIT License

**Status**: Accepted
**Date**: 2026-05-05

**Decision**: Publish under MIT license.

**Rationale**:
- Maximum adoption: MIT is the de facto standard for NestJS ecosystem libraries.
- No copyleft restrictions that would deter commercial use.
- Consistent with NestJS itself and most of its ecosystem.
