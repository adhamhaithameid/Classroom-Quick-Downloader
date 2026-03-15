import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html',
			precompress: false,
			strict: true
		}),
		paths: {
			base: process.env.PUBLIC_BASE_PATH || ''
		},
		prerender: {
			handleHttpError: 'warn',
			handleMissingId: 'warn',
			handleUnseenRoutes: 'warn'
		}
	}
};

export default config;
