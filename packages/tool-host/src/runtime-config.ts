/**
 * Deshelf Runtime Config: Host-owned defaults for session startup, Tool Command
 * execution, cancel grace and computed scheduling. Web/Desktop apps may override any
 * value; tests inject smaller values through the same seam.
 */

export interface DeshelfRuntimeConfig {
	/** Startup timeout from `boot` until Canvas `surface.ready`. */
	startupTimeoutMs: number;
	/** Tool Command (and private callback) timeout before cancel is sent. */
	commandTimeoutMs: number;
	/** Grace window after cancel; if the callback still does not end, health becomes Unresponsive. */
	cancelGraceMs: number;
	/** Timeout for a Host-scheduled `parameter.compute` round trip. */
	computeTimeoutMs: number;
}

export const DEFAULT_RUNTIME_CONFIG: DeshelfRuntimeConfig = {
	startupTimeoutMs: 10_000,
	commandTimeoutMs: 10_000,
	cancelGraceMs: 2_000,
	computeTimeoutMs: 5_000
};

export function resolveRuntimeConfig(partial?: Partial<DeshelfRuntimeConfig>): DeshelfRuntimeConfig {
	return { ...DEFAULT_RUNTIME_CONFIG, ...partial };
}