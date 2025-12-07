// src/types.ts

export interface Env {
  // Durable Object namespace binding from wrangler.toml
  DOWNLOADS_DO: DurableObjectNamespace;

  // Step 2: used when you connect to Oracle
  ORACLE_ENDPOINT?: string;
  DO_SHARED_SECRET?: string;

  // Optional override; if absent, code uses 10,000
  MAX_BATCH_EVENTS?: string;
}