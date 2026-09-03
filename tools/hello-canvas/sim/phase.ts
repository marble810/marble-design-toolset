/**
 * Hello Canvas simulation state: module-level animation phase living in the Main
 * artifact realm. Never serialized into the Catalog; never crosses the Environment API.
 */
let phase = 0;

export function advancePhase(amount: number): void {
	phase = (phase + amount) % (Math.PI * 2);
}

export function currentPhase(): number {
	return phase;
}

export function resetPhase(): void {
	phase = 0;
}
