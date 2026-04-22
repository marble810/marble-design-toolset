import type {
	LoadedTechStacks,
	TechStackKey,
	TechStackModule,
	TechStackModuleMap
} from '$lib/types/tech-stack';

type TechStackLoaders = {
	[Key in TechStackKey]: () => Promise<TechStackModule<Key>>;
};

type TechStackCache = Partial<{
	[Key in TechStackKey]: Promise<TechStackModuleMap[Key]>;
}>;

const loaders: TechStackLoaders = {
	three: () => import('three'),
	pixi: () => import('pixi.js'),
	gsap: () => import('gsap')
};

const cache: TechStackCache = {};

export function loadTechStack<Key extends TechStackKey>(key: Key): Promise<TechStackModule<Key>> {
	const cached = cache[key];

	if (cached) {
		return cached;
	}

	const pending = loaders[key]();
	cache[key] = pending;
	return pending;
}

export async function loadTechStacks<const Keys extends readonly TechStackKey[] = []>(
	keys?: Keys
): Promise<LoadedTechStacks<Keys>> {
	const requestedKeys = (keys ?? []) as readonly TechStackKey[];
	const resolved = await Promise.all(
		requestedKeys.map(async (key) => [key, await loadTechStack(key)] as const)
	);
	return Object.fromEntries(resolved) as LoadedTechStacks<Keys>;
}