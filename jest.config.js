// ─────────────────────────────────────────────────────────────
// Jest (테스트 러너) 설정 파일.
// "pnpm test"를 실행하면 Jest가 이 설정을 보고 동작합니다.
// ─────────────────────────────────────────────────────────────
module.exports = {
  // TypeScript 파일을 직접 실행할 수 있게 해주는 변환기.
  // 별도의 빌드 단계 없이 .ts 파일을 그대로 테스트할 수 있습니다.
  preset: 'ts-jest',

  // 테스트가 돌아가는 환경. 라이브러리는 Node 환경에서 동작하므로 'node' 사용.
  // (반대로 React 같은 브라우저 환경 라이브러리는 'jsdom' 사용)
  testEnvironment: 'node',

  // 테스트 파일을 찾을 루트 폴더.
  roots: ['<rootDir>/src', '<rootDir>/test'],

  // 테스트 파일로 인식할 패턴.
  // 예: src/foo.service.ts 옆에 foo.service.spec.ts 두면 자동 인식.
  testRegex: '.*\\.(spec|test)\\.ts$',

  // TypeScript 파일을 어떻게 변환할지.
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },

  // 커버리지 측정 대상.
  // index.ts(배럴 export)와 인터페이스 파일은 로직이 없어 커버리지 의미 없음 → 제외.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/index.ts',
    '!src/**/*.interface.ts',
  ],

  // 커버리지 리포트가 저장될 폴더.
  coverageDirectory: 'coverage',

  // 모듈 import 시 무시할 확장자 우선순위.
  moduleFileExtensions: ['ts', 'js', 'json'],

  // 테스트 시작 전에 한 번 실행되는 셋업 파일이 필요하면 여기에 추가.
  // 예: 전역 mock, reflect-metadata polyfill 등.
  setupFiles: ['reflect-metadata', '<rootDir>/test/setup.js'],
};
