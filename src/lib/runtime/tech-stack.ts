import type { TechStackKey } from '$lib/types/tool';

const loaders: Record<TechStackKey, () => Promise<unknown>> = {
	three: () => import('three'),
	pixi: () => import('pixi.js'),
	gsap: () => import('gsap')
};

const cache = new Map<TechStackKey, Promise<unknown>>();

export function loadTechStack(key: TechStackKey): Promise<unknown> {
	const cached = cache.get(key);

	if (cached) {
		return cached;
	}

	const pending = loaders[key]();
	cache.set(key, pending);
	return pending;
}

export async function loadTechStacks(keys: TechStackKey[] = []): Promise<Partial<Record<TechStackKey, unknown>>> {
	const resolved = await Promise.all(keys.map(async (key) => [key, await loadTechStack(key)] as const));
	return Object.fromEntries(resolved);
}