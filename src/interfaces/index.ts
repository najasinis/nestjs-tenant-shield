/**
 * interfaces 폴더의 모든 public 타입을 한 곳에서 re-export 하는 배럴 파일.
 *
 * 이렇게 해두면 라이브러리 외부에서:
 *   import { TenantShieldOptions } from 'nestjs-tenant-shield';
 * 처럼 깔끔하게 import 할 수 있습니다.
 */
export * from './tenant-shield-options.interface';
export * from './require-tenant-options.interface';
export * from './cacheable-options.interface';
export * from './tenant-context-options.interface';
// TenantContext는 데코레이터와 이름이 충돌하므로 public 진입점에서는 별칭으로 export.
export * from './tenant-context.interface';
