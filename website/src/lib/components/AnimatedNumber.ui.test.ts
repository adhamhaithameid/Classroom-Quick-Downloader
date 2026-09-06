import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import AnimatedNumber from './AnimatedNumber.svelte';

describe('AnimatedNumber SSR rendering', () => {
  it('renders the final value during server render so prerendered HTML is complete', () => {
    const { body } = render(AnimatedNumber, {
      props: { value: 30, format: { useGrouping: false }, animated: true }
    });

    expect(body).toContain('>30<');
    expect(body).not.toContain('>0<');
  });

  it('renders suffixes around the final value', () => {
    const { body } = render(AnimatedNumber, {
      props: { value: 100, format: { useGrouping: false }, suffix: '+', animated: true }
    });

    expect(body).toContain('>100+<');
  });

  it('renders initialValue instead of the final value when provided', () => {
    const { body } = render(AnimatedNumber, {
      props: { value: 12, initialValue: 3, animated: true }
    });

    expect(body).toContain('>3<');
    expect(body).not.toContain('>12<');
  });
});
