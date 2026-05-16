# 멀티테넌시 한눈에 보기

README가 사용법의 기준 문서입니다. 여기서는 개념만 간단히 정리합니다.

> 현재 상태 안내: 이 문서는 구현 완료 문서가 아니라 제품 방향을 맞추기 위한 입문 설명이다.
> 실제 경쟁력은 구현 코드, 테스트, 외부 도입 증거가 확보되어야 검증된다.

## 1. 한 줄 정의

여러 고객사(tenant)가 하나의 SaaS 앱을 공유하되, 데이터는 절대 섞이지 않게 하는 설계.

## 2. 멀티테넌시 3가지 패턴

- Database per Tenant: 고객사마다 별도 DB. 가장 안전, 가장 비쌈
- Schema per Tenant: 같은 DB, schema 분리. 중간
- Discriminator: 같은 테이블, tenant_id 컬럼으로 구분. 가장 흔하고 가장 위험

## 3. 핵심 위험 시나리오

- ORM 쿼리에서 tenant 조건 누락
- 캐시 키에 tenant prefix 누락
- 백그라운드 작업에서 컨텍스트 유실

## 4. 더 읽을 거리

- README: 사용법/예제/빠른 시작
- docs/tenant-shield-api-spec.md: API 상세 명세
- docs/tenant-shield-PRD.md: 설계/로드맵/배경
