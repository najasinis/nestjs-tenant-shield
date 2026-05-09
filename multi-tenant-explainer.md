# 멀티테넌시란? - 입문서

진영님이 nestjs-tenant-shield를 만들기 전에 머릿속 그림을 잡는 용도. 비유 먼저, 기술 나중.

## 1. 한 줄 정의

여러 고객사(=tenant)가 하나의 SaaS 앱을 같이 쓰는 패턴. 단, 데이터는 절대 안 섞이게.

## 2. 비유로 이해하기

### 빌딩에 입주한 여러 학원

학원 SaaS 백엔드 + DB 하나에:
- A학원 (강남)
- B학원 (종로)
- C학원 (부산)

규칙:
- 하나의 SaaS에 학원 여러 개 (멀티 = 여러, tenant = 입주자)
- A학원 직원은 A학원 데이터만 봐야 함
- 다른 학원 데이터 누출 = 회사 망함

### 슈퍼러닝 사례

진영님 회사 ClassDay = 멀티테넌시 SaaS. spaceId 컬럼이 tenant 구분자.

진영님이 만들 라이브러리 = 매번 수동으로 적던 WHERE spaceId='A'를 자동화.

## 3. 멀티테넌시 3가지 패턴

- **패턴 1 Database per Tenant**: 학원마다 별도 DB. 가장 안전, 가장 비쌈
- **패턴 2 Schema per Tenant**: 같은 DB, 다른 schema. 중간
- **패턴 3 Discriminator (tenant_id 컬럼)** - 우리가 만들 것: 같은 테이블, 가장 흔하고 가장 위험

## 4. 데이터 누출 사고 시나리오

1. 개발자가 WHERE 빠뜨림 → A학원 직원이 전체 학생 명단을 봄
2. 캐시 키에 tenant prefix 빠뜨림 → 다른 학원 캐시 hit
3. 백그라운드 작업 컨텍스트 잃음 → A학원 보고서가 B학원으로

진영님 라이브러리가 한 줄(@RequireTenant)로 위 3가지 모두 차단.

## 5. 핵심 기술 요소

- **AsyncLocalStorage**: 동시 요청을 안 섞이게 추적. Node.js 내장
- **TypeORM Subscriber**: 쿼리 실행 직전 자동 WHERE 주입
- **Postgres RLS** (v0.3): DB 레벨 마지막 자물쇠

## 6. 6주 마일스톤

- 1주: AsyncLocalStorage + 미들웨어
- 2주: @RequireTenant 데코레이터
- 3주: TypeORM Subscriber 자동 WHERE 주입 (핵심)
- 4주: 캐시 + 테스트 헬퍼
- 5주: strict mode + 데모
- 6주: README + npm publish + 공개

## 7. 한 줄 정리

@RequireTenant() 데코레이터 한 줄로 B2B SaaS의 데이터 누출을 자동 차단하는 라이브러리.
