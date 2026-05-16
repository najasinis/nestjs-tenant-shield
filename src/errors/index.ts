/**
 * 라이브러리가 throw할 수 있는 모든 에러 타입을 한 곳에서 export.
 *
 * 사용자는 catch 블록에서 instanceof로 분기할 수 있습니다:
 *   if (e instanceof CrossTenantAccessError) { ... }
 */
export * from './missing-tenant-context.error';
export * from './cross-tenant-access.error';
export * from './invalid-tenant-source.error';
