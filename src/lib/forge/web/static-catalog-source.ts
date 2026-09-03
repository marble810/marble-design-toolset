/**
 * Web static Catalog source: fetches the build-time generated catalog.json (see
 * scripts/web-catalog) and exposes the same Catalog Entry interface the Desktop source
 * adapter will provide. Entries are re-validated on load; an invalid generated entry is
 * skipped with a diagnostic instead of poisoning the usable Catalog.
 */
import { validateCatalogEntry, type CatalogEntry, type Diagnostic } from 'tool-contract';

export interface StaticCatalogFile {
	version: number;
	source: { kind: 'web'; sourceId: string };
	entries: CatalogEntry[];
}

export interface StaticCatalogSourceOptions {
	/** Injectable fetch for deterministic tests; defaults to global fetch. */
	fetchImpl?: typeof fetch;
	/** Base URL for resolving relative catalog URLs; defaults to the current document. */
	baseHref?: string;
}

export interface ResolvedArtifactUrls {
	main: string;
	slate?: string;
}

export class StaticCatalogSource {
	readonly url: string;
	private readonly fetchImpl: typeof fetch;
	private readonly baseHref: string;
	private readonly entries = new Map<string, CatalogEntry>();
	private readonly loadDiagnostics: Diagnostic[] = [];
	private catalogUrl: URL | undefined;
	private sourceId = 'bundled';

	constructor(url: string, options?: StaticCatalogSourceOptions) {
		this.url = url;
		this.fetchImpl = options?.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
		this.baseHref =
			options?.baseHref ??
			(typeof self !== 'undefined' && typeof self.location?.href === 'string' ? self.location.href : 'https://deshelf.invalid/');
	}

	async load(): Promise<void> {
		const response = await this.fetchImpl(this.url);
		if (!response.ok) {
			throw new Error(`static catalog could not be loaded (${response.status}): ${this.url}`);
		}
		const file = (await response.json()) as StaticCatalogFile;
		if (file === null || typeof file !== 'object' || !Array.isArray(file.entries)) {
			throw new Error('static catalog file is malformed: entries array missing');
		}
		this.sourceId = typeof file.source?.sourceId === 'string' ? file.source.sourceId : 'bundled';
		this.entries.clear();
		this.loadDiagnostics.length = 0;
		this.catalogUrl = new URL(this.url, this.baseHref);
		for (const raw of file.entries) {
			const validation = validateCatalogEntry(raw);
			if (!validation.ok) {
				this.loadDiagnostics.push(
					...validation.diagnostics.map((d) => ({
						...d,
						message: `invalid static Catalog Entry skipped: ${d.message}`
					}))
				);
				continue;
			}
			this.entries.set(validation.value.catalogEntryId, validation.value);
		}
	}

	list(): CatalogEntry[] {
		return [...this.entries.values()].sort((a, b) => (a.catalogEntryId < b.catalogEntryId ? -1 : 1));
	}

	get(catalogEntryId: string): CatalogEntry | undefined {
		return this.entries.get(catalogEntryId);
	}

	get sourceRef(): { kind: 'web'; sourceId: string } {
		return { kind: 'web', sourceId: this.sourceId };
	}

	getDiagnostics(): readonly Diagnostic[] {
		return this.loadDiagnostics;
	}

	/** Resolves entry-relative artifact references against the catalog.json URL. */
	resolveArtifactUrls(entry: CatalogEntry): ResolvedArtifactUrls {
		if (this.catalogUrl === undefined) throw new Error('static catalog source is not loaded');
		const base = this.catalogUrl;
		const main = new URL(entry.artifacts.main, base).toString();
		const slate = entry.artifacts.slate !== undefined ? new URL(entry.artifacts.slate, base).toString() : undefined;
		return { main, ...(slate !== undefined ? { slate } : {}) };
	}
}
