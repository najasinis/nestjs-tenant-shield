import {
  DynamicModule,
  Global,
  Inject,
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
  OnApplicationBootstrap,
  Provider,
  RequestMethod,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';
import {
  TenantShieldAsyncOptions,
  TenantShieldOptions,
} from './interfaces/tenant-shield-options.interface';
import { TENANT_SHIELD_CACHE, TENANT_SHIELD_OPTIONS } from './constants';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';
import { InMemoryTenantAwareCacheService, TenantAwareCacheService } from './cache/cache.service';
import { setGlobalCache } from './cache/cache.registry';
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
 *  3) TenantSubscriber 인스턴스를 만들고, 부팅 시점에 TypeORM
 *     DataSource의 subscribers 배열에 "자동 등록"
 *  4) 캐시 서비스 인스턴스 제공 (사용자 교체 가능)
 *
 * Subscriber 자동 등록의 중요성:
 *  TypeORM 0.3에서는 NestJS provider로 등록되었다고 해서 자동으로
 *  DataSource가 알아보지 못합니다. dataSource.subscribers 배열에
 *  명시적으로 들어가야 hook이 실제로 호출됩니다.
 *
 *  v0.0.2까지는 이 와이어링이 빠져 있어, 사용자가 TypeOrmModule.forRoot
 *  설정에 subscribers를 직접 적어야 했습니다. v0.0.3에서 모듈이
 *  onApplicationBootstrap에서 자동으로 잡아 push 합니다.
 *
 *  TypeORM이 없는(또는 다른 ORM을 쓰는) 사용자는 lookup이 실패하지만
 *  try/catch로 silently skip — 라이브러리 부팅 자체는 깨지지 않음.
 * ─────────────────────────────────────────────────────────────
 */
@Global()
@Module({})
export class TenantShieldModule implements NestModule, OnApplicationBootstrap {
  /**
   * onApplicationBootstrap 등에서 동적 lookup용으로 사용할 ModuleRef.
   * forRoot가 만든 DynamicModule의 providers에 명시적으로 추가될 필요는 없음
   * — Nest가 기본으로 주입해 줍니다.
   */
  private static readonly logger = new Logger('TenantShieldModule');

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly subscriber: TenantSubscriber,
    @Inject(TENANT_SHIELD_CACHE)
    private readonly cache: TenantAwareCacheService,
  ) {}

  /**
   * 동기 옵션으로 모듈 초기화.
   * 가장 흔한 사용 방식.
   *
   * 반환 객체에 global: true를 박아두어 어떤 모듈에서든 imports 없이
   * TENANT_SHIELD_OPTIONS / TENANT_SHIELD_CACHE를 주입받을 수 있게 함.
   */
  static forRoot(options: TenantShieldOptions): DynamicModule {
    return {
      module: TenantShieldModule,
      global: true,
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
      global: true,
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
   * forRoutes('*')는 NestJS v10 + Express의 path-to-regexp v6에서
   * 깨지는 케이스가 있어, 명시적으로 { path, method } 형태를 사용.
   *
   * 만약 특정 라우트(예: /health, /metrics)는 제외하고 싶다면,
   * 사용자가 별도 옵션으로 exclude 패턴을 넘길 수 있게 v0.1.x에서 확장 예정.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }

  /**
   * 모든 모듈이 init된 직후 호출되는 라이프사이클.
   *
   * 이 시점에는:
   *  - TypeOrmModule.forRoot가 만든 DataSource가 DI 컨테이너에 등록되어 있음
   *  - 우리가 만든 TenantSubscriber 인스턴스도 주입 가능
   *
   * 따라서 여기서 한 번만 DataSource.subscribers 배열에 push 하면
   * 그 다음부터 일어나는 모든 entity 조작 hook(beforeInsert/afterLoad 등)이
   * 자동으로 호출됩니다.
   *
   * 사용자가 직접 TypeOrmModule.forRoot({ subscribers: [TenantSubscriber] })를
   * 적을 필요 없음 — 라이브러리가 알아서 등록.
   */
  async onApplicationBootstrap(): Promise<void> {
    // 1) DataSource 동적 lookup.
    //    strict: false 옵션은 "현재 모듈 스코프 밖이라도 찾아라"의 의미.
    //    TypeORM이 아예 없는 사용자는 여기서 throw → catch로 무시.
    let dataSource: DataSource | null = null;
    try {
      dataSource = this.moduleRef.get(DataSource, { strict: false });
    } catch {
      // 미사용자 케이스. 무시.
    }

    if (dataSource) {
      // 이미 등록되어 있으면 중복 push 방지.
      if (!dataSource.subscribers.includes(this.subscriber)) {
        dataSource.subscribers.push(this.subscriber);
        TenantShieldModule.logger.log(
          'TenantSubscriber가 DataSource에 자동 등록되었습니다.',
        );
      }
    } else {
      // TypeORM이 안 쓰이는 환경 — 다른 ORM(Prisma v0.2, Mongoose v0.3) 사용자.
      // 디버그 로그만 남기고 종료.
      TenantShieldModule.logger.debug(
        'TypeORM DataSource를 찾지 못했습니다. Subscriber 자동 등록은 건너뜁니다. ' +
          '(TypeORM을 사용하지 않는 경우 정상)',
      );
    }

    // 3) 캐시 인스턴스를 글로벌 registry에 등록.
    //    @Cacheable 데코레이터가 사용자 클래스에 cacheService 프로퍼티가 없을 때
    //    이 registry에서 fallback 인스턴스를 가져옵니다.
    setGlobalCache(this.cache);
  }
}
