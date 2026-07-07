module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    browser: true
  },
  extends: [
    'eslint:recommended',
    'plugin:security/recommended-legacy'
  ],
  plugins: ['security'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'script'
  },
  rules: {
    // Tighten key rules for production
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off', // Allow console in Electron app
    'prefer-const': 'warn',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // Security plugin overrides (reduce noise for Electron context)
    'security/detect-object-injection': 'off', // Too many false positives
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-child-process': 'warn',
    'security/detect-non-literal-regexp': 'off'
  },
  overrides: [
    {
      // Renderer files run in browser context
      files: ['src/renderer/**/*.js'],
      env: {
        node: false,
        browser: true
      },
      globals: {
        CodeMirror: 'readonly',
        electronAPI: 'readonly'
      }
    },
    {
      // Test files
      files: ['**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true
      }
    }
  ]
};
