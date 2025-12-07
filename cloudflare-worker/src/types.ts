// src/types.ts
// Shared environment bindings for the Worker + Durable Object.

import type { DurableObjectNamespace } from '@cloudflare/workers-types';

export interface Env {
  /**
   * Durable Object namespace, configured in wrangler.toml:
   * [[durable_objects.bindings]]
   * name = "DOWNLOADS_DO"
   * class_name = "DownloadsDurable"
   */
  DOWNLOADS_DO: DurableObjectNamespace;

  /**
   * Optional Oracle backend endpoint for long-term storage.
   * If empty, flushToOracle is effectively disabled.
   */
  ORACLE_ENDPOINT: string;

  /**
   * Optional shared secret header used when calling Oracle.
   */
  DO_SHARED_SECRET: string;

  /**
   * Max buffered events before attempting a flush to Oracle.
   * Comes from wrangler.toml as a string, we parseInt it.
   */
  MAX_BATCH_EVENTS: string;
}
