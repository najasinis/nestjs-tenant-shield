import { Injectable } from '@nestjs/common';
import { RequireTenant, SystemAction, runWithTenant } from '../../../../src';
import { StudentsService } from '../students/students.service';

/**
 * ─────────────────────────────────────────────────────────────
 * MaintenanceService — "모든 tenant를 가로지르는" 작업 패턴.
 *
 * @RequireTenant() 클래스에 cron 같은 시스템 작업을 같이 두고 싶을 때
 * @SystemAction()으로 명시적으로 우회 표시합니다. 그래야 라이브러리가
 * "이건 의도된 보호 우회"임을 알아채고 throw하지 않습니다.
 *
 * 그리고 cron 내부에서 각 tenant의 데이터를 만질 때는 runWithTenant()로
 * 명시적으로 컨텍스트를 깔아 일반 보호가 정상 동작하게 만듭니다.
 *
 * ─────────────────────────────────────────────────────────────
 */
@Injectable()
@RequireTenant()
export class MaintenanceService {
  constructor(private readonly students: StudentsService) {}

  /**
   * 일반 메서드 — 일반 요청 컨텍스트에서 호출되어야 함.
   */
  async cleanupForCurrentTenant() {
    // tenant_id는 자동 적용.
    // 만료된 학생 데이터를 삭제하는 로직 등.
    return this.students.findAll(); // 예시
  }

  /**
   * 시스템 작업 — cron, 마이그레이션, 모니터링.
   * @SystemAction()이 없으면 @RequireTenant() 클래스 레벨이 throw.
   *
   * 패턴:
   *  1) 시스템 입장
   *  2) 모든 tenant 목록 조회
   *  3) 각 tenant마다 runWithTenant()로 일반 보호를 켜고 작업
   */
  @SystemAction()
  async runDailyCleanupForAllTenants(): Promise<void> {
    // 실제 구현 시 tenant registry에서 목록을 가져옴.
    const allTenantIds: string[] = ['academy-A', 'academy-B', 'academy-C'];

    for (const tenantId of allTenantIds) {
      // 각 tenant 안으로 들어가 안전한 컨텍스트를 만들고 정리 작업 수행.
      await runWithTenant(tenantId, async () => {
        await this.cleanupForCurrentTenant();
      });
    }
  }
}
