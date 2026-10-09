// filepath: entrypoints/celebration.content.ts
/**
 * ============================================================================
 * CELEBRATION — milestone overlay on Classroom pages (1.9.1)
 * ============================================================================
 *
 * A dedicated, deliberately small content entrypoint whose entire job is the
 * milestone celebration. It sits idle until the stats record's
 * milestonePending flag appears (chrome.storage.onChanged, the same watch
 * the popup uses), plays ONE page celebration, and hands the clear to the
 * background chain through the existing CQD_STATS_CLEAR_MILESTONE message.
 *
 * Why a separate entrypoint: canvas-confetti and the overlay code stay out
 * of every other content-script bundle — only this file pays for them, and
 * the browser injects only this file on classroom.google.com.
 *
 * Dedupe with the popup (one celebration per milestone across surfaces):
 *  - pending is re-read through the checksummed load path before playing —
 *    a milestone the popup already cleared never plays here;
 *  - after playing, the clear rides the background message (the page never
 *    writes the stats record itself), so the popup's own pending read sees
 *    null and stays quiet — the popup's played-value latch covers the rest;
 *  - a local claimed-value guard collapses concurrent watcher fires for the
 *    same pending into one play, even when storage re-fires the record.
 *
 * Ordering (the popup's lesson): the reduced-motion setting settles BEFORE
 * the stats watcher attaches, so a milestone present at page open is never
 * judged against a default motion-on snapshot.
 */
import {
  loadDownloadStats,
  requestMilestoneClear,
  watchDownloadStats,
  type DownloadStats,
} from '../src/history/download-stats';
import {
  loadSettings,
  watchSettings,
  DEFAULT_SETTINGS,
  type Settings,
} from '../src/ui/settings/store';
import { celebrationUsesConfetti } from '../src/celebration/confetti';
import { showPageCelebration } from '../src/celebration/page-celebration';
import { installReduceMotion } from './content/reduce-motion';

let claimedPending: number | null = null;
let settings: Settings = { ...DEFAULT_SETTINGS };

async function onStats(stats: DownloadStats): Promise<void> {
  const pending = stats.milestonePending;
  if (pending === null || claimedPending === pending) return;
  // Claim synchronously: concurrent watcher fires for the same value
  // collapse here before either reaches the async re-check.
  claimedPending = pending;
  // Re-check before playing: the popup may have cleared the flag between
  // the onChanged dispatch and this read (cross-surface dedupe), or a
  // batch settle may have superseded it with a higher rung.
  const { stats: fresh } = await loadDownloadStats();
  if (fresh.milestonePending !== pending) {
    // Nothing played here — release the claim so a later, higher pending
    // can still celebrate.
    claimedPending = null;
    return;
  }
  showPageCelebration(pending, celebrationUsesConfetti(settings.reducedMotionPreferred));
  // Hand the clear to the background's serialized settle chain — exactly
  // the popup's path, so a settle saving in flight can never be reverted
  // by a stale context write.
  void requestMilestoneClear();
}

async function start(): Promise<void> {
  // Mirror the in-app reduce-motion setting onto <html> so the banner
  // sheet's .cqd-reduce-motion rules hold even when v2_bootstrap never ran
  // (idempotent; cosmetic-only on failure).
  try {
    installReduceMotion();
  } catch {
    // Motion mirror is cosmetic — celebration boot continues.
  }

  settings = await loadSettings();
  watchSettings((patch) => {
    settings = { ...settings, ...patch };
  });
  watchDownloadStats((stats) => {
    void onStats(stats);
  });

  // Initial read, strictly after the settings settle and the watchers'
  // attach: a pending milestone already in the record (the popup was closed
  // when the download finished) celebrates on page open.
  const { stats } = await loadDownloadStats();
  await onStats(stats);
}

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    // Garnish must never break the page: a failed boot is logged, nothing
    // more (same no-dead-ends posture as the v2 bootstrap).
    start().catch((e) => {
      console.error('[CQD Celebration] boot failed (page unaffected):', e);
    });
  },
});
