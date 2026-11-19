// filepath: extension/tests/v2-engine-rediscover-keys.test.ts
/**
 * Review final #5: with no carried-over API files (flag OFF) a re-scan must
 * not compute a Drive key per rediscovered file, and the output must stay
 * the rediscovered files unchanged.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const keyCalls = vi.hoisted(() => ({ n: 0 }));

vi.mock('../src/engines/canonical-id', async () => {
  const actual = await vi.importActual<typeof import('../src/engines/canonical-id')>('../src/engines/canonical-id');
  return {
    ...actual,
    driveFileKeys: (f: Parameters<typeof actual.driveFileKeys>[0]) => {
      keyCalls.n += 1;
      return actual.driveFileKeys(f);
    },
  };
});

import { EngineV2 } from '../src/engines/v2/engine-v2';
import { createFileAnchorScorer } from '../src/v2/selectors/selector-registry';

describe('EngineV2 re-scan: no key work without carried API files', () => {
  beforeEach(() => {
    keyCalls.n = 0;
    document.body.innerHTML = `
      <div data-stream-item-id="p1">
        <article>
          <div data-attachment-id="d1">
            <a aria-label="Attachment: a.pdf" href="https://docs.google.com/document/d/DOCID123/edit">a.pdf</a>
          </div>
        </article>
      </div>`;
  });

  it('ingestPost computes zero keys when nothing is kept and still lists the files', () => {
    const engine = new EngineV2();
    const postEl = document.querySelector('[data-stream-item-id="p1"]') as HTMLElement;
    const priv = engine as unknown as {
      fileScorer: unknown;
      ingestPost: (el: HTMLElement) => string;
      postMap: Map<string, { files: unknown[] }>;
    };
    priv.fileScorer = createFileAnchorScorer();
    priv.ingestPost(postEl);
    priv.ingestPost(postEl);
    expect(priv.postMap.get('p1')!.files).toHaveLength(1);
    expect(keyCalls.n).toBe(0);
  });
});
