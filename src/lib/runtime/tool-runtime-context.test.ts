import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createToolMenuActionContext,
	dispatchToolMenuAction,
	type ToolRuntimeContextValue
} from './tool-runtime-context.ts';
import type { ToolDefinition, ToolMetadata } from '$lib/types/tool';

const metadata: ToolMetadata = {
	name: 'Example Tool',
	desc: 'Example description.',
	tag: ['example'],
	version: '1.0.0'
};

function createContext(): ToolRuntimeContextValue {
	return {
		toolId: 'example-tool',
		metadata,
		isActive: () => true,
		menuActions: [{ id: 'reset', label: 'Reset' }],
		declaredTechStacks: ['pixi'],
		loadedTechStacks: {},
		getLoadedTechStack: () => undefined,
		dispatchMenuAction: () => {}
	};
}

test('createToolMenuActionContext exposes runtime identity and service values', () => {
	const context = createToolMenuActionContext(createContext());

	assert.equal(context.toolId, 'example-tool');
	assert.equal(context.metadata.name, 'Example Tool');
	assert.equal(context.isActive(), true);
	assert.deepEqual(context.declaredTechStacks, ['pixi']);
	assert.equal(context.getLoadedTechStack('pixi'), undefined);
});

test('dispatchToolMenuAction invokes definition handler with runtime context', () => {
	let receivedAction = '';
	let receivedToolId = '';
	const definition: ToolDefinition = {
		metadata,
		menuActions: [{ id: 'reset', label: 'Reset' }],
		onMenuAction: (actionId, context) => {
			receivedAction = actionId;
			receivedToolId = context.toolId;
		},
		loadComponent: async () => ({ default: {} as never })
	};

	dispatchToolMenuAction(definition, createContext(), 'reset');

	assert.equal(receivedAction, 'reset');
	assert.equal(receivedToolId, 'example-tool');
});

test('dispatchToolMenuAction is a no-op when no handler exists', () => {
	const definition: ToolDefinition = {
		metadata,
		menuActions: [{ id: 'reset', label: 'Reset' }],
		loadComponent: async () => ({ default: {} as never })
	};

	assert.doesNotThrow(() => dispatchToolMenuAction(definition, createContext(), 'reset'));
	assert.doesNotThrow(() => dispatchToolMenuAction(null, createContext(), 'reset'));
});