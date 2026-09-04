import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	defineInspectorCallback,
	createInspectorContext,
	collectInspectorElements,
	type InspectorContext
} from '../src/index.ts';

function makeContext() {
	return createInspectorContext({
		parameters: {
			amplitude: { type: 'number', label: 'Amplitude', default: 0.5, mode: 'manual', constraint: { type: 'number', min: 0, max: 1 } },
			invert: { type: 'boolean', label: 'Invert', default: false, mode: 'manual', constraint: { type: 'boolean' } }
		},
		assets: {
			initMap: { kind: 'image', label: 'Init Map' }
		},
		commands: {
			resetView: { label: 'Reset View', run() {} }
		},
		privateCallbacks: {
			resimulate: defineInspectorCallback({ run() {} })
		}
	});
}

test('context derives typed handles with stable IDs from map keys', () => {
	const ctx = makeContext() as InspectorContext;
	assert.equal(ctx.parameters.amplitude.__deshelfParameterId, 'amplitude');
	assert.equal(ctx.assets.initMap.__deshelfAssetId, 'initMap');
	assert.equal(ctx.commands.resetView.__deshelfCommandId, 'resetView');
	assert.equal(ctx.privateCallbacks.resimulate.__deshelfCallbackId, 'resimulate');
});

test('callback definitions and typed handles are distinct objects; handles never carry run', () => {
	const ctx = makeContext() as InspectorContext;
	const handle = ctx.privateCallbacks.resimulate as { __deshelfCallbackId: string; run?: unknown };
	assert.equal(handle.__deshelfCallbackId, 'resimulate');
	assert.equal('run' in handle, false, 'the handle must not expose the Main-only run implementation');
	// The map value inside the Tool Entry is the definition, which retains run:
	const definitions = {
		resimulate: defineInspectorCallback({ run() {} })
	};
	assert.notEqual(handle, definitions.resimulate, 'handle and definition must be distinct objects');
	assert.equal(typeof (definitions.resimulate as { run?: unknown }).run, 'function');
});

test('inspector builders produce serializable elements with typed bindings', () => {
	const ctx = makeContext() as InspectorContext;
	ctx.root.section('src', 'Source', (r) => {
		r.slider({ id: 'amp', label: 'Amplitude', bind: ctx.parameters.amplitude });
		r.toggle({ id: 'inv', label: 'Invert', bind: ctx.parameters.invert });
	});
	ctx.root.button({ id: 'resim', label: 'Resimulate', bind: ctx.privateCallbacks.resimulate });
	ctx.root.button({ id: 'reset', label: 'Reset View', bind: ctx.commands.resetView });

	const elements = collectInspectorElements(ctx);
	assert.deepEqual(elements, [
		{
			kind: 'section',
			id: 'src',
			title: 'Source',
			children: [
				{ kind: 'slider', id: 'amp', label: 'Amplitude', binding: { kind: 'parameter', parameterId: 'amplitude' } },
				{ kind: 'toggle', id: 'inv', label: 'Invert', binding: { kind: 'parameter', parameterId: 'invert' } }
			]
		},
		{ kind: 'button', id: 'resim', label: 'Resimulate', binding: { kind: 'private-callback', callbackId: 'resimulate' } },
		{ kind: 'button', id: 'reset', label: 'Reset View', binding: { kind: 'command', commandId: 'resetView' } }
	]);
});

test('binding an inline anonymous callback is rejected', () => {
	const ctx = makeContext() as InspectorContext;
	// @ts-expect-error inline anonymous callbacks are forbidden by the SDK contract
	assert.throws(() => ctx.root.button({ id: 'b', label: 'B', bind: () => {} }), /typed handle/);
});

test('binding an undeclared/undefined handle is rejected', () => {
	const ctx = makeContext() as InspectorContext;
	// @ts-expect-error nonexistent handle resolves to undefined at runtime
	assert.throws(() => ctx.root.button({ id: 'b', label: 'B', bind: ctx.privateCallbacks.nonexistent }), /typed handle/);
});

test('binding a raw value to a slider is rejected', () => {
	const ctx = makeContext() as InspectorContext;
	// @ts-expect-error a raw id string is not a typed parameter handle
	assert.throws(() => ctx.root.slider({ id: 's', label: 'S', bind: 'amplitude' }), /typed handle/);
});

test('visibleWhen rules are carried onto the built elements', () => {
	const ctx = makeContext() as InspectorContext;
	ctx.root.section(
		'preset',
		'Preset',
		(r) => {
			r.slider({
				id: 'amp',
				label: 'Amplitude',
				bind: ctx.parameters.amplitude,
				visibleWhen: { parameterId: 'invert', equals: [false] }
			});
		},
		{ visibleWhen: { parameterId: 'invert', equals: false } }
	);
	ctx.root.label('hint', 'hidden when inverted', { visibleWhen: { parameterId: 'invert', equals: false } });
	ctx.root.button({
		id: 'resim',
		label: 'Resimulate',
		bind: ctx.privateCallbacks.resimulate,
		visibleWhen: { parameterId: 'invert', equals: false }
	});

	const elements = collectInspectorElements(ctx);
	assert.equal(elements[0].kind, 'section');
	assert.deepEqual((elements[0] as { visibleWhen?: unknown }).visibleWhen, { parameterId: 'invert', equals: false });
	const child = (elements[0] as { children: Array<Record<string, unknown>> }).children[0] as Record<string, unknown>;
	assert.deepEqual(child.visibleWhen, { parameterId: 'invert', equals: [false] });
	assert.deepEqual((elements[1] as { visibleWhen?: unknown }).visibleWhen, { parameterId: 'invert', equals: false });
	assert.deepEqual((elements[2] as { visibleWhen?: unknown }).visibleWhen, { parameterId: 'invert', equals: false });
});
