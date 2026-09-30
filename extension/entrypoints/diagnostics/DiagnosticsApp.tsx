// filepath: extension/entrypoints/diagnostics/DiagnosticsApp.tsx
/**
 * The diagnostics page (bead 0h4d.1.7): one click → a copyable, schema-
 * versioned, PII-free report. Nothing is sent anywhere — the user copies it
 * into support. Inputs are gathered from the background (queue, history)
 * and the shared settings store; the pure builder (src/diagnostics/build.ts)
 * assembles and scrubs.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  buildDiagnostics,
  type DiagnosticsReport,
} from '../../src/diagnostics/build';
import { loadSettings } from '../../src/ui/settings/store';

type QueueSnapshot = { rows: Array<{ queued: boolean }>; paused: boolean };
type HistoryRow = { status: string; errorCode?: string };

async function sendMessage<T>(message: Record<string, unknown>): Promise<T | null> {
  const browserApi = (globalThis as { chrome?: { runtime?: { sendMessage?: Function } } }).chrome
    ?.runtime;
  if (!browserApi?.sendMessage) return null;
  return new Promise<T | null>((resolve) => {
    browserApi.sendMessage!(message, (res: T | undefined) => {
      void (globalThis as { chrome?: { runtime?: { lastError?: unknown } } }).chrome?.runtime
        ?.lastError;
      resolve(res ?? null);
    });
  });
}

export function DiagnosticsApp() {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [copied, setCopied] = useState(false);

  const gather = useCallback(async (): Promise<DiagnosticsReport> => {
    const [settings, queue, history] = await Promise.all([
      loadSettings(),
      sendMessage<QueueSnapshot & { ok?: boolean }>({ type: 'CQD_QUEUE_SNAPSHOT' }),
      sendMessage<{ ok?: boolean; rows?: HistoryRow[] }>({ type: 'CQD_HISTORY_GET', query: '' }),
    ]);

    const rows = queue?.rows ?? [];
    const historyRows = history?.rows ?? [];
    const failures = historyRows.filter((r) => r.status === 'failed');
    const counts = new Map<string, number>();
    for (const f of failures) {
      const code = f.errorCode || 'UNKNOWN';
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }

    const browserApi = (globalThis as { chrome?: { runtime?: { getManifest?: Function }; i18n?: { getUILanguage?: Function } } })
      .chrome;
    const version = String(browserApi?.runtime?.getManifest?.()?.version ?? 'unknown');
    const locale = browserApi?.i18n?.getUILanguage?.() ?? navigator.language ?? 'unknown';

    return buildDiagnostics({
      extensionVersion: version,
      userAgent: navigator.userAgent,
      locale,
      engineMode: (settings as { engineMode?: string }).engineMode ?? 'legacy',
      flags: settings,
      queue: {
        active: rows.filter((r) => !r.queued).length,
        queued: rows.filter((r) => r.queued).length,
        paused: !!queue?.paused,
      },
      historyTotal: historyRows.length,
      failureDigest: [...counts.entries()].map(([code, count]) => ({ code, count })),
    });
  }, []);

  const regenerate = useCallback((): void => {
    void gather().then(setReport);
  }, [gather]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const copy = useCallback((): void => {
    if (!report) return;
    void navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [report]);

  const download = useCallback((): void => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cqd-diagnostics-${report.generatedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  return (
    <main className="cqd-diag">
      <header className="cqd-diag-header">
        <h1>Diagnostics</h1>
        <p className="cqd-diag-sub">
          A PII-free report you can paste into a support request. Nothing leaves your machine
          until you copy or download it yourself.
        </p>
      </header>
      <section className="cqd-diag-card" aria-label="Diagnostic report">
        <pre className="cqd-diag-report" data-testid="diag-report">
          {report ? JSON.stringify(report, null, 2) : 'Gathering…'}
        </pre>
      </section>
      <div className="cqd-diag-actions">
        <button type="button" className="cqd-diag-btn cqd-diag-btn-primary" onClick={copy} disabled={!report}>
          {copied ? 'Copied ✓' : 'Copy report'}
        </button>
        <button type="button" className="cqd-diag-btn" onClick={download} disabled={!report}>
          Download .json
        </button>
        <button type="button" className="cqd-diag-btn" onClick={regenerate}>
          Regenerate
        </button>
      </div>
    </main>
  );
}
