import { Module } from '@nestjs/common';
import { TenantShieldModule } from 'nestjs-tenant-shield';
import { createTenantAwarePrisma } from 'nestjs-tenant-shield';
import { PrismaClient } from '@prisma/client';
import { StudentsService } from './students/students.service';
import { StudentsController } from './students/students.controller';

const prismaClient = new PrismaClient();

@Module({
  imports: [
    TenantShieldModule.forRoot({
      strategy: 'discriminator',
      tenantIdField: 'tenantId',
      tenantSource: 'header',
      headerName: 'x-tenant-id',
      strictMode: true,
    }),
  ],
  controllers: [StudentsController],
  providers: [
    {
      provide: 'PRISMA',
      useValue: createTenantAwarePrisma(prismaClient, { tenantIdField: 'tenantId' }),
    },
    StudentsService,
  ],
})
export class AppModule {}
