export type TechStackModuleMap = {
	three: typeof import('three');
	pixi: typeof import('pixi.js');
	gsap: typeof import('gsap');
};

export type TechStackKey = keyof TechStackModuleMap;

export type TechStackModule<K extends TechStackKey> = TechStackModuleMap[K];

export type LoadedTechStacks<Keys extends readonly TechStackKey[]> = number extends Keys['length']
	? Partial<TechStackModuleMap>
	: { [Key in Keys[number]]: TechStackModuleMap[Key] };