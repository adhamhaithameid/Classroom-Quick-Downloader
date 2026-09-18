/* Pure motion math for the magnetic CTA effect, split from the DOM action so
   it can be unit-tested without a browser. The action in
   src/lib/actions/magnetic.ts owns listeners, rects, and style writes; this
   module only answers "where should the button be right now".

   Feel is locked to the approved "Subtle" prototype: a smoothstep falloff
   inside `radius` beyond the button edge, pull proportional to
   cursor-to-center offset, hard-clamped to `maxShift`, followed by a
   near-critically damped spring (damping 30 > critical ~2*sqrt(170), so the
   glide never overshoots). */

export interface MagneticParams {
	/** Attraction distance beyond the button edge, in px. */
	radius: number;
	/** Fraction of the cursor-to-center offset the button chases. */
	strength: number;
	/** Spring stiffness (1/s²). */
	stiffness: number;
	/** Spring damping (1/s). */
	damping: number;
	/** Hard clamp on translation magnitude, in px. */
	maxShift: number;
}

export interface RectLike {
	left: number;
	top: number;
	right: number;
	bottom: number;
	width: number;
	height: number;
}

export interface SpringState {
	x: number;
	y: number;
	vx: number;
	vy: number;
}

/** Approved "Subtle" prototype feel. Do not tweak per page; change here once. */
export const MAGNETIC_DEFAULTS: MagneticParams = {
	radius: 70,
	strength: 0.22,
	stiffness: 170,
	damping: 30,
	maxShift: 6
};

/** Settle threshold in px (and px/s): below this the loop snaps to rest. */
export const SETTLE_EPS = 0.05;

/** Distance from a point to the rect (0 when the point is inside). */
export function edgeDistance(rect: RectLike, px: number, py: number): number {
	const dx = Math.max(rect.left - px, 0, px - rect.right);
	const dy = Math.max(rect.top - py, 0, py - rect.bottom);
	return Math.hypot(dx, dy);
}

/**
 * Where the button should sit while the cursor is at (px, py): the
 * strength-scaled offset toward the cursor, smoothstepped to zero at the
 * radius edge and clamped to maxShift. engaged is false beyond the radius.
 */
export function pullTarget(
	rect: RectLike,
	px: number,
	py: number,
	params: MagneticParams
): { x: number; y: number; engaged: boolean } {
	const dist = edgeDistance(rect, px, py);
	if (dist >= params.radius) return { x: 0, y: 0, engaged: false };
	const cx = rect.left + rect.width / 2;
	const cy = rect.top + rect.height / 2;
	const t = 1 - dist / params.radius;
	const eased = t * t * (3 - 2 * t);
	let x = (px - cx) * params.strength * eased;
	let y = (py - cy) * params.strength * eased;
	const mag = Math.hypot(x, y);
	if (mag > params.maxShift) {
		x = (x / mag) * params.maxShift;
		y = (y / mag) * params.maxShift;
	}
	return { x, y, engaged: true };
}

/** Semi-implicit Euler spring toward (tx, ty); dt in seconds, already clamped. */
export function springStep(
	s: SpringState,
	target: { x: number; y: number },
	params: MagneticParams,
	dt: number
): SpringState {
	const ax = -params.stiffness * (s.x - target.x) - params.damping * s.vx;
	const ay = -params.stiffness * (s.y - target.y) - params.damping * s.vy;
	return {
		x: s.x + (s.vx + ax * dt) * dt,
		y: s.y + (s.vy + ay * dt) * dt,
		vx: s.vx + ax * dt,
		vy: s.vy + ay * dt
	};
}

/** True when a disengaged button has effectively come to rest at zero. */
export function isSettled(
	s: SpringState,
	target: { x: number; y: number },
	engaged: boolean
): boolean {
	return (
		!engaged &&
		Math.abs(s.x - target.x) < SETTLE_EPS &&
		Math.abs(s.y - target.y) < SETTLE_EPS &&
		Math.abs(s.vx) < SETTLE_EPS &&
		Math.abs(s.vy) < SETTLE_EPS
	);
}
