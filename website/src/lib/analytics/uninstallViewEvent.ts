/**
 * W3: the uninstall page emits one lifecycle event on mount so the stats
 * piggybacked on the uninstall URL (d/a params) reach the warehouse even when
 * the user never clicks reinstall. Pure builder — the page supplies parsed
 * params; this module owns the payload shape.
 */

import type { WebsiteEventAction, WebsiteEventType, WebsiteEventPayload } from '$lib/types/public';

type UninstallViewEvent = Omit<WebsiteEventPayload, 'tsUtc'> & { pagePath: string };

function generateEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `wue-${Date.now()}-${crypto.randomUUID()}`;
    }
  } catch {
    // Fall through to the non-crypto fallback.
  }
  return `wue-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function buildUninstallViewEvent(input: {
  stats: { downloads: number; attempts: number };
  context: { source: string; browser: string; version: string };
}): UninstallViewEvent & { eventType: WebsiteEventType; action: WebsiteEventAction } {
  return {
    eventId: generateEventId(),
    eventType: 'content',
    action: 'uninstall_view',
    placement: 'uninstall_page',
    pagePath: '/uninstall',
    meta: {
      downloads: input.stats.downloads,
      attempts: input.stats.attempts,
      source: input.context.source,
      browser: input.context.browser,
      version: input.context.version
    }
  };
}
