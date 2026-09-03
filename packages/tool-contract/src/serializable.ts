/**
 * Deep serializability check: a Catalog Entry MUST NOT contain functions, DOM nodes,
 * Svelte components, Framework Library objects, symbols, bigints or cycles.
 */
import type { Diagnostic } from './diagnostics.ts';
import { error } from './diagnostics.ts';

export function collectSerializationDiagnostics(
	value: unknown,
	diagnostics: Diagnostic[],
	path = 'root',
	seen = new Set<object>()
): Diagnostic[] {
	if (value === null) return diagnostics;
	if (value === undefined) {
		diagnostics.push(error('serialization/undefined', `${path} is undefined; undefined is not JSON-safe in a Catalog Entry`, path));
		return diagnostics;
	}

	const t = typeof value;
	if (t === 'function') {
		diagnostics.push(
			error('serialization/function', `${path} is a function; callbacks must stay in the Main artifact`, path)
		);
		return diagnostics;
	}
	if (t === 'symbol') {
		diagnostics.push(error('serialization/unsupported', `${path} is a symbol`, path));
		return diagnostics;
	}
	if (t === 'bigint') {
		diagnostics.push(error('serialization/unsupported', `${path} is a bigint`, path));
		return diagnostics;
	}
	if (t === 'number') {
		if (!Number.isFinite(value)) {
			diagnostics.push(error('serialization/non-finite', `${path} is not a finite number`, path));
		}
		return diagnostics;
	}
	if (t !== 'object') return diagnostics;

	const obj = value as object;
	if (seen.has(obj)) {
		diagnostics.push(error('serialization/cycle', `${path} is cyclic`, path));
		return diagnostics;
	}
	seen.add(obj);

	if (Array.isArray(obj)) {
		for (let i = 0; i < obj.length; i++) {
			collectSerializationDiagnostics(obj[i], diagnostics, `${path}[${i}]`, seen);
		}
	} else {
		const proto = Object.getPrototypeOf(obj);
		if (proto !== Object.prototype && proto !== null) {
			const ctor = (proto as { constructor?: { name?: string } })?.constructor;
			diagnostics.push(
				error(
					'serialization/prototype',
					`${path} is not a plain object (prototype: ${ctor?.name ?? 'null'}); DOM/Svelte/library objects are not allowed in a Catalog Entry`,
					path
				)
			);
		} else {
			for (const k of Object.keys(obj)) {
				const child = (obj as Record<string, unknown>)[k];
				if (child === undefined) {
					diagnostics.push(
						error('serialization/undefined', `${path}.${k} is undefined; undefined is not JSON-safe in a Catalog Entry`, `${path}.${k}`)
					);
				}
				collectSerializationDiagnostics(child, diagnostics, `${path}.${k}`, seen);
			}
		}
	}

	seen.delete(obj);
	return diagnostics;
}

export function assertSerializable(value: unknown): Diagnostic[] {
	return collectSerializationDiagnostics(value, []);
}
