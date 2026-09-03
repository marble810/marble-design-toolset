/**
 * Minimal Catalog store: only successful extractions are published. Keyed by the
 * Host-local catalogEntryId (CatalogSourceRef + projectId), so the same Project ID at
 * multiple Locations never overwrites each other, and Reload replaces only its own Entry.
 */
import type { CatalogEntry } from 'tool-contract';
import {
	evaluateToolDefinition,
	type EvaluateToolDefinitionInput,
	type EvaluateToolDefinitionOutcome
} from './extract.ts';

export class CatalogStore {
	private readonly entries = new Map<string, CatalogEntry>();

	upsert(entry: CatalogEntry): void {
		this.entries.set(entry.catalogEntryId, entry);
	}

	get(catalogEntryId: string): CatalogEntry | undefined {
		return this.entries.get(catalogEntryId);
	}

	has(catalogEntryId: string): boolean {
		return this.entries.has(catalogEntryId);
	}

	list(): CatalogEntry[] {
		return [...this.entries.values()].sort((a, b) => (a.catalogEntryId < b.catalogEntryId ? -1 : 1));
	}
}

interface PublishResult {
	outcome: EvaluateToolDefinitionOutcome;
	published: boolean;
}

/** Evaluate + publish in one step; a failed evaluation never enters the Catalog. */
export function publishToCatalog(store: CatalogStore, input: EvaluateToolDefinitionInput): PublishResult {
	const outcome = evaluateToolDefinition(input);
	if (outcome.ok && outcome.entry !== undefined) {
		store.upsert(outcome.entry);
		return { outcome, published: true };
	}
	return { outcome, published: false };
}