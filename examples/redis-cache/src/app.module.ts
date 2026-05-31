import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { TenantShieldModule } from 'nestjs-tenant-shield';
import { RedisCacheAdapter } from './redis-cache.adapter';
import { StudentsService } from './students/students.service';
import { StudentsController } from './students/students.controller';

@Module({
  imports: [
    TenantShieldModule.forRoot({
      strategy: 'discriminator',
      tenantIdField: 'tenantId',
      tenantSource: 'header',
      headerName: 'x-tenant-id',
      strictMode: true,
      cache: {
        useFactory: () =>
          new RedisCacheAdapter(
            new Redis({
              host: process.env.REDIS_HOST ?? 'localhost',
              port: Number(process.env.REDIS_PORT ?? 6379),
            }),
          ),
      },
    }),
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class AppModule {}
