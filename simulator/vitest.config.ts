import { defineConfig, mergeConfig, type ViteUserConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

/**
 * Simulator test config. Same Vite pipeline as the app, plus:
 * - jsdom environment for mounting the real popup App
 * - canvas-confetti aliased to a recording stub (the real library needs a
 *   canvas; the stub proves the burst fired without pixels)
 */
export default mergeConfig(
  viteConfig as ViteUserConfig,
  defineConfig({
    resolve: {
      alias: [
        {
          find: /^canvas-confetti$/,
          replacement: new URL('./test/confetti-stub.ts', import.meta.url).pathname,
        },
      ],
    },
    test: {
      environment: 'jsdom',
      include: ['test/**/*.test.tsx', 'test/**/*.test.ts'],
      setupFiles: ['./test/setup.ts'],
    },
  }),
);
