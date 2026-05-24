# Security Policy — nestjs-tenant-shield

## 지원 버전

| 버전  | 보안 지원           |
|-------|---------------------|
| 0.2.x | ✅ 완전 지원         |
| 0.1.x | ✅ 보안 패치만       |
| < 0.1 | ❌ 미지원            |

---

## 자동 보호 범위

nestjs-tenant-shield는 **"흔한 cross-tenant 사고의 90%를 자동 차단"** 하는 도구입니다.
나머지 10%는 아래 한계를 인지하고 수동 처리해야 합니다.

### ✅ 자동 보호되는 API

| 어댑터 | 보호 방식 | 대상 API |
|--------|-----------|----------|
| TypeORM | WHERE tenantId 자동 주입 | `Repository.find / findOne / findBy / findOneBy / count / save` |
| TypeORM | andWhere 자동 주입 | `SelectQueryBuilder.getMany / getOne / getManyAndCount / getCount / getRawMany / getRawOne` |
| TypeORM | WHERE tenantId 자동 주입 | `UpdateQueryBuilder.execute / DeleteQueryBuilder.execute` |
| TypeORM | afterLoad 사후 검증 | Entity 로드 후 tenantId 불일치 시 `CrossTenantAccessError` |
| Prisma | WHERE tenantId 자동 주입 | `findMany / findFirst / findFirstOrThrow / count / aggregate / groupBy` |
| Prisma | data.tenantId 자동 주입 | `create / createMany` |
| Prisma | WHERE tenantId 자동 주입 | `update / updateMany / delete / deleteMany / upsert` |
| Prisma | 결과 사후 검증 | `findUnique / findUniqueOrThrow` — unique 제약으로 WHERE 직접 주입 불가 |
| Cache | tenantId prefix 자동 추가 | `@Cacheable()` 캐시 키 |
| BullMQ | ALS 컨텍스트 복원 | `@TenantContext()` — job.data.tenantId → getCurrentTenantId() |

### ⚠️ 자동 보호 밖 (수동 처리 필요)

| # | 케이스 | 완화책 |
|---|--------|--------|
| 1 | TypeORM raw SQL (`repo.query()`, `queryRunner.query()`) | `withTenantWhere()` 헬퍼 또는 수동 WHERE 명시 |
| 2 | TypeORM QueryBuilder 복잡한 JOIN | JOIN ON 절에 `tenant_id` 명시 |
| 3 | TypeORM QueryBuilder subquery | 서브쿼리 내부에 `tenant_id` 조건 명시 |
| 4 | Prisma `$queryRaw` / `$executeRaw` | `getCurrentTenantId()`로 수동 검증 |
| 5 | TypeORM Migration / CLI | 라이브러리 범위 밖 — 별도 검증 필요 |
| 6 | EventEmitter / setTimeout 컨텍스트 끊김 | 진입 시점 tenantId 캡처 후 `runWithTenant()` 재진입 |
| 7 | 멀티 DataSource 트랜잭션 | 수동 검증 필요 |

### ❌ 이 라이브러리가 담당하지 않는 것

- **인증(Authentication)**: tenant ID 값의 진위 검증 — JWT 미들웨어 등 별도 레이어
- **인가(Authorization)**: tenant 내부의 role/permission 체크 — 별도 구현 필요
- **네트워크/인프라 격리**: DB 접근 권한 최소화, VPC 분리 — 인프라 담당

---

## 취약점 제보

보안 취약점을 발견하셨다면:

1. **공개 GitHub Issue 생성 금지** (악용 가능성 차단)
2. **이메일**: a01084861839@gmail.com
3. 제보 내용에 포함해주세요:
   - 재현 코드 (최소 예시)
   - 영향 범위 (어떤 API, 어느 버전)
   - 심각도 판단 근거
4. **응답 목표**: 72시간 내 확인, 14일 내 패치

---

## Defense in Depth 권장

nestjs-tenant-shield 단독으로 완전한 보안은 보장되지 않습니다.
함께 적용을 강권합니다:

- **DB 레벨 접근 권한 최소화** — tenant별 DB 사용자 또는 Postgres Row-Level Security
- **Postgres RLS** — v0.3 통합 예정 ([PRD §3](docs/tenant-shield-PRD.md))
- **인증 레이어** — JWT 서명 검증으로 tenant ID 변조 방지
- **정기 침투 테스트** — cross-tenant 시나리오 중심

---

> nestjs-tenant-shield는 "다층 방어(defense in depth)의 한 층"입니다.
> 만능 보안이 아닙니다.
