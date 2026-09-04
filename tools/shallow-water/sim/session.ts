/**
 * Realm-scoped binding between the Canvas and the Tool Entry callbacks.
 *
 * The container realm (iframe / WebContents) exists for exactly one Session, so a
 * module-scoped holder here is per-Session by construction: Reload/Restart replace the
 * realm and therefore the binding. This is NOT a runtime registration mechanism — the
 * Tool Entry stays static and side-effect-free; the Canvas merely publishes the runtime
 * it owns so `outputs`/`privateCallbacks`/`commands` (which run outside the Svelte
 * component) can reach the same simulation state.
 */
import type { ShallowWaterRuntime } from './runtime.ts';

let activeRuntime: ShallowWaterRuntime | null = null;

/** Publishes the Canvas-owned runtime; passing null clears the binding. */
export function bindSessionRuntime(runtime: ShallowWaterRuntime | null): void {
	activeRuntime = runtime;
}

/** The Canvas-owned runtime, or null before the Canvas mounted / after dispose. */
export function getActiveSessionRuntime(): ShallowWaterRuntime | null {
	return activeRuntime;
}

/** Throws the shared "simulation not running" error for callback call sites. */
export function requireActiveSessionRuntime(): ShallowWaterRuntime {
	if (activeRuntime === null) {
		throw new Error('simulation canvas is not mounted');
	}
	return activeRuntime;
}
