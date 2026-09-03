/**
 * Shared diagnostic + result types for Deshelf contract validation.
 */

export interface Diagnostic {
	severity: 'error' | 'warning';
	code: string;
	message: string;
	path?: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; diagnostics: readonly Diagnostic[] };

export function ok<T>(value: T): Result<T> {
	return { ok: true, value };
}

export function fail<T = never>(diagnostics: readonly Diagnostic[]): Result<T> {
	return { ok: false, diagnostics };
}

export function error(code: string, message: string, path?: string): Diagnostic {
	return { severity: 'error', code, message, path };
}
