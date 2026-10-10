// filepath: entrypoints/celebration.content.ts
/**
 * ============================================================================
 * CELEBRATION — milestone overlay on Classroom pages (1.9.1)
 * ============================================================================
 *
 * A dedicated, deliberately small content entrypoint whose entire job is the
 * milestone celebration. It sits idle until the stats record's
 * milestonePending flag appears (chrome.storage.onChanged, the same watch
 * the popup uses), then tries to CLAIM the milestone before playing.
 *
 * Why a separate entrypoint: canvas-confetti and the overlay code stay out
 * of every other content-script bundle — only this file pays for them, and
 * the browser injects only this file on classroom.google.com.
 *
 * Cross-surface dedupe (celebration fix round): the background service
 * worker is the single atomic arbiter. Both surfaces — this page and the
 * popup — send CQD_STATS_CLAIM_CELEBRATION; the handler runs
 * claimMilestonePending (read-and-clear in one turn of the serialized
 * settle chain), so EXACTLY ONE claimant receives { claimed: true,
 * milestone } and plays. There is no read-clear window: with the popup and
 * this page open at the same time, one milestone plays once.
 *
 * No-ack rule: if the claim never acks (dead MV3 channel, hostile
 * background, 1.5s timeout), this page does NOT play and does NOT write —
 * there is no local fallback. Playing unclaimed risks a double celebration;
 * missing one celebration on a dead channel is acceptable and replays on
 * the next page open. The page never writes the stats record: the only
 * write happens inside the background's claim handler.
 *
 * Ordering (the popup's lesson): the reduced-motion setting settles BEFORE
 * the stats watcher attaches, so a milestone present at page open is never
 * judged against a default motion-on snapshot.
 */
import {
  loadDownloadStats,
  claimMilestoneCelebration,
  watchDownloadStats,
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

let settings: Settings = { ...DEFAULT_SETTINGS };
/** Dismiss fn of the banner currently up, so a new milestone replaces it. */
let dismissCurrent: (() => void) | null = null;

/**
 * Claim, then play only on a won claim. The pending hint only gates WHEN we
 * ask (every settle writes the record — claiming on every onChanged would
 * message the worker per download in a batch storm); WHO plays is decided
 * by the ack alone.
 */
async function claimAndPlay(): Promise<void> {
  const claim = await claimMilestoneCelebration();
  if (!claim.ok || !claim.claimed || claim.milestone === null) return;
  // A new milestone replaces the banner that is still up.
  dismissCurrent?.();
  dismissCurrent = showPageCelebration(
    claim.milestone,
    celebrationUsesConfetti(settings.reducedMotionPreferred),
  );
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
    if (stats.milestonePending !== null) void claimAndPlay();
  });

  // Initial read, strictly after the settings settle and the watchers'
  // attach: a pending milestone already in the record (no surface was open
  // when the download finished) claims and plays on page open.
  const { stats } = await loadDownloadStats();
  if (stats.milestonePending !== null) await claimAndPlay();
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
