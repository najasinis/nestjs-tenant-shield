import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantShieldModule } from '../../../src';
import { Student } from './students/student.entity';
import { StudentsService } from './students/students.service';
import { StudentsController } from './students/students.controller';
import { MaintenanceService } from './maintenance/maintenance.service';

/**
 * ─────────────────────────────────────────────────────────────
 * 학원 관리 SaaS의 루트 모듈 예시.
 *
 * 멀티테넌시 셋업은 단 한 곳, forRoot 호출 한 번으로 끝납니다.
 * 이후 학생 / 클래스 / 결제 / 통계 등 어느 도메인 모듈을 추가해도
 * 같은 보호가 자동 적용됩니다.
 * ─────────────────────────────────────────────────────────────
 */
@Module({
  imports: [
    // TypeORM 자체 셋업 (예시용 SQLite — 실제 서비스에서는 Postgres 등으로 교체)
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'academy.sqlite',
      entities: [Student],
      synchronize: true, // ⚠️ 데모용. 프로덕션에서는 false + 마이그레이션 사용.
    }),
    TypeOrmModule.forFeature([Student]),

    // ─────────────────────────────────────────────
    // 멀티테넌시 보호 셋업 — 이 줄이 라이브러리의 전부.
    // ─────────────────────────────────────────────
    TenantShieldModule.forRoot({
      // 같은 테이블 + tenant_id 컬럼으로 구분.
      strategy: 'discriminator',

      // entity의 어떤 컬럼이 tenant ID인지.
      tenantIdField: 'tenantId',

      // HTTP 헤더에서 tenant 식별. 인증 미들웨어가 헤더를 검증하는 전제.
      tenantSource: 'header',
      headerName: 'x-tenant-id',

      // 모르는 tenant 또는 누락 요청은 즉시 차단.
      strictMode: true,

      // 시스템 작업(cron 등) 허용. 켜더라도 @SystemAction 명시 필요.
      allowSystemActions: true,

      // 보호 대상 entity 화이트리스트 (선택 — 미지정 시 자동 감지).
      entities: [Student],
    }),
  ],
  controllers: [StudentsController],
  providers: [StudentsService, MaintenanceService],
})
export class AppModule {}
