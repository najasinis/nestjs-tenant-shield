# Prisma SaaS Example

`createTenantAwarePrisma`를 사용해 Prisma Client에 tenant 격리를 적용하는 실행 가능한 예제.

## 실행 방법

```bash
# 1. 의존성 설치
pnpm install

# 2. Prisma client 생성 + DB 마이그레이션
pnpm db:generate
pnpm db:migrate   # 마이그레이션 이름: init

# 3. 서버 기동
pnpm start
```

## 테스트

```bash
# tenant A 학생 생성
curl -X POST http://localhost:3001/students \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: academy-A" \
  -d '{"name":"김민수","grade":90}'

# tenant A 목록 조회 (academy-A 데이터만 반환)
curl -H "x-tenant-id: academy-A" http://localhost:3001/students

# tenant 헤더 없이 요청 → MissingTenantContextError
curl http://localhost:3001/students
```

## 사용 패턴

```typescript
import { PrismaClient } from '@prisma/client';
import { createTenantAwarePrisma } from 'nestjs-tenant-shield';

const prisma = createTenantAwarePrisma(new PrismaClient(), {
  tenantIdField: 'tenantId',
  strictMode: true,
});

// 이후 prisma.student.findMany()는 자동으로 WHERE tenantId = <현재 tenant>
```

## 주의사항

- `findUnique` / `findUniqueOrThrow`는 unique 제약으로 WHERE 직접 주입이 불가. 쿼리 실행 후 결과의 `tenantId`를 검증해 cross-tenant 접근을 차단한다.
- Raw `$queryRaw` / `$executeRaw`는 자동 보호 대상이 아님. `getCurrentTenantId()`로 수동 검증 필요.
