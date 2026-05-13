import {
  DynamicModule,
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  Provider,
} from '@nestjs/common';
import {
  TenantShieldAsyncOptions,
  TenantShieldOptions,
} from './interfaces/tenant-shield-options.interface';
import { TENANT_SHIELD_CACHE, TENANT_SHIELD_OPTIONS } from './constants';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';
import { InMemoryTenantAwareCacheService } from './cache/cache.service';
import { TenantSubscriber } from './typeorm/tenant.subscriber';

/**
 * ─────────────────────────────────────────────────────────────
 * TenantShieldModule — 사용자가 AppModule에서 import 하는 메인 모듈.
 *
 *   @Module({
 *     imports: [
 *       TenantShieldModule.forRoot({ ... }),
 *     ],
 *   })
 *   export class AppModule {}
 *
 * 역할:
 *  1) forRoot 옵션을 DI 컨테이너에 등록
 *  2) TenantContextMiddleware를 모든 라우트에 자동 적용
 *  3) TypeORM Subscriber 인스턴스 등록 (전역)
 *  4) 캐시 서비스 인스턴스 제공 (사용자 교체 가능)
 *
 * @Global 어노테이션:
 *  이 모듈의 providers를 사용자가 별도로 import 하지 않아도
 *  앱 전역에서 주입받을 수 있게 합니다. 라이브러리의 "안전망"
 *  성격상 어디서든 동작해야 하므로 전역이 맞습니다.
 * ─────────────────────────────────────────────────────────────
 */
@Global()
@Module({})
export class TenantShieldModule implements NestModule {
  /**
   * 동기 옵션으로 모듈 초기화.
   * 가장 흔한 사용 방식.
   */
  static forRoot(options: TenantShieldOptions): DynamicModule {
    return {
      module: TenantShieldModule,
      providers: [
        // 옵션을 토큰으로 등록 → 다른 곳에서 @Inject로 가져갈 수 있게.
        {
          provide: TENANT_SHIELD_OPTIONS,
          useValue: options,
        },
        // TypeORM Subscriber를 옵션과 함께 인스턴스화.
        {
          provide: TenantSubscriber,
          useFactory: (opts: TenantShieldOptions) => new TenantSubscriber(opts),
          inject: [TENANT_SHIELD_OPTIONS],
        },
        // 캐시 서비스 (기본: in-memory).
        // 사용자가 Redis로 바꾸려면 override provider 등록.
        {
          provide: TENANT_SHIELD_CACHE,
          useClass: InMemoryTenantAwareCacheService,
        },
        // 미들웨어 자체도 NestJS provider로 등록해 DI 동작 확보.
        TenantContextMiddleware,
      ],
      exports: [
        TENANT_SHIELD_OPTIONS,
        TENANT_SHIELD_CACHE,
        TenantSubscriber,
      ],
    };
  }

  /**
   * 비동기 옵션 (v0.1.x 패치에서 활성화 예정).
   * ConfigService 등 다른 모듈의 값을 사용해 옵션을 만들고 싶을 때.
   */
  static forRootAsync(options: TenantShieldAsyncOptions): DynamicModule {
    const asyncProvider: Provider = {
      provide: TENANT_SHIELD_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: TenantShieldModule,
      imports: options.imports ?? [],
      providers: [
        asyncProvider,
        {
          provide: TenantSubscriber,
          useFactory: (opts: TenantShieldOptions) => new TenantSubscriber(opts),
          inject: [TENANT_SHIELD_OPTIONS],
        },
        {
          provide: TENANT_SHIELD_CACHE,
          useClass: InMemoryTenantAwareCacheService,
        },
        TenantContextMiddleware,
      ],
      exports: [TENANT_SHIELD_OPTIONS, TENANT_SHIELD_CACHE, TenantSubscriber],
    };
  }

  /**
   * NestModule.configure — 미들웨어를 라우트에 적용하는 위치.
   *
   * 모든 라우트('*')에 TenantContextMiddleware를 자동으로 걸어줍니다.
   * 사용자가 별도로 미들웨어 설정을 안 해도 되는 이유.
   *
   * 만약 특정 라우트(예: /health, /metrics)는 제외하고 싶다면,
   * 사용자가 별도 옵션으로 exclude 패턴을 넘길 수 있게 v0.1.x에서 확장 예정.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
