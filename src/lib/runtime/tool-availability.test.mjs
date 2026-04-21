import assert from 'node:assert/strict';
import test from 'node:test';

import { filterEnabledTools, sanitizeWorkspaceToolSelection } from './tool-availability.js';

test('filterEnabledTools keeps missing enabled as true and removes disabled tools', () => {
	const catalog = [
		{ id: 'hello-world', name: 'Hello World', desc: 'Demo', tag: ['demo'], version: '1.0.0' },
		{
			id: 'hidden-tool',
			name: 'Hidden Tool',
			desc: 'Disabled demo',
			tag: ['demo'],
			version: '1.0.0',
			enabled: false
		},
		{ id: 'three-cube', name: 'Three Cube', desc: '3D demo', tag: ['3d'], version: '1.0.0', enabled: true }
	];

	assert.deepStrictEqual(
		filterEnabledTools(catalog).map((tool) => tool.id),
		['hello-world', 'three-cube']
	);
});

test('sanitizeWorkspaceToolSelection removes disabled tool ids from restored state', () => {
	assert.deepStrictEqual(
		sanitizeWorkspaceToolSelection(
			{
				openToolIds: ['hello-world', 'hidden-tool'],
				activeToolId: 'hidden-tool'
			},
			['hello-world']
		),
		{
			openToolIds: ['hello-world'],
			activeToolId: 'hello-world'
		}
	);
});

test('sanitizeWorkspaceToolSelection clears active tool when nothing valid remains', () => {
	assert.deepStrictEqual(
		sanitizeWorkspaceToolSelection(
			{
				openToolIds: ['hidden-tool'],
				activeToolId: 'hidden-tool'
			},
			[]
		),
		{
			openToolIds: [],
			activeToolId: null
		}
	);
});