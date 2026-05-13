import { AsyncLocalStorage } from 'node:async_hooks';
import { TenantContext } from '../interfaces/tenant-context.interface';

/**
 * ─────────────────────────────────────────────────────────────
 * 이 라이브러리의 심장.
 *
 * Node.js의 AsyncLocalStorage를 활용해서, "지금 처리 중인 요청이
 * 어느 tenant 것인지"를 비동기 호출 체인 전체에 걸쳐 안전하게
 * 추적합니다.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [비유]
 * 사무실에 동시에 여러 손님이 방문해도, 각자 손에 출입 카드를
 * 들고 있어서 어느 부서로 안내해야 하는지 직원이 헷갈리지 않습니다.
 * AsyncLocalStorage는 그 "출입 카드"의 역할입니다.
 *
 * Node.js는 동시 요청을 단일 스레드에서 비동기로 처리하기 때문에,
 * 단순히 전역 변수에 tenantId를 넣으면 A요청 처리 중에 B요청이
 * 끼어들어 값이 섞입니다. AsyncLocalStorage는 각 비동기 흐름에
 * 별도의 "상자"를 부여해 이 문제를 원천 차단합니다.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * [사용 패턴]
 *   tenantContextStorage.run({ tenantId: 'A' }, async () => {
 *     // 이 콜백 안에서는, 그리고 그 안에서 호출되는 모든 비동기
 *     // 함수에서는 getStore()가 { tenantId: 'A' }를 반환합니다.
 *   });
 *
 * ─────────────────────────────────────────────────────────────
 */

/**
 * 라이브러리 전체에서 공유되는 단 하나의 AsyncLocalStorage 인스턴스.
 *
 * 이걸 여러 개 만들면 컨텍스트가 분리되어버려 의도와 다르게 동작합니다.
 * 따라서 module-level singleton으로 export 합니다.
 *
 * ⚠️ 외부 사용자는 직접 접근하지 말고 runWithTenant() 같은 헬퍼를 쓰세요.
 *    이 export는 라이브러리 내부 모듈들 간의 협업과 고급 디버깅용입니다.
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();
