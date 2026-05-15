import { Injectable } from '@nestjs/common';
import type { TenantAwareCacheService } from 'nestjs-tenant-shield';

/**
 * ─────────────────────────────────────────────────────────────
 * Redis 기반 TenantAwareCacheService 구현 예시.
 *
 * 실제 회사 코드에 옮겨 쓸 때는:
 *  - ioredis / redis 등 회사 표준 SDK로 교체
 *  - TLS, 인증, 클러스터 설정을 SDK 옵션에서 처리
 *  - 직렬화는 보통 JSON이지만, 이미지/바이너리는 별도 처리 권장
 *
 * 핵심: get/set/del 세 메서드만 인터페이스 충족하면 라이브러리가 알아서 키 분리.
 *
 * 캐시 키 prefix는 @Cacheable이 자동으로 'tenantId:' 형태로 붙입니다.
 * 따라서 어댑터는 raw 키를 그대로 Redis에 저장하면 됨.
 * ─────────────────────────────────────────────────────────────
 */

// 사용자의 실제 Redis client 타입 — 여기서는 데모용 최소 인터페이스.
// 실제로는 `import Redis from 'ioredis'` 같은 형태.
interface MinimalRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
  del(key: string): Promise<number>;
}

@Injectable()
export class RedisCacheAdapter implements TenantAwareCacheService {
  constructor(private readonly redis: MinimalRedisClient) {}

  /**
   * miss는 undefined로 반환 (null은 캐시 가능한 값으로 간주).
   * Redis는 미스 시 null을 반환하므로 변환 필요.
   */
  async get(key: string): Promise<unknown | undefined> {
    const raw = await this.redis.get(key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      // 직렬화 깨진 키 — 안전하게 미스 취급.
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
