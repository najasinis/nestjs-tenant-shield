import { TenantShieldOptions } from '../interfaces/tenant-shield-options.interface';
import { InvalidTenantSourceError } from '../errors/invalid-tenant-source.error';
import { TenantResolver } from './tenant-resolver.interface';
import { HeaderTenantResolver } from './header.resolver';
import { JwtTenantResolver } from './jwt.resolver';
import { SubdomainTenantResolver } from './subdomain.resolver';
import { CustomTenantResolver } from './custom.resolver';

/**
 * forRoot 옵션을 보고 적절한 TenantResolver 구현체를 만들어주는 팩토리 함수.
 *
 * 미들웨어는 어떤 source 종류인지 알 필요 없이 이 함수가 만들어준
 * resolver의 resolve()만 호출하면 됩니다.
 *
 * 설정 오류는 부팅 시점에 즉시 throw (InvalidTenantSourceError).
 */
export function createTenantResolver(options: TenantShieldOptions): TenantResolver {
  switch (options.tenantSource) {
    case 'header':
      // headerName은 옵션이고 없으면 기본 'x-tenant-id' 사용.
      return new HeaderTenantResolver(options.headerName);

    case 'jwt':
      return new JwtTenantResolver(options.jwtClaim);

    case 'subdomain':
      // subdomain은 패턴이 반드시 있어야 의미가 있으므로 누락 시 즉시 throw.
      if (!options.subdomainPattern) {
        throw new InvalidTenantSourceError(
          "tenantSource='subdomain'을 사용하려면 subdomainPattern을 지정해야 합니다. 예: '*.yourapp.com'",
          'subdomain',
        );
      }
      return new SubdomainTenantResolver(options.subdomainPattern);

    case 'custom':
      // custom은 함수가 반드시 있어야 함.
      if (!options.customResolver) {
        throw new InvalidTenantSourceError(
          "tenantSource='custom'을 사용하려면 customResolver 함수를 제공해야 합니다.",
          'custom',
        );
      }
      return new CustomTenantResolver(options.customResolver);

    default:
      // TypeScript의 exhaustiveness check 패턴.
      // 새 source 종류가 추가됐는데 위 switch에 안 추가하면 컴파일 에러.
      const _exhaustive: never = options.tenantSource;
      throw new InvalidTenantSourceError(
        `알 수 없는 tenantSource: ${_exhaustive}`,
        String(_exhaustive),
      );
  }
}
