import { WORKER_BASE_URL } from '$lib/config';
import type { ChangelogResponse, ChangelogConfig, ChangelogMeta, ChangelogNotificationRule } from '$lib/types/public';

const REQUEST_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function coerceChangelogPayload(input: unknown): ChangelogResponse {
  const source = input as Partial<ChangelogResponse>;
  const entries = Array.isArray(source?.entries)
    ? source.entries
        .map((entry) => {
          const raw = entry as ChangelogResponse['entries'][number];
          const id = typeof raw?.id === 'string' ? raw.id : '';
          const version = typeof raw?.version === 'string' ? raw.version : '';
          const date = typeof raw?.date === 'string' ? raw.date : '';
          const changes = Array.isArray(raw?.changes)
            ? raw.changes.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
            : [];
          if (!id || !version || !date) return null;
          return {
            id,
            version,
            date,
            changes,
            isImportant: raw.isImportant === true
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : [];

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return {
    ok: source?.ok === true,
    entries
  };
}

export async function fetchChangelog(): Promise<ChangelogResponse> {
  const response = await withTimeout(fetch(`${WORKER_BASE_URL}/changelog`), REQUEST_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Changelog request failed (${response.status})`);
  }
  const payload = await response.json();
  return coerceChangelogPayload(payload);
}
