import { RequireTenant } from '../../src/decorators/require-tenant.decorator';
import { runWithTenant } from '../../src/context';
import { MissingTenantContextError } from '../../src/errors';

/**
 * @RequireTenant 데코레이터의 핵심 보호 동작 검증.
 *
 * 시나리오:
 *  - 컨텍스트 없으면 throw
 *  - 컨텍스트 있으면 정상 실행
 *  - 클래스 레벨 데코레이터가 모든 메서드를 자동 보호
 *  - @SystemAction이 붙은 메서드는 보호에서 제외
 */
describe('@RequireTenant', () => {
  // 테스트용 더미 서비스 클래스
  @RequireTenant()
  class StudentsService {
    async findAll() {
      return ['student-1', 'student-2'];
    }

    async findOne(id: string) {
      return { id };
    }
  }

  let service: StudentsService;

  beforeEach(() => {
    service = new StudentsService();
  });

  it('tenant 컨텍스트 없이 호출하면 MissingTenantContextError를 throw 해야 한다', async () => {
    await expect(service.findAll()).rejects.toBeInstanceOf(MissingTenantContextError);
  });

  it('runWithTenant 안에서 호출하면 정상 실행되어야 한다', async () => {
    await runWithTenant('academy-A', async () => {
      const result = await service.findAll();
      expect(result).toEqual(['student-1', 'student-2']);
    });
  });

  it('클래스 레벨 데코레이터가 모든 메서드에 적용되어야 한다', async () => {
    await expect(service.findOne('id-1')).rejects.toBeInstanceOf(MissingTenantContextError);
  });

  // TODO: @SystemAction 통합 테스트
  // TODO: allowSystem 옵션 동작 검증
  // TODO: strictMode: false 시 throw하지 않고 진행되는지 검증
});
