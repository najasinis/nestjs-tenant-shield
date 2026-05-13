import { HeaderTenantResolver } from '../../src/resolvers/header.resolver';

describe('HeaderTenantResolver', () => {
  it('지정된 헤더에서 tenant ID를 추출해야 한다', () => {
    const resolver = new HeaderTenantResolver('x-tenant-id');
    const req = { headers: { 'x-tenant-id': 'academy-A' } };
    expect(resolver.resolve(req)).toBe('academy-A');
  });

  it('헤더가 없으면 null을 반환해야 한다', () => {
    const resolver = new HeaderTenantResolver();
    expect(resolver.resolve({ headers: {} })).toBeNull();
  });

  it('헤더 값이 배열이면 첫 번째 값을 사용해야 한다', () => {
    const resolver = new HeaderTenantResolver();
    const req = { headers: { 'x-tenant-id': ['academy-A', 'academy-B'] } };
    expect(resolver.resolve(req)).toBe('academy-A');
  });

  it('빈 문자열은 null로 정규화되어야 한다', () => {
    const resolver = new HeaderTenantResolver();
    expect(resolver.resolve({ headers: { 'x-tenant-id': '   ' } })).toBeNull();
  });
});
