# Contributing to nestjs-tenant-shield

기여해 주셔서 감사합니다. 아래 가이드를 따라 주세요.

## 개발 환경 셋업

```bash
# 1. 저장소 클론
git clone https://github.com/jinyeongjung/nestjs-tenant-shield.git
cd nestjs-tenant-shield

# 2. 의존성 설치
npm install

# 3. 타입 체크
npx tsc -p tsconfig.build.json --noEmit

# 4. 테스트 실행
npm test

# 5. 빌드
npm run build

# 6. (선택) 데모 서버
npm run demo        # http://localhost:3000
```

## PR 올리는 방법

1. `main`에서 feature 브랜치 생성 (`feat/my-feature`, `fix/bug-name`)
2. 변경 사항 구현 + 테스트 추가
3. `npx tsc -p tsconfig.build.json --noEmit && npm test` 그린 확인
4. PR 생성 — `.github/PULL_REQUEST_TEMPLATE.md` 양식 준수

## 커밋 컨벤션

```
<prefix>(<scope>): <본문>
```

| prefix | 용도 |
|--------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `test` | 테스트만 변경 |
| `docs` | 문서만 변경 |
| `refactor` | 로직 변경 없는 코드 구조 개선 |
| `chore` | 빌드/설정 변경 |

## 격리 규칙 (필수)

이 라이브러리의 핵심은 멀티테넌시 격리입니다. 새 코드를 작성할 때:

- Cross-tenant 시도는 반드시 `CrossTenantAccessError` throw
- 컨텍스트 없는 쿼리는 `MissingTenantContextError` throw (`strictMode: true` 기본)
- 새 ORM 어댑터는 반드시 e2e 시나리오에 **cross-tenant 격리 검증** 포함
- `runWithoutTenant()`는 시스템 작업에만 허용 — 일반 비즈니스 로직에서 호출 금지
- cross-tenant 우회 코드가 포함된 PR은 반드시 PR 본문에 우회 사유 명시

## 이미 발견된 함정

[docs/critical-notes.md](docs/critical-notes.md)에 실제 발생한 함정이 정리되어 있습니다. 특히 다음 항목은 반드시 확인하세요:

- **§1.1** `isSystemAction` 머지 버그 — `runWithoutTenant` 안에서도 WHERE가 박히는 패턴
- **§1.3** `@SystemAction` + `@RequireTenant` 데코레이터 순서 — 역순이면 우회 불가
- **§3.1** sync throw vs `Promise.reject` — Jest `rejects` matcher 불일치

## 새 ORM 어댑터 추가 시 체크리스트

- [ ] `src/<orm>/` 폴더 신설
- [ ] `@prisma/client` 같은 외부 ORM은 direct import 금지 → duck-type 패턴 사용
- [ ] `peerDependencies`에 optional로 추가
- [ ] 단위 테스트 (`test/unit/<orm>-*.spec.ts`) — MissingTenantContextError, CrossTenantAccessError 케이스 포함
- [ ] `examples/<orm>-saas/README.md` 신설
- [ ] `src/index.ts` export 추가
- [ ] CHANGELOG.md 업데이트

## 질문 / 버그 신고

GitHub Issues를 이용해 주세요. 보안 취약점은 [SECURITY.md](SECURITY.md)를 먼저 읽어주세요.
