# Troubleshooting / 트러블슈팅

Common issues and solutions. / 자주 발생하는 문제와 해결책.

---

## `MissingTenantContextError` on every request

**Symptom**: Every API call throws `MissingTenantContextError` even after setting up the module.

**Checklist**:
1. Is `TenantContextMiddleware` applied globally? Verify `TenantShieldModule.forRoot()` is in `AppModule.imports`.
2. Does your `tenantSource` match where your app puts the tenant ID?
   - `'header'`: Client must send `X-Tenant-Id: <id>` (or your custom `headerName`)
   - `'jwt'`: `request.user.tenant_id` (or your `jwtClaim`) must be set by your auth guard
   - `'subdomain'`: Your domain must match the `subdomainPattern`
3. Are you in a test? Wrap with `runWithTenant('my-tenant', async () => { ... })`.

---

## `MissingTenantContextError` in tests

**Symptom**: Tests fail with missing tenant context even though the service method looks fine.

**Fix**:
```typescript
import { runWithTenant } from 'nestjs-tenant-shield/testing';

it('should find students', async () => {
  await runWithTenant('academy-A', async () => {
    const result = await studentsService.findAll();
    expect(result).toHaveLength(2);
  });
});
```

---

## TypeORM queries not getting `WHERE tenantId = ?`

**Symptom**: Queries return all rows regardless of tenant.

**Checklist**:
1. Does your entity have the `tenantIdField` column?
   ```typescript
   @Entity()
   export class Student {
     @Column()
     tenantId: string; // must match options.tenantIdField
   }
   ```
2. Is `TenantSubscriber` auto-registered? Look for the log:
   `TenantSubscriber가 DataSource에 자동 등록되었습니다.`
   If missing, ensure `TenantShieldModule.forRoot()` is imported AFTER `TypeOrmModule.forRoot()`.
3. Are you using **Raw SQL** (`repo.query()`)?
   Raw SQL bypasses all hooks. Use `withTenantWhere()` helper:
   ```typescript
   import { withTenantWhere } from 'nestjs-tenant-shield';
   const sql = `SELECT * FROM student ${withTenantWhere('tenant_id', tenantId)}`;
   ```

---

## `CrossTenantAccessError` thrown unexpectedly

**Symptom**: `CrossTenantAccessError` thrown on data you expect to belong to the current tenant.

**Likely cause**: The entity's `tenantIdField` column has a different name than `options.tenantIdField`.

**Fix**: Make sure `TenantShieldModule.forRoot({ tenantIdField: 'tenantId' })` matches your entity column name exactly.

---

## `@SystemAction` + `@RequireTenant` not working

**Symptom**: Even with `allowSystemActions: true`, calling the decorated method throws `MissingTenantContextError`.

**Cause**: Decorator order. TypeScript applies decorators bottom-up, so:

```typescript
// Correct: @RequireTenant above, @SystemAction below
@RequireTenant()
@SystemAction()
async dailyCron() { ... }

// Wrong: reversed order — @SystemAction metadata is invisible to @RequireTenant
@SystemAction()
@RequireTenant()
async dailyCron() { ... }
```

See `docs/critical-notes.md §1.3` for full explanation.

---

## `forRootAsync` not injecting cache

**Symptom**: `@Cacheable` cache misses despite `forRootAsync` configuration.

**Cause**: `forRootAsync` cache factory's `inject` tokens only support tokens resolvable at the `forRootAsync` level.

**Workaround**: Build the cache instance outside and pass via `useValue`:
```typescript
TenantShieldModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    strategy: 'discriminator',
    tenantIdField: 'tenantId',
    tenantSource: 'header',
    cache: { useValue: new RedisCacheAdapter(config.get('REDIS_URL')) },
  }),
  inject: [ConfigService],
})
```

---

## AsyncLocalStorage context lost in EventEmitter / setTimeout

**Symptom**: `getCurrentTenantId()` returns `null` inside an EventEmitter callback or `setTimeout`.

**Cause**: Some Node.js APIs (EventEmitter, some legacy callbacks) don't propagate AsyncLocalStorage context.

**Fix**: Capture the tenant ID before the async boundary and re-enter with `runWithTenant`:
```typescript
const tenantId = getCurrentTenantId();
eventEmitter.on('data', () => {
  runWithTenant(tenantId!, async () => {
    await processData();
  });
});
```

---

## Performance: how much overhead does this add?

Per the PRD target (< 1ms total overhead per typical request):
- AsyncLocalStorage access: < 0.1ms
- `@RequireTenant` decorator check: < 0.5ms
- TypeORM Subscriber WHERE injection: < 0.5ms

Run `npm run demo` and benchmark with `autocannon` or `k6` against your specific use case.

---

## Still stuck?

Open a [GitHub Discussion](https://github.com/jinyeongjung/nestjs-tenant-shield/discussions) with:
1. Your `forRoot()` config (sensitive values redacted)
2. The full error stack trace
3. Your entity definition
