/**
 * 테스트 전용 헬퍼 배럴.
 *
 * 외부에서:
 *   import { runWithTenant, expectCurrentTenant } from 'nestjs-tenant-shield/testing';
 *
 * 같은 형태로 가져다 쓸 수 있게 합니다.
 *
 * (subpath import 지원은 package.json "exports" 필드 설정 후 활성화 — v0.1.x 예정)
 */
export * from './test-helpers';
