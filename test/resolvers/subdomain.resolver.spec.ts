import { SubdomainTenantResolver } from '../../src/resolvers/subdomain.resolver';

describe('SubdomainTenantResolver', () => {
  it('와일드카드 패턴에 매칭되는 서브도메인을 추출해야 한다', () => {
    const resolver = new SubdomainTenantResolver('*.yourapp.com');
    expect(resolver.resolve({ hostname: 'academy-a.yourapp.com' })).toBe('academy-a');
  });

  it('패턴에 안 맞으면 null을 반환해야 한다', () => {
    const resolver = new SubdomainTenantResolver('*.yourapp.com');
    expect(resolver.resolve({ hostname: 'evil.com' })).toBeNull();
  });

  it('포트가 붙어 있어도 추출해야 한다', () => {
    const resolver = new SubdomainTenantResolver('*.yourapp.com');
    expect(resolver.resolve({ headers: { host: 'academy-a.yourapp.com:3000' } })).toBe(
      'academy-a',
    );
  });

  // TODO: 다중 깊이 서브도메인('*.staging.yourapp.com') 테스트
});
