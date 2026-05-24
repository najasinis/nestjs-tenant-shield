/**
 * ─────────────────────────────────────────────────────────────
 * nestjs-tenant-shield의 public 진입점.
 *
 * 라이브러리 사용자는 항상 이 경로에서 import 합니다:
 *
 *   import {
 *     TenantShieldModule,
 *     RequireTenant,
 *     SystemAction,
 *     Cacheable,
 *     getCurrentTenantId,
 *     runWithTenant,
 *     MissingTenantContextError,
 *     CrossTenantAccessError,
 *   } from 'nestjs-tenant-shield';
 *
 * 내부 구현 디테일(폴더 구조 등)은 사용자에게 노출하지 않습니다.
 * 모든 외부 API는 여기서만 export 됨.
 * ─────────────────────────────────────────────────────────────
 */

// 메인 모듈
export * from './tenant-shield.module';

// 데코레이터
export * from './decorators';

// 컨텍스트 헬퍼 (getCurrentTenantId, runWithTenant 등)
export * from './context';

// 미들웨어 (사용자가 수동 설정하고 싶을 때 직접 가져갈 수 있게 노출)
export * from './middleware';

// 인터페이스/타입 (public API 충돌 방지를 위해 명시 export)
export {
	TenantShieldOptions,
	TenantShieldAsyncOptions,
	TenantSource,
	TenantStrategy,
} from './interfaces/tenant-shield-options.interface';
export { RequireTenantOptions } from './interfaces/require-tenant-options.interface';
export { CacheableOptions } from './interfaces/cacheable-options.interface';
export { TenantContextOptions } from './interfaces/tenant-context-options.interface';
export { TenantContext as TenantContextState } from './interfaces/tenant-context.interface';

// 에러
export * from './errors';

// 캐시 (사용자가 커스텀 백엔드 구현 시 인터페이스 필요)
export * from './cache';

// TypeORM 통합 (raw SQL 헬퍼 등)
export * from './typeorm';

// Prisma 통합 (createTenantAwarePrisma)
export * from './prisma';

// 상수 (DI 토큰)
export * from './constants';

// 테스트 헬퍼 (runWithTenant 등은 context에서도 export 되지만, expectCurrentTenant 등 테스트 전용 유틸 포함)
export * from './testing';
