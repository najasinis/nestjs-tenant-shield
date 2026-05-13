# interceptors/

이 폴더는 향후 NestJS Interceptor 패턴이 필요해질 때를 위해 비워둔 자리입니다.

## 현재(v0.1) 설계 의도

v0.1에서는 **데코레이터(`@RequireTenant`)가 메서드 디스크립터를 직접 wrap**하는
방식으로 보호 로직을 적용합니다. 인터셉터는 사용하지 않습니다.

이유:
1. NestJS 인터셉터는 컨트롤러 핸들러에만 동작 — 서비스 메서드까지 가로채려면
   별도 메커니즘 필요
2. 백그라운드 큐, CLI 스크립트, 테스트처럼 컨트롤러를 거치지 않는 호출 경로도
   동일하게 보호되어야 함
3. 데코레이터 wrap이 단순하고 호출 경로에 독립적

## v0.2+ 추가 검토 사항

다음 기능이 들어오면 인터셉터가 필요할 수 있습니다.

- **RequireTenantInterceptor**: 컨트롤러 단계에서 일찍 거부해 서비스 호출 전 차단
- **AuditLoggingInterceptor**: cross-tenant 시도를 잡았을 때 보안 로그 자동 기록
- **PerformanceInterceptor**: tenant별 응답 시간/요청 수 메트릭

추가될 때 이 README는 삭제합니다.
