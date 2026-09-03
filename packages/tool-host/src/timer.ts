/**
 * Timer seam: deterministic tests replace the default setTimeout/clearTimeout with a
 * manual clock, so timeout-driven transitions (startup Failed, command cancel grace,
 * Unresponsive health) are asserted exactly.
 */

export interface Timer {
	/** Schedules a callback after `ms`; the returned function cancels it. */
	schedule(callback: () => void, ms: number): () => void;
}

export const defaultTimer: Timer = {
	schedule(callback: () => void, ms: number): () => void {
		const id = setTimeout(callback, ms);
		return () => clearTimeout(id);
	}
};