import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTechStack, loadTechStacks } from './tech-stack.ts';
import type { TechStackKey, TechStackModule, TechStackModuleMap } from '../types/tech-stack.ts';

type IsExact<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends <Value>() =>
	Value extends Right ? 1 : 2
	? true
	: false;

type Assert<T extends true> = T;

const loadThreeModule = () => loadTechStack('three');
type _SingleKeyInference = Assert<
	IsExact<Awaited<ReturnType<typeof loadThreeModule>>, TechStackModule<'three'>>
>;

const loadLiteralTechStacks = () => loadTechStacks(['pixi', 'gsap'] as const);
type _LiteralBatchInference = Assert<
	IsExact<Awaited<ReturnType<typeof loadLiteralTechStacks>>, Pick<TechStackModuleMap, 'pixi' | 'gsap'>>
>;

const loadDynamicTechStacks = (keys: TechStackKey[]) => loadTechStacks(keys);
type _WidenedBatchFallback = Assert<
	IsExact<Awaited<ReturnType<typeof loadDynamicTechStacks>>, Partial<TechStackModuleMap>>
>;

test('loadTechStack reuses the cached promise for the same key', async () => {
	const firstLoad = loadTechStack('three');
	const secondLoad = loadTechStack('three');

	assert.strictEqual(firstLoad, secondLoad);

	const [firstModule, secondModule] = await Promise.all([firstLoad, secondLoad]);
	assert.strictEqual(firstModule, secondModule);
});

test('loadTechStacks preserves literal keys and reuses cached modules', async () => {
	const pixiLoad = loadTechStack('pixi');
	const modules = await loadTechStacks(['pixi', 'gsap'] as const);

	assert.deepStrictEqual(Object.keys(modules).sort(), ['gsap', 'pixi']);
	assert.strictEqual(modules.pixi, await pixiLoad);
	assert.ok(modules.gsap);
});