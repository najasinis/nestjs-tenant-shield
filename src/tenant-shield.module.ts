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
  TenantShieldCacheProvider,
  TenantShieldOptions,
} from './interfaces/tenant-shield-options.interface';
import { TENANT_SHIELD_CACHE, TENANT_SHIELD_OPTIONS } from './constants';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';
import { InMemoryTenantAwareCacheService, TenantAwareCacheService } from './cache/cache.service';
import { setGlobalCache } from './cache/cache.registry';
import { setGlobalOptions } from './options/options.registry';
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
  private static readonly logger = new Logger('TenantShieldModule');

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly subscriber: TenantSubscriber,
    @Inject(TENANT_SHIELD_OPTIONS)
    private readonly options: TenantShieldOptions,
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
        { provide: TENANT_SHIELD_OPTIONS, useValue: options },
        {
          provide: TenantSubscriber,
          useFactory: (opts: TenantShieldOptions) => new TenantSubscriber(opts),
          inject: [TENANT_SHIELD_OPTIONS],
        },
        buildCacheProvider(options.cache),
        TenantContextMiddleware,
      ],
      exports: [TENANT_SHIELD_OPTIONS, TENANT_SHIELD_CACHE, TenantSubscriber],
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
        // 옵션이 비동기로 만들어지므로 cache provider도 factory로 풀어줌.
        {
          provide: TENANT_SHIELD_CACHE,
          useFactory: (opts: TenantShieldOptions) => buildCacheInstance(opts.cache),
          inject: [TENANT_SHIELD_OPTIONS],
        },
        TenantContextMiddleware,
      ],
      exports: [TENANT_SHIELD_OPTIONS, TENANT_SHIELD_CACHE, TenantSubscriber],
    };
  }

  /**
   * 미들웨어를 모든 라우트에 적용.
   *
   * forRoutes('*')는 NestJS v10/v11 + path-to-regexp v6에서 깨지는 케이스가 있어
   * 명시적 { path, method } 형태 사용 ([critical-notes.md](./docs/critical-notes.md) §2.1).
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
    // DataSource 동적 lookup. TypeORM 미사용 환경(Prisma 등)에서는 throw → silent skip.
    let dataSource: DataSource | null = null;
    try {
      dataSource = this.moduleRef.get(DataSource, { strict: false });
    } catch {
      // TypeORM 미사용 — 정상 케이스.
    }

    if (dataSource) {
      if (!dataSource.subscribers.includes(this.subscriber)) {
        dataSource.subscribers.push(this.subscriber);
        TenantShieldModule.logger.log(
          'TenantSubscriber가 DataSource에 자동 등록되었습니다.',
        );
      }
    } else {
      TenantShieldModule.logger.debug(
        'TypeORM DataSource를 찾지 못했습니다. Subscriber 자동 등록은 건너뜁니다. ' +
          '(TypeORM을 사용하지 않는 경우 정상)',
      );
    }

    // @RequireTenant / @Cacheable이 DI 바깥에서 사용할 글로벌 registry 등록.
    setGlobalOptions(this.options);
    setGlobalCache(this.cache);
  }
}

/**
 * 사용자 cache 옵션 → NestJS Provider 변환.
 * 우선순위: useFactory > useValue > useClass > (default InMemory).
 */
function buildCacheProvider(opts?: TenantShieldCacheProvider): Provider {
  if (opts?.useFactory) {
    return {
      provide: TENANT_SHIELD_CACHE,
      useFactory: opts.useFactory,
      inject: opts.inject ?? [],
    };
  }
  if (opts?.useValue !== undefined) {
    return { provide: TENANT_SHIELD_CACHE, useValue: opts.useValue };
  }
  if (opts?.useClass) {
    return { provide: TENANT_SHIELD_CACHE, useClass: opts.useClass };
  }
  return { provide: TENANT_SHIELD_CACHE, useClass: InMemoryTenantAwareCacheService };
}

/**
 * forRootAsync용 — Provider가 아닌 캐시 인스턴스 직접 반환.
 * useFactory의 inject는 이 경로에서 미지원 (필요시 useValue로 외부 주입).
 */
function buildCacheInstance(opts?: TenantShieldCacheProvider): unknown {
  if (opts?.useFactory) return opts.useFactory();
  if (opts?.useValue !== undefined) return opts.useValue;
  if (opts?.useClass) {
    const Ctor = opts.useClass as new () => unknown;
    return new Ctor();
  }
  return new InMemoryTenantAwareCacheService();
}
