import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MediaLoader from './MediaLoader.svelte';

describe('MediaLoader (bead 429c)', () => {
  it('never emits an <img> pointing at a video file while a lazy video is unarmed', () => {
    const { body } = render(MediaLoader, {
      props: { type: 'video', src: '/videos/problem.mp4', lazyVideo: true }
    });
    expect(body).not.toMatch(/<img[^>]*mp4/);
    expect(body).not.toContain('problem.mp4');
  });

  it('still renders an <img> for image media', () => {
    const { body } = render(MediaLoader, {
      props: { type: 'image', src: '/images/problem-flags.webp', alt: 'x' }
    });
    expect(body).toMatch(/<img[^>]*problem-flags\.webp/);
  });

  it('renders the <video> element immediately when lazyVideo is off', () => {
    const { body } = render(MediaLoader, {
      props: { type: 'video', src: '/videos/solution.mp4' }
    });
    expect(body).toMatch(/<video/);
  });
});
