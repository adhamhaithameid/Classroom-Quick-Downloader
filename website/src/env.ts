import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Explicit public environment variables (SvelteKit 3).
 *
 * Every var is optional at the source level: config.ts applies the canonical
 * fallbacks itself, so each schema just passes the raw string through.
 */
const passThrough = (value: string | undefined): string | undefined => value;

export const variables = defineEnvVars({
  PUBLIC_SITE_URL: { public: true, schema: passThrough },
  PUBLIC_API_BASE_URL: { public: true, schema: passThrough },
  PUBLIC_ORACLE_API_BASE_URL: { public: true, schema: passThrough },
  PUBLIC_WORKER_BASE_URL: { public: true, schema: passThrough },
  PUBLIC_SITE_BACKEND_BASE_URL: { public: true, schema: passThrough },
  PUBLIC_APP_VERSION: { public: true, schema: passThrough },
  PUBLIC_ENABLE_FEEDBACK_NAV: { public: true, schema: passThrough },
  PUBLIC_GOOGLE_SITE_VERIFICATION: { public: true, schema: passThrough },
  PUBLIC_BING_SITE_VERIFICATION: { public: true, schema: passThrough },
  PUBLIC_INDEXNOW_KEY: { public: true, schema: passThrough }
});
