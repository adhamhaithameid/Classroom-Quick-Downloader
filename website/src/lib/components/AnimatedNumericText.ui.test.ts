import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import AnimatedNumericText from './AnimatedNumericText.svelte';

describe('AnimatedNumericText UI rendering', () => {
  it(
    'renders numeric segments as AnimatedNumber wrappers and keeps text segments readable',
    () => {
    const { body } = render(AnimatedNumericText, {
      props: {
        text: 'Saved 0012 files in 3 minutes and 45 seconds',
        useGrouping: false,
        animated: true
      }
    });

    const matches = body.match(/animated-number/g) || [];
    expect(matches.length).toBe(3);
    expect(body).toContain('Saved');
    expect(body).toContain('files in');
    expect(body).toContain('minutes and');
    expect(body).toContain('seconds');
    },
    20000
  );

  it('renders plain text without wrappers when no numeric data is present', () => {
    const { body } = render(AnimatedNumericText, {
      props: {
        text: 'No numeric content here',
        animated: true
      }
    });

    expect(body).toContain('No numeric content here');
    expect(body).not.toContain('animated-number');
  });
});
