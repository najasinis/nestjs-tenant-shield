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
