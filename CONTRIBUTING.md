# Contributing to nestjs-tenant-shield

Thank you for your interest in contributing!
기여해 주셔서 감사합니다.

## Before You Start / 시작 전

1. Check existing [Issues](https://github.com/jinyeongjung/nestjs-tenant-shield/issues) and [PRs](https://github.com/jinyeongjung/nestjs-tenant-shield/pulls) to avoid duplicate work.
2. For significant changes, open an issue first to discuss the approach.
3. Read `docs/critical-notes.md` — it lists known pitfalls specific to this project.

## Setup / 개발 환경

```bash
# Node.js 18+ required (AsyncLocalStorage stable from 18)
node --version  # >= 18.0.0

git clone https://github.com/jinyeongjung/nestjs-tenant-shield.git
cd nestjs-tenant-shield
npm install

# Verify green baseline before making changes
npx tsc -p tsconfig.build.json --noEmit && npm test
```

## Development Workflow / 개발 흐름

```bash
npm test             # Run all unit tests
npm run test:watch   # Watch mode
npm run test:cov     # Coverage report
npm run lint         # ESLint
npm run build        # Compile TypeScript
npm run demo         # Run academy-saas example server
```

## Security Guidelines / 보안 가이드라인

**This library's primary purpose is preventing cross-tenant data leaks.**
Any change that touches tenant isolation logic requires:

1. **An e2e test** that verifies the isolation still holds (see `test/e2e/`).
2. A comment in the PR body explaining any intentional bypass (`@SystemAction`, `runWithoutTenant`).
3. Review of `docs/critical-notes.md` to ensure no known pitfalls are re-introduced.

Cross-tenant bypass without justification in the PR body → **do not merge**.

## Commit Convention / 커밋 컨벤션

```
<type>(<scope>): <Korean or English description>

Examples:
feat(decorator): @CacheTenant 데코레이터 추가
fix(typeorm): beforeInsert null 주입 버그 수정
test(e2e): cross-tenant 격리 시나리오 추가
docs(readme): Redis 어댑터 예시 보강
```

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`

## Pull Request Checklist / PR 체크리스트

- [ ] `npx tsc -p tsconfig.build.json --noEmit` passes / 타입 체크 통과
- [ ] `npm test` passes / 테스트 통과
- [ ] New functionality has tests / 신규 기능 테스트 포함
- [ ] Security changes include e2e isolation test / 보안 변경은 e2e 격리 테스트 포함
- [ ] `docs/critical-notes.md` consulted for pitfalls / 함정 문서 확인
- [ ] Cross-tenant bypass (if any) documented in PR body / 우회 코드는 PR 본문에 사유 명시

## Code Style / 코드 스타일

- TypeScript strict mode
- ESLint + Prettier (run `npm run lint` and `npm run format`)
- No comments that restate what the code does — only WHY when non-obvious
- Import order: Node built-ins → external packages → internal (`./`)

## Questions / 문의

Open a [GitHub Discussion](https://github.com/jinyeongjung/nestjs-tenant-shield/discussions) or [Issue](https://github.com/jinyeongjung/nestjs-tenant-shield/issues).
