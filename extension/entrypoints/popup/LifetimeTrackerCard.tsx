// filepath: entrypoints/popup/LifetimeTrackerCard.tsx
/**
 * 1.9.0 confetti, commit 3 — lifetime download tracker card.
 *
 * Stillwater-styled card in the popup's analytics/history area. Reads the
 * stats record on mount and live through the storage watch. States:
 * zero downloads ("Download your first file to start the count"), progress
 * toward the next rung ("37 to 100 files"), and the post-final legend state
 * past 1,000,000. Big counts use compact notation ("1M"); the toast's tick
 * carries the reached state (commit 2).
 */
import { useEffect, useState } from 'react';
import {
  formatMilestoneCount,
  loadDownloadStats,
  nextMilestone,
  watchDownloadStats,
  type DownloadStats,
} from '../../src/history/download-stats';

const FINAL_MILESTONE = 1_000_000;

export function LifetimeTrackerCard() {
  const [stats, setStats] = useState<DownloadStats | null>(null);

  useEffect(() => {
    let alive = true;
    void loadDownloadStats().then(({ stats: s }) => {
      if (alive) setStats(s);
    });
    const unwatch = watchDownloadStats((s) => {
      if (alive) setStats(s);
    });
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  const count = stats?.lifetimeCount ?? 0;
  const loaded = stats !== null;
  // Between the zero state and the final rung the next rung always exists.
  const next = loaded && count > 0 && count < FINAL_MILESTONE ? nextMilestone(count) : null;
  const percent = next !== null ? Math.min(100, Math.round((count / next) * 100)) : 100;

  return (
    <section className="cqd-panel" aria-label="Lifetime downloads">
      <div className="cqd-card cqd-lifetime-card">
        <div className="cqd-lifetime-head">
          <span className="cqd-lifetime-title">Lifetime downloads</span>
          <span className="cqd-lifetime-count">{formatMilestoneCount(count)}</span>
        </div>
        {!loaded || count === 0 ? (
          <p className="cqd-lifetime-empty">Download your first file to start the count</p>
        ) : next === null ? (
          <p className="cqd-lifetime-progress">
            {count.toLocaleString('en-US')} files — legend
          </p>
        ) : (
          <p className="cqd-lifetime-progress">
            {formatMilestoneCount(next - count)} to {formatMilestoneCount(next)} files
          </p>
        )}
        {next !== null ? (
          <div className="cqd-lifetime-bar" aria-hidden="true">
            <span className="cqd-lifetime-bar-fill" style={{ width: `${percent}%` }} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
