/**
 * Shared download watchdog contract (V1 student-work and V2 page paths).
 * Both watchdogs arm the same bound and show the same message; the literals
 * used to be duplicated per module and could drift (census, student-work
 * internals).
 */

/** Total silence before a watchdog settles the button to an honest error.
 * The V2 page machine re-arms once at this bound (two stages); the V1
 * student-work machine arms after its resolve phase at the same bound. */
export const DOWNLOAD_WATCHDOG_MS = 45_000;

export const DOWNLOAD_WATCHDOG_MESSAGE = 'Download did not finish in time. Please retry.';
