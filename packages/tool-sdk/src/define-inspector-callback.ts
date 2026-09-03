/**
 * Inspector private callback definitions: the author registers Main-only callbacks in
 * the Tool Entry `privateCallbacks` map through `defineInspectorCallback`. The definition
 * object RETAINS the `run` implementation (it lives in the Main artifact), while the
 * typed handles handed to `createInspector` are separate, function-free objects derived
 * from the map keys. Catalogue extraction keeps only `{ id }` descriptors.
 */
export interface InspectorCallback<Args extends readonly unknown[] = readonly unknown[], R = unknown> {
	readonly __deshelfCallbackTag: 'inspector-callback';
	/** Main-only implementation; never serialized into a Catalog Entry. */
	run(...args: Args): R;
}

export function defineInspectorCallback<Args extends readonly unknown[], R>(
	definition: { run: (...args: Args) => R }
): InspectorCallback<Args, R> {
	if (definition === null || typeof definition !== 'object' || typeof definition.run !== 'function') {
		throw new TypeError('defineInspectorCallback requires a run function');
	}
	return { __deshelfCallbackTag: 'inspector-callback', run: definition.run };
}