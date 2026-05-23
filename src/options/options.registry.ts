import { TenantShieldOptions } from '../interfaces/tenant-shield-options.interface';

/**
 * ─────────────────────────────────────────────────────────────
 * 글로벌 옵션 registry — @RequireTenant wrapMethod의 DI 우회로.
 *
 * 배경:
 *   wrapMethod는 메서드 디스크립터를 decoration 시점에 감싸기 때문에
 *   NestJS DI 컨테이너에서 forRoot 옵션을 꺼낼 방법이 없습니다.
 *
 *   해결: 모듈이 onApplicationBootstrap 시점에 옵션을 이 registry에 등록.
 *   wrapMethod 내부의 wrapped function은 런타임에 registry에서 읽어옵니다.
 *
 * ⚠️ 한계:
 *   - 한 프로세스에 하나의 forRoot 옵션만 가능 (대부분 SaaS에서는 OK)
 *   - 테스트 격리를 위해 resetGlobalOptions() 필요
 *
 * ─────────────────────────────────────────────────────────────
 */

let globalOptions: TenantShieldOptions | undefined;

/** 모듈 bootstrap 단계에서 1회 호출. */
export function setGlobalOptions(options: TenantShieldOptions): void {
  globalOptions = options;
}

/** wrapMethod가 런타임에 allowSystemActions 등을 읽기 위해 호출. */
export function getGlobalOptions(): TenantShieldOptions | undefined {
  return globalOptions;
}

/** 테스트 격리용. 각 테스트 케이스 후 호출해서 오염 방지. */
export function resetGlobalOptions(): void {
  globalOptions = undefined;
}
