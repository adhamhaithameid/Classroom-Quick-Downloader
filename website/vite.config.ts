import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: '404.html',
				precompress: false,
				strict: true
			}),
			// kit 3 narrows base to '' | `/${string}`; PUBLIC_BASE_PATH is
			// operator-provided and must start with a slash when set.
			paths: {
				base: (process.env.PUBLIC_BASE_PATH || '') as '' | `/${string}`
			},
			prerender: {
				handleHttpError: 'warn',
				handleMissingId: 'warn',
				handleUnseenRoutes: 'warn'
			}
		})
	],
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		testTimeout: 60000,
		hookTimeout: 60000
	}
});
