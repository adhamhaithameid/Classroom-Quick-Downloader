import { defineConfig } from 'vitest/config';

const coverageProfile = process.env.COVERAGE_PROFILE ?? 'default';

const criticalCoverageInclude = [
  'entrypoints/utils/analytics/storage.ts',
  'entrypoints/utils/analytics/flush.ts',
  'entrypoints/utils/analytics/rate-limiter.ts',
  'entrypoints/utils/analytics/detection.ts',
  'entrypoints/background/download-handler.ts',
  'entrypoints/background/message-sender.ts',
  'entrypoints/background/state.ts',
  'entrypoints/background/url-helpers.ts',
];

const runtimeCoverageInclude = [
  'entrypoints/background/download-handler.ts',
  'entrypoints/background/message-sender.ts',
  'entrypoints/background/state.ts',
  'entrypoints/background/url-helpers.ts',
  'entrypoints/utils/analytics/storage.ts',
  'entrypoints/utils/analytics/flush.ts',
  'entrypoints/utils/analytics/rate-limiter.ts',
  'entrypoints/utils/analytics/detection.ts',
];

const runtimeCoverageExclude = [
  '**/*.d.ts',
  '**/node_modules/**',
  'entrypoints/content/translations/**',
  'entrypoints/content/icons.ts',
];

function getCoverageConfig() {
  if (coverageProfile === 'critical') {
    return {
      provider: 'v8' as const,
      reporter: ['text', 'json', 'html'],
      all: true,
      include: criticalCoverageInclude,
      exclude: ['**/*.d.ts', '**/node_modules/**'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    };
  }

  if (coverageProfile === 'runtime') {
    return {
      provider: 'v8' as const,
      reporter: ['text', 'json', 'html'],
      all: true,
      include: runtimeCoverageInclude,
      exclude: runtimeCoverageExclude,
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    };
  }

  return {
    provider: 'v8' as const,
    reporter: ['text', 'json', 'html'],
    include: ['entrypoints/content/**/*.ts'],
    exclude: ['**/*.d.ts', '**/node_modules/**'],
  };
}

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: getCoverageConfig(),
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': '/entrypoints/content',
    },
  },
});
