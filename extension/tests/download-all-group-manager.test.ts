import { describe, expect, it } from 'vitest';
import { getCanonicalFileKey } from '../src/download-all/group-manager';

describe('download-all/group-manager getCanonicalFileKey', () => {
  it('prefers explicit cqdFileKey when present', () => {
    const button = document.createElement('button');
    button.dataset.cqdFileKey = 'https://classroom.google.com/g/tg/a/b/c::attachment-1';
    button.dataset.cqdUrl = 'https://drive.google.com/uc?export=download&id=FILE123';

    expect(getCanonicalFileKey(button)).toBe('https://classroom.google.com/g/tg/a/b/c::attachment-1');
  });

  it('falls back to drive ID from cqdUrl', () => {
    const button = document.createElement('button');
    button.dataset.cqdUrl = 'https://drive.google.com/uc?export=download&id=FILE123';

    expect(getCanonicalFileKey(button)).toBe('drive-id-FILE123');
  });

  it('falls back to name/ext when URL is missing', () => {
    const button = document.createElement('button');
    button.dataset.cqdName = 'worksheet';
    button.dataset.cqdExt = 'pdf';

    expect(getCanonicalFileKey(button)).toBe('worksheet::pdf');
  });
});

