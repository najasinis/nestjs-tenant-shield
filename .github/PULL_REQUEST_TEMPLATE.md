## 변경 요약

<!-- 무엇을 왜 변경했는지 간단히 설명해주세요 -->

## 변경 유형

- [ ] feat: 새 기능
- [ ] fix: 버그 수정
- [ ] test: 테스트 추가/수정
- [ ] docs: 문서 변경
- [ ] refactor: 로직 변경 없는 코드 구조 개선
- [ ] chore: 빌드/설정 변경

## Cross-tenant 우회 코드 포함 여부

- [ ] 이 PR에는 `runWithoutTenant()`, `@SystemAction()`, 또는 cross-tenant 접근을 허용하는 코드가 **없습니다**
- [ ] 이 PR에는 cross-tenant 우회 코드가 **있습니다** → 아래에 사유 명시 필수

**우회 사유 (해당 시 필수):**

<!-- cross-tenant 우회가 필요한 비즈니스 이유, 영향 범위, 대안 검토 결과를 설명해주세요 -->

## 테스트

- [ ] `npx tsc -p tsconfig.build.json --noEmit` 통과
- [ ] `npm test` 통과
- [ ] 새 기능이면 e2e 시나리오에 cross-tenant 격리 검증 포함

## 체크리스트

- [ ] 커밋 메시지가 conventional prefix 형식을 따름 (`feat(scope): 본문`)
- [ ] 새 ORM 어댑터 추가 시 CHANGELOG.md 업데이트
- [ ] 보안 관련 변경 시 SECURITY.md 업데이트 검토
