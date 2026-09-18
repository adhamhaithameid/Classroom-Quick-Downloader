import { describe, expect, it } from 'vitest';
import {
	MAGNETIC_DEFAULTS,
	edgeDistance,
	isSettled,
	pullTarget,
	springStep
} from './magneticField';

const RECT = { left: 100, top: 50, right: 300, bottom: 100, width: 200, height: 50 };

describe('edgeDistance', () => {
	it('is zero anywhere inside the rect', () => {
		expect(edgeDistance(RECT, 200, 75)).toBe(0);
		expect(edgeDistance(RECT, 100, 50)).toBe(0);
		expect(edgeDistance(RECT, 300, 100)).toBe(0);
	});

	it('measures distance to the nearest edge', () => {
		expect(edgeDistance(RECT, 90, 75)).toBe(10);
		expect(edgeDistance(RECT, 200, 120)).toBe(20);
	});

	it('measures corner distance with hypot', () => {
		expect(edgeDistance(RECT, 90, 40)).toBeCloseTo(Math.hypot(10, 10));
	});
});

describe('pullTarget', () => {
	const P = MAGNETIC_DEFAULTS;

	it('does not pull when the cursor is beyond the radius', () => {
		const far = pullTarget(RECT, 100 + 200 / 2, 50 - (P.radius + 1), P);
		expect(far.engaged).toBe(false);
		expect(far.x).toBe(0);
		expect(far.y).toBe(0);
	});

	it('engages inside the rect and just outside it', () => {
		expect(pullTarget(RECT, 200, 75, P).engaged).toBe(true);
		expect(pullTarget(RECT, 100 - 10, 75, P).engaged).toBe(true);
	});

	it('pulls toward the cursor, centered cursor pulls zero', () => {
		const at = pullTarget(RECT, 200, 75, P);
		expect(at.x).toBeCloseTo(0);
		expect(at.y).toBeCloseTo(0);

		// Cursor right of center: pull is positive-x, under the strength fraction.
		const right = pullTarget(RECT, 299, 75, P);
		expect(right.x).toBeGreaterThan(0);
		expect(right.x).toBeLessThanOrEqual((99 * P.strength) + 1e-6);
	});

	it('pull grows as the cursor approaches, then clamps at maxShift', () => {
		const near = pullTarget(RECT, 290, 75, P);
		const center = pullTarget(RECT, 200, 75, P);
		expect(Math.hypot(near.x, near.y)).toBeGreaterThan(Math.hypot(center.x, center.y));

		// A cursor far past the center on a big rect would exceed maxShift
		// without the clamp; strength 1 params make that reachable.
		const big = { radius: 70, strength: 1, stiffness: 170, damping: 30, maxShift: 6 };
		const clamped = pullTarget(RECT, 290, 75, big);
		expect(Math.hypot(clamped.x, clamped.y)).toBeCloseTo(6, 5);
	});

	it('pull is zero exactly at the radius edge (smoothstep reaches 0)', () => {
		const edge = pullTarget(RECT, 200, 50 - P.radius, P);
		expect(edge.engaged).toBe(false);
		expect(edge.y).toBe(0);
	});
});

describe('springStep', () => {
	const P = MAGNETIC_DEFAULTS;

	it('moves toward the target', () => {
		const s0 = { x: 0, y: 0, vx: 0, vy: 0 };
		const s1 = springStep(s0, { x: 10, y: 0 }, P, 1 / 60);
		expect(s1.x).toBeGreaterThan(0);
		expect(s1.vx).toBeGreaterThan(0);
	});

	it('converges to the target and stays there', () => {
		let s = { x: 0, y: 0, vx: 0, vy: 0 };
		for (let i = 0; i < 2000; i++) s = springStep(s, { x: 4, y: -2 }, P, 1 / 60);
		expect(s.x).toBeCloseTo(4, 3);
		expect(s.y).toBeCloseTo(-2, 3);
		expect(s.vx).toBeCloseTo(0, 3);
		expect(s.vy).toBeCloseTo(0, 3);
	});

	it('does not overshoot at the locked-in damping', () => {
		// Locked-in feel: damping 30 > critical ~2*sqrt(170) ≈ 26, so the glide
		// must never cross the target.
		let s = { x: 0, y: 0, vx: 0, vy: 0 };
		let maxOvershoot = 0;
		for (let i = 0; i < 600; i++) {
			s = springStep(s, { x: 6, y: 0 }, P, 1 / 60);
			maxOvershoot = Math.max(maxOvershoot, s.x - 6);
		}
		expect(maxOvershoot).toBeLessThanOrEqual(0);
	});
});

describe('isSettled', () => {
	it('settles only when disengaged and all motion is under eps', () => {
		expect(isSettled({ x: 0, y: 0, vx: 0, vy: 0 }, { x: 0, y: 0 }, false)).toBe(true);
		expect(isSettled({ x: 0.5, y: 0, vx: 0, vy: 0 }, { x: 0, y: 0 }, false)).toBe(false);
		expect(isSettled({ x: 0, y: 0, vx: 0, vy: 0 }, { x: 3, y: 0 }, false)).toBe(false);
		expect(isSettled({ x: 0, y: 0, vx: 0, vy: 0 }, { x: 0, y: 0 }, true)).toBe(false);
	});
});
