// filepath: entrypoints/popup/MilestoneCelebration.tsx
/**
 * 1.9.0 confetti, commit 2 — milestone celebration surface.
 *
 * The background cannot render, so celebration lives here: on mount and on
 * every stats-record change the component looks at milestonePending, plays
 * ONE confetti burst (skipped entirely under the reduced-motion double gate
 * — OS query OR the in-app setting), shows an aria-live=polite toast, and
 * clears the pending flag so the same milestone never plays twice. The
 * confetti canvas is aria-hidden; keyboard behavior is untouched.
 *
 * Ordering guarantee: the reduced-motion setting loads BEFORE the first play
 * decision — a popup opened straight onto a pending milestone never bursts
 * because the settings read lost the race.
 */
import { useEffect, useRef, useState } from 'react';
import {
  formatMilestoneCount,
  levelFor,
  loadDownloadStats,
  requestMilestoneClear,
  watchDownloadStats,
} from '../../src/history/download-stats';
import { celebrationUsesConfetti, fireConfettiBurst } from '../../src/celebration/confetti';
import { loadSettings, watchSettings, DEFAULT_SETTINGS, type Settings } from '../../src/ui/settings/store';

const TOAST_DISMISS_MS = 4000;

export function MilestoneCelebration() {
  const [toast, setToast] = useState<number | null>(null);
  const playedPendingRef = useRef<number | null>(null);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);

  function applyPending(pending: number | null): void {
    if (pending === null) return;
    // One play per pending value, even if storage re-fires the same record.
    if (playedPendingRef.current === pending) return;
    playedPendingRef.current = pending;
    if (celebrationUsesConfetti(settingsRef.current.reducedMotionPreferred)) {
      void fireConfettiBurst();
    }
    setToast(pending);
    // Hand the milestone off through the background message: the clear runs
    // on the service worker's serialized settle chain, so it can never
    // revert an in-flight settle write. The popup never touches the record.
    void requestMilestoneClear();
  }

  // Initial read, strictly ordered: settings settle FIRST, then the stats
  // watcher attaches, then the pending check runs. A milestone landing in
  // the pre-settings window is picked up by the post-settings read — it can
  // never be evaluated against the mount-time default (motion-on) snapshot.
  useEffect(() => {
    let alive = true;
    let unwatchStats: (() => void) | undefined;
    void (async () => {
      const settings = await loadSettings();
      if (!alive) return;
      settingsRef.current = settings;
      unwatchStats = watchDownloadStats((stats) => {
        applyPending(stats.milestonePending);
      });
      const { stats } = await loadDownloadStats();
      if (!alive) return;
      applyPending(stats.milestonePending);
    })();
    return () => {
      alive = false;
      unwatchStats?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live settings watcher: keeps the reduced-motion gate current after the
  // initial load (the stats watcher lives in the ordered effect above).
  useEffect(() => {
    const unwatchSettings = watchSettings((patch) => {
      settingsRef.current = { ...settingsRef.current, ...patch };
    });
    return () => {
      unwatchSettings();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), TOAST_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (toast === null) return null;
  return (
    <div className="cqd-milestone-toast" role="status" aria-live="polite">
      <span className="cqd-milestone-toast-tick" aria-hidden="true">
        ✓
      </span>
      <span>
        {/* Every rung is a level (levelFor): the toast names it. */}
        {toast === 1
          ? 'Level 1 reached — first file downloaded!'
          : `Level ${levelFor(toast)} reached — ${formatMilestoneCount(toast)} files!`}
      </span>
    </div>
  );
}
