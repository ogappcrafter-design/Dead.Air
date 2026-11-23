module.exports = {
  preset: 'jest-expo',
  // The first test in a file pays the screen's cold mount (3-7 s with
  // coverage on a loaded runner, 0.1-0.2 s once warm), so the 5 s default
  // times out on whichever test lands first. Budget the cold start, not the
  // assertion: measured with --ci --coverage on the same tree. Two workers
  // keep peak memory and CPU under what a shared four-core runner can serve.
  testTimeout: 30000,
  maxWorkers: 2,
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  transformIgnorePatterns: [],
  roots: ['<rootDir>'],
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/tests/**/*.test.ts?(x)'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup-after-env.js'],
};
