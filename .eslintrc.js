// ─────────────────────────────────────────────────────────────
// ESLint 설정.
// TypeScript 코드의 잠재적 버그/안티 패턴을 자동 검출하고,
// Prettier와 충돌하지 않도록 포매팅 규칙은 Prettier에 위임합니다.
// ─────────────────────────────────────────────────────────────
module.exports = {
  // TypeScript 코드를 파싱할 수 있는 파서로 교체.
  parser: '@typescript-eslint/parser',

  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },

  plugins: ['@typescript-eslint/eslint-plugin'],

  extends: [
    // TypeScript 권장 규칙.
    'plugin:@typescript-eslint/recommended',
    // Prettier와 충돌하는 규칙들을 모두 끄는 프리셋. 가장 마지막에 두어야 함.
    'prettier',
  ],

  root: true,
  env: {
    node: true,
    jest: true,
  },

  // 빌드 결과물과 설정 파일들은 lint 대상에서 제외.
  ignorePatterns: ['.eslintrc.js', 'dist/', 'node_modules/', 'jest.config.js'],

  rules: {
    // 너무 엄격해서 라이브러리 개발에 방해가 되는 규칙은 완화.
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',

    // any 사용은 경고. 라이브러리는 가능한 한 타입 명시 권장.
    '@typescript-eslint/no-explicit-any': 'warn',

    // 사용하지 않는 변수는 에러. 단, '_'로 시작하는 건 의도적 무시로 허용.
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
