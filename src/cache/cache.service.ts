import { Injectable } from '@nestjs/common';

/**
 * ─────────────────────────────────────────────────────────────
 * 캐시 백엔드 추상화.
 *
 * v0.1에서는 가장 단순한 in-memory Map 구현체를 기본 제공합니다.
 * 프로덕션에서는 사용자가 Redis 등 외부 캐시로 교체할 수 있도록
 * 인터페이스를 분리해 둡니다.
 *
 * 추후 nestjs-tenant-shield-redis 같은 어댑터 패키지로 분리 검토.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * 모든 캐시 구현체가 충족해야 하는 계약.
 */
export interface TenantAwareCacheService {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

/**
 * ─────────────────────────────────────────────────────────────
 * In-Memory 캐시 구현체 (기본 제공).
 *
 * 단일 프로세스 + 개발/테스트 환경에 적합합니다.
 * 멀티 인스턴스 배포(여러 컨테이너)에서는 캐시가 공유되지 않으므로
 * Redis 어댑터로 교체 권장.
 * ─────────────────────────────────────────────────────────────
 */
@Injectable()
export class InMemoryTenantAwareCacheService implements TenantAwareCacheService {
  /** value + expiresAt(ms epoch) 묶음. lazy expiration. */
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>();

  async get(key: string): Promise<unknown | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * 테스트나 tenant 데이터 삭제(GDPR purge) 시 활용.
   * 특정 prefix(예: 'academy-A:')로 시작하는 모든 캐시 키 제거.
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}
