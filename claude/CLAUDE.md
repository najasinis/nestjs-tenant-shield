# @guardrail/audit — Claude Harness

## Project Identity

**Package**: `@guardrail/audit`
**Purpose**: A NestJS decorator library that provides tamper-evident audit logging via hash chains.
**Core differentiator**: Hash chain (SHA-256) that makes tampering detectable — the only such library in the NestJS ecosystem as of 2026-05.

**Authoritative documents** (always read before writing any code):
- [`docs/Audit_Log_PRD.md`](../docs/Audit_Log_PRD.md) — Product requirements, milestones, design principles
- [`docs/Guardrail_Audit_API_Spec.md`](../docs/Guardrail_Audit_API_Spec.md) — Public API surface and data contracts
- [`claude/ARCHITECTURE.md`](./ARCHITECTURE.md) — Component graph and module boundaries
- [`claude/IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — Milestone breakdown with acceptance criteria
- [`claude/DECISIONS.md`](./DECISIONS.md) — Architecture Decision Records (ADRs)

---

## Non-Negotiable Rules

### ⚠️ RULE 0 — Company Code Copyright Boundary (MUST READ FIRST)

**`@guardrail/audit` is a personal open-source project. It must remain free of any code owned by the employer (슈퍼러닝 / Superlearning).**

The following directories contain company-owned source code. They are identified by the keywords `eduspace` and `classday`:

```
/Users/admin/Project/eduspace               ← company property
/Users/admin/Project/classday-attendance-v2 ← company property
```

**Hard prohibitions — violation of any of these constitutes an IP/copyright conflict:**

1. **Do NOT copy any file, function, class, type, or snippet** from `eduspace` or `classday-attendance-v2` into this project.
2. **Do NOT read those files and then rewrite "similar" code** for this project — deriving code from company source still constitutes a derivative work.
3. **Do NOT use those files as a template or reference** when implementing any feature in `@guardrail/audit`.
4. **Do NOT import or depend on any package** that was created exclusively for or within those company projects.

**What you may do**:
- Reference publicly documented NestJS, TypeScript, and Node.js APIs.
- Reference the specs and docs **within this repository** (`docs/Audit_Log_PRD.md`, `docs/Guardrail_Audit_API_Spec.md`, `claude/`).
- Write all implementation from scratch using public documentation and general engineering knowledge.

**If you are uncertain whether a pattern comes from company code or public NestJS knowledge, choose the public documentation route and do not reference the company directories at all.**

---

### Rule 1 — Use This Repository's Own Specs as the Source of Truth

**Before writing any new code, check if a pattern, interface, or utility is already defined within this repository.**

- Read the PRD (`docs/Audit_Log_PRD.md`) and API spec (`docs/Guardrail_Audit_API_Spec.md`) before proposing or implementing anything.
- All interface shapes (`AuditLogEntry`, `AuditLogStorage`, `AuditLogFilter`, `AuditLogOptions`, `AuditLogModuleOptions`) are already defined in the API spec — copy them verbatim, do not invent variants.
- All design principles (Fail-Fast, Non-Blocking, Zero external dependencies) are specified in the PRD sections 4 and 16 — follow them exactly.
- Milestones and out-of-scope items are defined in PRD sections 11 and 13 — do not implement features beyond the current milestone's scope.

**Rationale**: The specs in this repo are the only legitimate reference for implementation. Company codebases are off-limits (see Rule 0 above).

### 2. Zero External Dependencies

The library's `dependencies` field in `package.json` must remain empty for v0.1.

- SHA-256: use Node.js built-in `crypto` module only.
- Canonical serialization: self-implement (~50 lines max), do not add `json-stable-stringify` or similar.
- Field masking: self-implement dot-notation traversal, do not add `lodash`.

Allowed `peerDependencies` (already in user's app, never bundled):
- `@nestjs/common ^10 || ^11`
- `@nestjs/core ^10 || ^11`
- `rxjs ^7`
- `reflect-metadata ^0.1.13 || ^0.2`

### 3. Scope Lock per Milestone

Never implement features from a future milestone while working on the current one.

| Milestone | Scope |
|---|---|
| v0.0.1 | Interfaces + module/decorator skeleton + build pipeline |
| v0.0.2 | `canonicalStringify`, `computeHash`, chain verifier |
| v0.0.3 | `AuditLogInterceptor`, `InMemoryAuditLogStorage` (write queue), `maskFields` |
| v0.0.4 | `AuditLogModule.forRoot()` wiring, global interceptor, demo apps |
| v0.1.0 | CI, CHANGELOG, SECURITY.md, npm publish |

Items **explicitly out of scope for v0.1**: TypeORM/Prisma adapters, Verify CLI, `forRootAsync`, `resourceId` auto-extraction, HMAC/salt, external anchoring, append-only enforcement.

### 4. Fail-Fast at Boot, Non-Blocking at Runtime

- Missing `action` or `resource` on `@AuditLog` → throw `Error` at decorator evaluation time (app boot), not at request time.
- Any logging failure at runtime (serialization error, storage write error) → `Logger.error()` only; never throw, never rollback business logic.

### 5. Tamper-Evidence Wording

The library provides **tamper-evidence** (detection), NOT **tamper-prevention**. Always use this distinction in comments, docs, and error messages. Never claim the library prevents DB admin modifications.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript 5.x | Decorator support, type safety |
| Framework | NestJS 10/11 | Target runtime; interceptor + module system |
| Build | tsup | CJS + ESM + `.d.ts` in one config |
| Package manager | pnpm | Consistent with superlearning monorepo conventions |
| Test runner | Jest | Standard NestJS ecosystem |
| Hash | Node.js `crypto` (SHA-256) | Built-in, NIST-approved, no extra dep |
| Node | >=18 | Required for stable `crypto.createHash` API |

---

## File Layout (target for v0.1)

```
@guardrail/audit/
├── src/
│   ├── index.ts                          # Public exports only
│   ├── audit-log.module.ts               # AuditLogModule.forRoot()
│   ├── audit-log.interceptor.ts          # AuditLogInterceptor (global)
│   ├── decorators/
│   │   └── audit-log.decorator.ts        # @AuditLog()
│   ├── storage/
│   │   ├── audit-log-storage.interface.ts
│   │   └── in-memory-audit-log.storage.ts
│   └── utils/
│       ├── canonical-stringify.util.ts   # Canonical serialization
│       ├── compute-hash.util.ts          # SHA-256 wrapper
│       └── mask-fields.util.ts           # Dot-notation field masking
├── test/
│   ├── unit/
│   │   ├── canonical-stringify.spec.ts
│   │   ├── compute-hash.spec.ts
│   │   └── mask-fields.spec.ts
│   └── integration/
│       ├── audit-log.interceptor.spec.ts
│       └── hash-chain-concurrency.spec.ts
├── examples/
│   ├── basic-nestjs/                     # Minimal working app
│   └── verify-chain/                     # Chain integrity demo
├── docs/
│   ├── Audit_Log_PRD.md                  # (existing)
│   └── Guardrail_Audit_API_Spec.md       # (existing)
├── claude/
│   ├── CLAUDE.md                         # (this file)
│   ├── ARCHITECTURE.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── DECISIONS.md
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── jest.config.ts
├── CHANGELOG.md
└── SECURITY.md
```

---

## Key Invariants to Preserve

1. **Hash chain is always sequential**: every `write()` call must complete (including hash computation) before the next one starts. The write queue pattern in `InMemoryAuditLogStorage` enforces this. Do not break this sequencing.

2. **`selfHash` excludes itself**: when computing `selfHash`, the entry object must have `selfHash` deleted/excluded before serialization. Otherwise it's a circular dependency.

3. **`maskFields` runs before hashing**: masked data is what gets hashed. The `[REDACTED]` string is part of the canonical entry.

4. **Genesis hash is the chain anchor**: the first entry's `prevHash` comes from `genesisHash` in module options, not from any stored entry.

5. **`@AuditLog` only attaches metadata**: all logging logic lives in the interceptor. The decorator is pure metadata — no side effects.
