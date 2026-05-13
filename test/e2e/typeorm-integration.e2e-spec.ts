/**
 * ─────────────────────────────────────────────────────────────
 * TypeORM 통합 e2e 테스트 — 스켈레톤.
 *
 * 목적:
 *  실제 SQLite 인-메모리 DB를 띄워서, TenantSubscriber가
 *  INSERT/SELECT/UPDATE/DELETE에 자동 WHERE를 정확히 주입하는지 검증.
 *
 * 일반 unit test로는 잡기 어려운 통합 동작을 잡습니다.
 *
 * 실행 셋업(v0.1 구현 단계에서 채울 항목):
 *  1) TypeORM DataSource 생성 (SQLite, synchronize: true)
 *  2) TenantSubscriber 등록 (forRoot 옵션으로 주입)
 *  3) 테스트 entity Student { id, tenantId, name } 정의
 *  4) seed 데이터 — academy-A 학생 2명, academy-B 학생 2명
 *
 * 검증 시나리오:
 *  - runWithTenant('A') 안에서 find()는 A 학생만 반환
 *  - runWithTenant('A') 안에서 create() 시 tenant_id가 자동으로 'A'로 저장됨
 *  - runWithTenant('A') 안에서 직접 academy-B의 row를 가져오려 하면
 *    afterLoad hook이 CrossTenantAccessError를 throw
 *  - runWithoutTenant() 안에서는 모든 tenant 데이터 접근 허용 (시스템 작업)
 *
 * ─────────────────────────────────────────────────────────────
 */

describe('TypeORM TenantSubscriber e2e (skeleton)', () => {
  // TODO: 실제 DataSource를 띄우는 beforeAll/afterAll 셋업.
  //       sqlite3 driver는 zero-config로 인메모리 DB를 띄울 수 있어 e2e에 적합.
  //
  // beforeAll(async () => {
  //   dataSource = new DataSource({
  //     type: 'sqlite',
  //     database: ':memory:',
  //     entities: [Student],
  //     synchronize: true,
  //     subscribers: [new TenantSubscriber(options)],
  //   });
  //   await dataSource.initialize();
  // });

  it.todo('runWithTenant("A") 안에서 find()는 A의 row만 반환한다');
  it.todo('create() 시 entity의 tenant_id가 자동으로 현재 컨텍스트 값으로 채워진다');
  it.todo('cross-tenant row가 로드되면 CrossTenantAccessError가 throw된다');
  it.todo('runWithoutTenant() 안에서는 모든 tenant 데이터를 자유롭게 읽을 수 있다');
});
