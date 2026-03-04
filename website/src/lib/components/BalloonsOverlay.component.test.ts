import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import BalloonsOverlay from './BalloonsOverlay.svelte';
import type { BalloonParticle } from '$lib/celebration/balloons';

function particle(id: number): BalloonParticle {
  return {
    id,
    x: 100 + id,
    y: 200 + id,
    vx: 1,
    vy: -10,
    size: 48,
    depth: 1,
    rotation: 0,
    spinVelocity: 3,
    scale: 1,
    baseScale: 1,
    opacity: 1,
    launchDelay: 0,
    buoyancy: -20,
    drag: 0.001,
    windStrength: 10,
    windFrequency: 0.1,
    windPhase: 0,
    wobbleAmplitude: 5,
    wobbleFrequency: 0.9,
    wobblePhase: 0,
    stringLength: 24,
    color: '#1d9bf0',
    accentColor: '#5bbcf5',
    shadowColor: '#1667a0',
    stringColor: '#335d7b',
    simpleGradients: false
  };
}

describe('BalloonsOverlay component', () => {
  it('renders one SVG balloon per particle when visible', () => {
    const { body } = render(BalloonsOverlay, {
      props: {
        visible: true,
        particles: [particle(1), particle(2)],
        idPrefix: 'test-bday'
      }
    });

    const balloonMatches = body.match(/l2-balloon-wrap/g) || [];
    expect(balloonMatches).toHaveLength(2);
    expect(body).toContain('test-bday-fill-1');
    expect(body).toContain('test-bday-string-2');
    expect(body).toContain('stroke-linecap="round"');
  });

  it('renders nothing when hidden', () => {
    const { body } = render(BalloonsOverlay, {
      props: {
        visible: false,
        particles: [particle(1)]
      }
    });

    expect(body).not.toContain('l2-balloon-fullscreen');
    expect(body).not.toContain('<svg');
  });

  it('renders nothing when no particles are provided', () => {
    const { body } = render(BalloonsOverlay, {
      props: {
        visible: true,
        particles: []
      }
    });

    expect(body).not.toContain('l2-balloon-fullscreen');
    expect(body).not.toContain('<svg');
  });
});
