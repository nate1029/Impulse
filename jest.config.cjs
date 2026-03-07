module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  collectCoverageFrom: ['src/main/**/*.js', '!src/main/main.js'],
  coverageDirectory: 'coverage',
  verbose: true
};
