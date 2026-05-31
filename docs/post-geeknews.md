# NestJS B2B SaaS 멀티테넌시 데이터 격리를 데코레이터 한 줄로 — nestjs-tenant-shield

> 긱뉴스 제출용 초안

---

## 한 줄 요약

NestJS B2B SaaS에서 cross-tenant 데이터 누출 사고를 데코레이터 한 줄로 차단하는 npm 라이브러리입니다.

---

## 문제

B2B SaaS 백엔드를 만들 때 가장 조용한 위험은 `WHERE tenantId = ?` 누락입니다.

서비스 메서드가 늘어날수록, 개발자가 바뀔수록, 급하게 짠 쿼리가 하나씩 생길수록 — 언제가는 Tenant A가 Tenant B의 데이터를 읽게 됩니다. 실수는 로직 버그가 아니라 "항상 해왔던 수작업을 한 번 빠뜨린 것"에서 납니다.

---

## 기존 방식 (수동)

```typescript
// 모든 메서드마다 이 작업을 반복해야 합니다
findAll() {
  const tenantId = this.ctx.getTenantId();
  return this.repo.find({ where: { tenantId } });
}
```

메서드가 10개면 10번, 새 개발자가 합류하면 온보딩 리스크 1개 추가.

---

## nestjs-tenant-shield 방식

```typescript
@Injectable()
@RequireTenant()           // 클래스 한 줄 — 모든 메서드 자동 보호
export class StudentsService {
  findAll() {
    return this.repo.find(); // WHERE tenantId = ? 자동 주입
  }
}
```

TypeORM Subscriber가 쿼리 실행 직전에 `WHERE tenantId = ?`를 주입합니다. 개발자가 직접 쓸 필요가 없습니다.

테넌트 헤더 없이 요청이 오면 메서드 본문 실행 전에 `MissingTenantContextError`를 던집니다.

---

## 설치 및 5분 시작

```bash
npm install nestjs-tenant-shield
```

```typescript
// app.module.ts
TenantShieldModule.forRoot({
  strategy: 'discriminator',
  tenantIdField: 'tenantId',
  tenantSource: 'header',
  headerName: 'x-tenant-id',
  strictMode: true,
})
```

```bash
# 테넌트 헤더 포함 — academy-A 데이터만 반환
curl -H "x-tenant-id: academy-A" http://localhost:3000/students

# 헤더 없음 — 즉시 차단
curl http://localhost:3000/students
# → 403 MissingTenantContextError
```

Prisma도 지원합니다: `createTenantAwarePrisma(new PrismaClient())`

---

## 솔직한 한계 (90% 규칙)

이 라이브러리는 애플리케이션 레이어 격리입니다. 완전한 보안 솔루션이 아닙니다.

| 케이스 | 보호 여부 |
|---|---|
| `repo.find()`, `repo.findOne()`, `repo.save()` | ✅ 자동 주입 |
| Prisma `findMany()`, `create()`, `update()` | ✅ 자동 주입 |
| `@Cacheable()` 캐시 키 | ✅ 테넌트 스코프 |
| Raw SQL (`query()` / `$queryRaw`) | ❌ 미보호 |
| JOIN으로 타 테넌트 참조 | ❌ 미보호 |
| DB 마이그레이션 | ❌ 미보호 |

나머지 10%는 v0.3에서 Postgres RLS로 DB 레이어 방어선을 추가할 예정입니다.

---

## 성능

측정값 (v0.2.1, Node.js v24.13.1, in-memory, 100,000회 반복):

- `@RequireTenant` 오버헤드: ~0.00069 ms/call
- 일반 요청 총 추가 오버헤드: < 1 ms

추정값이 아닌 실측값입니다. `npm run benchmark`로 로컬에서 재현 가능합니다.

---

## 링크

- GitHub: https://github.com/jinyeongjung/nestjs-tenant-shield
- npm: https://www.npmjs.com/package/nestjs-tenant-shield

피드백, 버그 리포트, 실제 도입 사례 모두 환영합니다. v0.3 Postgres RLS 개발은 커뮤니티 피드백에 따라 결정됩니다.
