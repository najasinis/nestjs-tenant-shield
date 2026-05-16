# Academy SaaS Example

학원 관리 SaaS를 가정한 nestjs-tenant-shield 사용 예시.

## 구성

```
src/
├── app.module.ts             # 루트 모듈 — TenantShieldModule.forRoot() 등록
├── students/
│   ├── student.entity.ts     # tenant_id 컬럼을 가진 entity 예시
│   ├── students.service.ts   # @RequireTenant + @Cacheable 적용 서비스
│   └── students.controller.ts# 헤더로부터 tenant 추출되는 라우트
└── maintenance/
    └── maintenance.service.ts# @SystemAction 사용 예시 (모든 tenant 순회)
```

## 시나리오

- 학원 A의 사용자는 X-Tenant-Id: academy-A 헤더로 요청
- /students 조회 시 자동으로 `WHERE tenant_id = 'academy-A'` 가 주입
- 학생 통계 캐시는 학원별로 분리 저장
- 야간 cron이 모든 학원의 만료 데이터를 정리

> 이 폴더의 코드는 라이브러리 동작을 보여주는 데모입니다.
> 실제 동작하는 예시는 v0.0.5(Week 5) 마일스톤에서 완성 예정.

## tenantSource 바꿔보기

가장 흔한 4가지 추출 방식. `src/app.module.ts`의 `forRoot()` 옵션만 교체하면
컨트롤러/서비스 코드는 그대로 두고 인증 인프라만 바꿀 수 있습니다.

| 방식 | 사용 시점 | 추출 위치 |
|---|---|---|
| `header` | 모바일 앱, 내부 API, 간단한 셋업 | `X-Tenant-Id: academy-A` |
| `jwt` | 표준 토큰 기반 인증 (Passport 등) | `req.user.tenant_id` |
| `subdomain` | 멀티 도메인 SaaS (`academy-a.yourapp.com`) | 호스트 헤더 |
| `custom` | 위 세 가지에 안 맞는 특수 케이스 | 사용자가 함수로 직접 지정 |

코드 변형 스니펫은 `src/app.module.ts` 안의 주석을 참고하세요.

## 시스템 작업 패턴

크론/배치 작업이 모든 학원을 가로질러야 할 때는 **`runWithoutTenant()` 단독
호출을 피하고**, `@SystemAction()` + `runWithTenant()` 루프 조합을 사용하세요.

`src/maintenance/maintenance.service.ts`의 `runDailyCleanupForAllTenants`가
정석 패턴입니다.

이유: `runWithoutTenant()` 안에서는 모든 자동 보호가 꺼져 있어 한 줄 실수로
전 학원 데이터가 한 결과 셋에 섞일 수 있습니다. 루프 패턴은 각 반복 안에서
일반 보호가 그대로 켜져 있어 안전합니다.
