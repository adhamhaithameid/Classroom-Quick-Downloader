/**
 * A canvas-confetti stand-in for jsdom: records that a burst fired instead
 * of drawing pixels. Vitest aliases 'canvas-confetti' here; the dev server
 * keeps the real library.
 */

const bursts: number[] = [];

const confetti = Object.assign(
  () => {
    bursts.push(Date.now());
  },
  {
    create() {
      return () => {
        bursts.push(Date.now());
      };
    },
    reset() {
      bursts.length = 0;
    },
  },
);

export default confetti;

export function confettiBurstCount(): number {
  return bursts.length;
}

export function resetConfettiBursts(): void {
  bursts.length = 0;
}
