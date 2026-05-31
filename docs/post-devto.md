# Automatic multi-tenant data isolation in NestJS with one decorator

**Tags**: nestjs, typescript, saas, multitenancy

---

## The Problem: Cross-Tenant Data Leaks in B2B SaaS

If you're building a B2B SaaS backend, every service method that touches the database carries a silent risk. One missing `WHERE tenantId = ?` clause and Tenant A can read Tenant B's data.

This is not a theoretical problem. In 2023, a misconfigured query in a major SaaS product exposed customer data across accounts during a high-traffic window. The root cause was a single missing filter in one code path that wasn't caught in tests.

The standard defense is manual discipline: every developer, on every query, in every service, every time. That scales poorly. As the codebase grows, it becomes a question of *when* a slip happens, not *if*.

---

## The Usual Solution: Manual `tenantId` Everywhere

Here's what a typical multi-tenant NestJS service looks like today:

```typescript
// ❌ Manual approach — every method must remember to filter
@Injectable()
export class StudentsService {
  constructor(
    private readonly repo: Repository<Student>,
    private readonly ctx: TenantContextService,
  ) {}

  findAll() {
    const tenantId = this.ctx.getTenantId(); // never forget this
    return this.repo.find({ where: { tenantId } });
  }

  findOne(id: number) {
    const tenantId = this.ctx.getTenantId(); // again
    return this.repo.findOne({ where: { id, tenantId } });
  }

  async create(data: CreateStudentDto) {
    const tenantId = this.ctx.getTenantId(); // and again
    const student = this.repo.create({ ...data, tenantId });
    return this.repo.save(student);
  }
}
```

Every method is a new opportunity to forget. Add a new developer, add a time-pressured feature, add a complex query — the surface grows.

---

## The Fix: One Decorator at the Class Level

`nestjs-tenant-shield` moves the enforcement to the infrastructure layer. The `WHERE tenantId = ?` is injected by a TypeORM Subscriber before every query — you never write it yourself.

```typescript
// ✅ With nestjs-tenant-shield
import { RequireTenant } from 'nestjs-tenant-shield';

@Injectable()
@RequireTenant()                   // ← one line. every method is now protected.
export class StudentsService {
  constructor(private readonly repo: Repository<Student>) {}

  findAll() {
    return this.repo.find();       // WHERE tenantId = ? injected automatically
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } }); // tenantId added automatically
  }

  async create(data: CreateStudentDto) {
    return this.repo.save(this.repo.create(data)); // tenantId stamped automatically
  }
}
```

If a request arrives without a tenant header, `MissingTenantContextError` is thrown before the method body executes.

---

## 5-Minute Quick Start

### Install

```bash
npm install nestjs-tenant-shield
```

### Register the module

```typescript
// app.module.ts
import { TenantShieldModule } from 'nestjs-tenant-shield';

@Module({
  imports: [
    TypeOrmModule.forRoot({ ... }),
    TenantShieldModule.forRoot({
      strategy: 'discriminator',   // single table with tenantId column
      tenantIdField: 'tenantId',
      tenantSource: 'header',
      headerName: 'x-tenant-id',
      strictMode: true,
    }),
  ],
})
export class AppModule {}
```

### Protect a service

```typescript
@Injectable()
@RequireTenant()
export class StudentsService {
  constructor(private repo: Repository<Student>) {}

  findAll() { return this.repo.find(); }
}
```

### Test it

```bash
# Tenant-scoped request — returns data for academy-A only
curl -H "x-tenant-id: academy-A" http://localhost:3000/students
# → 200 [ { id: 1, tenantId: "academy-A", name: "Alice" }, ... ]

# No tenant header — blocked immediately
curl http://localhost:3000/students
# → 403 { "message": "MissingTenantContextError" }
```

Prisma users: use `createTenantAwarePrisma(new PrismaClient())` — same auto-injection via `$extends`.

---

## Honest Limits (The 90% Rule)

This library protects **application-layer queries**. It is not a complete security solution.

| Scenario | Protected? |
|---|---|
| `repo.find()`, `repo.findOne()`, `repo.save()` | ✅ Auto-injected |
| Prisma `findMany()`, `create()`, `update()` | ✅ Auto-injected |
| `@Cacheable()` cache keys | ✅ Tenant-scoped |
| TypeORM `QueryBuilder` | ✅ Subscriber fires |
| Raw SQL via `query()` / `$queryRaw` | ❌ Not protected |
| SQL JOINs that reference other tenants | ❌ Not protected |
| Database migrations | ❌ Not protected |
| Background jobs without tenant context | ⚠️ Use `withTenantPayload()` |

**Application-layer isolation, not a complete security solution.** For defense-in-depth, pair with Postgres RLS at the DB layer (v0.3 roadmap).

---

## Performance

Overhead is measured, not estimated (v0.2.1, Node.js v24.13.1, in-memory, 100,000 iterations):

| Component | Overhead |
|---|---|
| `@RequireTenant` check | ~0.00069 ms/call |
| TypeORM Subscriber `beforeQuery` | measured inline |
| `AsyncLocalStorage` access | sub-millisecond |

Typical request adds < 1 ms total. Run `npm run benchmark` locally to reproduce.

---

## What's Next: v0.3 Postgres RLS

The library currently blocks ~90% of accidental leaks at the application layer. v0.3 will add a second line of defense at the DB layer: `SET LOCAL app.tenant_id = ?` before each query, paired with Postgres Row-Level Security policies. Even if application-layer isolation is bypassed (raw SQL, ORM bugs), the DB will re-enforce the boundary.

**v0.3 is gated on community feedback.** If this solves a real problem for you, open an issue or leave a comment — it directly influences whether v0.3 gets built.

---

## Links

- **GitHub**: https://github.com/jinyeongjung/nestjs-tenant-shield
- **npm**: https://www.npmjs.com/package/nestjs-tenant-shield
- **Examples**: `examples/academy-saas/` (TypeORM), `examples/prisma-saas/` (Prisma), `examples/queue-bullmq/` (BullMQ background jobs)

Found a bug or edge case? Open an issue — honest feedback shapes the roadmap.
