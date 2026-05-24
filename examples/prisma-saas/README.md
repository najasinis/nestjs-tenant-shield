# Prisma SaaS 예제

`createTenantAwarePrisma`를 사용해 Prisma Client에 tenant 격리를 적용하는 최소 예제.

## 사용 패턴

```typescript
import { PrismaClient } from '@prisma/client';
import { createTenantAwarePrisma } from 'nestjs-tenant-shield';

// 앱 시작 시 1회
const prisma = createTenantAwarePrisma(new PrismaClient(), {
  tenantIdField: 'tenantId',
  strictMode: true,
});

// 이후 prisma.student.findMany()는 자동으로 WHERE tenantId = <현재 tenant>
```

## NestJS 모듈과 통합

```typescript
// app.module.ts
@Module({
  imports: [
    TenantShieldModule.forRoot({
      strategy: 'discriminator',
      tenantIdField: 'tenantId',
      tenantSource: 'header',
      headerName: 'x-tenant-id',
    }),
  ],
  providers: [
    {
      provide: 'PRISMA',
      useFactory: () =>
        createTenantAwarePrisma(new PrismaClient(), {
          tenantIdField: 'tenantId',
        }),
    },
    StudentsService,
  ],
})
export class AppModule {}

// students.service.ts
@Injectable()
@RequireTenant()
export class StudentsService {
  constructor(@Inject('PRISMA') private readonly prisma: any) {}

  async findAll() {
    // WHERE tenantId = <현재 tenant> 자동 주입
    return this.prisma.student.findMany();
  }

  async findOne(id: number) {
    // findUnique는 실행 후 결과 tenantId를 사후 검증
    return this.prisma.student.findUnique({ where: { id } });
  }

  async create(data: { name: string; grade: number }) {
    // data.tenantId 자동 주입
    return this.prisma.student.create({ data });
  }
}
```

## Prisma Schema 예시

```prisma
model Student {
  id       Int    @id @default(autoincrement())
  tenantId String          // ← 이 필드가 있으면 자동 격리 적용
  name     String
  grade    Int

  @@index([tenantId])
}
```

## 주의사항

- `findUnique` / `findUniqueOrThrow`는 unique 제약으로 WHERE 직접 주입이 불가.
  → 쿼리 실행 후 결과의 `tenantId`를 검증해 cross-tenant 접근을 차단한다.
- Raw `$queryRaw` / `$executeRaw`는 자동 보호 대상이 아님.
  → `getCurrentTenantId()`로 수동 검증 필요.
