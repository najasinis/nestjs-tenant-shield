import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { TENANT_SHIELD_OPTIONS } from '../constants';
import { TenantShieldOptions } from '../interfaces/tenant-shield-options.interface';
import { TenantResolver } from '../resolvers/tenant-resolver.interface';
import { createTenantResolver } from '../resolvers/resolver.factory';
import { tenantContextStorage } from '../context/tenant-context.storage';
import { MissingTenantContextError } from '../errors/missing-tenant-context.error';

/**
 * ─────────────────────────────────────────────────────────────
 * 모든 HTTP 요청의 진입점에서 동작하는 미들웨어.
 *
 * 역할:
 *  1) Resolver를 통해 요청에서 tenant ID 추출
 *  2) AsyncLocalStorage.run()으로 컨텍스트를 만들어 next() 호출
 *  3) 이후 컨트롤러/서비스/Subscriber 어디서든 getCurrentTenantId()로 조회 가능
 *
 * 이 미들웨어가 동작해야 비로소 라이브러리의 모든 기능이 켜집니다.
 * TenantShieldModule이 자동으로 모든 라우트('*')에 적용해 줍니다.
 * ─────────────────────────────────────────────────────────────
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  /**
   * forRoot에서 만든 resolver를 한 번만 생성해 두고 재사용.
   * (요청마다 새로 만들면 오버헤드)
   */
  private readonly resolver: TenantResolver;

  constructor(
    // TENANT_SHIELD_OPTIONS 토큰으로 forRoot 옵션 주입.
    @Inject(TENANT_SHIELD_OPTIONS)
    private readonly options: TenantShieldOptions,
  ) {
    // 부팅 시 옵션을 보고 적절한 resolver 인스턴스 생성.
    // 잘못된 설정이면 여기서 InvalidTenantSourceError가 던져져 앱 부팅 실패.
    this.resolver = createTenantResolver(options);
  }

  /**
   * Express 시그니처에 맞춘 미들웨어 함수.
   * NestJS는 내부적으로 Express/Fastify 어댑터로 변환해 호출.
   */
  use(req: unknown, _res: unknown, next: (err?: unknown) => void): void {
    // 1) 요청에서 tenant ID 추출 시도
    const tenantId = this.resolver.resolve(req);

    // 2) strict mode면 tenant 없을 때 즉시 차단
    //    (단, allowSystemActions가 켜져있으면 시스템 작업 가능성이 있으므로
    //     일단 통과시키고 메서드 단의 @RequireTenant가 최종 판단하도록 위임)
    const strictMode = this.options.strictMode !== false; // 기본 true
    if (!tenantId && strictMode && !this.options.allowSystemActions) {
      // 미들웨어 단에서 throw하면 NestJS Exception Filter가 처리.
      return next(
        new MissingTenantContextError(
          `요청에서 tenant ID를 추출하지 못했습니다. source=${this.options.tenantSource}`,
          this.options.tenantSource,
        ),
      );
    }

    // 3) AsyncLocalStorage.run()으로 컨텍스트 활성화.
    //    next() 호출이 이 콜백 안에서 일어나야, 이후 모든 비동기 체인이
    //    동일한 store를 공유합니다.
    tenantContextStorage.run({ tenantId, isSystemAction: false }, () => next());
  }
}
