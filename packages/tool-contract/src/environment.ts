/**
 * Environment API: the lightweight management interface between Deshelf Host and Tool
 * Containers. Web and Desktop share this TypeScript discriminated union and its runtime
 * schemas; only the transport adapter is replaced.
 *
 * This is a management plane, NOT a Capability/ACL security protocol: no hello/welcome,
 * nonce, endpointId, per-message sequence, message ACL or fixed payload limits.
 * Function, DOM nodes, Svelte components, Framework Library objects, simulation state
 * and Canvas pixels MUST NOT cross this seam. Startups only use `boot` request →
 * `surface.ready` event; endpoint role comes from the transport channel, not the message.
 */
import { error, fail, ok, type Diagnostic, type Result } from './diagnostics.ts';

export const ENVIRONMENT_PROTOCOL_VERSION = 1 as const;
export type EnvironmentProtocolVersion = typeof ENVIRONMENT_PROTOCOL_VERSION;

export type EnvironmentEndpointRole = 'main' | 'slate';
export type SurfaceKind = 'canvas' | 'slate';
export type EnvironmentMessageKind = 'request' | 'response' | 'event';

export type ParameterValue = number | boolean | string;

/**
 * Parameter state at a point in time. `revision` is the store-wide monotonic counter;
 * `revisions` carries the per-parameter revision used by `parameter.set`'s
 * `expectedRevision` guard (multi-parameter coalesced flushes must not conflict).
 */
export interface ParameterSnapshot {
	revision: number;
	values: Record<string, ParameterValue>;
	revisions: Record<string, number>;
}

/**
 * Asset content delivered through an environment adapter. Web adapters may hand back a
 * blob URL; Desktop adapters return an opaque handle — real filesystem paths MUST NOT
 * cross the seam. Binary payloads never travel inside the envelope itself.
 */
export type AssetContent =
	| { kind: 'blob-url'; mime: string; url: string }
	| { kind: 'opaque'; mime?: string; handle: string }
	| { kind: 'empty' };

export interface AssetSnapshot {
	values: Record<string, AssetContent | null>;
}

/** Adapters the current environment can actually supply (empty when not available). */
export interface EnvironmentInventory {
	assets: readonly string[];
	exports: readonly string[];
}

export interface BootSurface {
	kind: SurfaceKind;
	width: number;
	height: number;
}

export interface BootPayload {
	endpoint: EnvironmentEndpointRole;
	parameters: ParameterSnapshot;
	assets: AssetSnapshot;
	surface: BootSurface;
	inventory: EnvironmentInventory;
}

export interface SurfaceReadyPayload {
	endpoint: EnvironmentEndpointRole;
	surface: SurfaceKind;
}

export interface SurfaceResizePayload {
	width: number;
	height: number;
}

export interface SurfaceDisposePayload {
	reason: string;
}

export interface ParameterSnapshotRequestPayload {
	snapshot: ParameterSnapshot;
}

export interface ParameterSnapshotResponsePayload {
	ok: true;
}

export interface ParameterChangedPayload {
	id: string;
	value: ParameterValue;
	revision: number;
}

export interface ParameterSetRequestPayload {
	id: string;
	value: ParameterValue;
	expectedRevision: number;
}

export type ParameterSetResponsePayload =
	| { accepted: true; id: string; value: ParameterValue; revision: number }
	| { accepted: false; id: string; diagnostic: Diagnostic };

/** Computed parameters are Host-scheduled; the Main Container only runs short callbacks. */
export interface ParameterComputeRequestPayload {
	ids: readonly string[];
	dependencies: ParameterSnapshot;
}

export interface ParameterComputeResponsePayload {
	values: Record<string, ParameterValue>;
	diagnostics?: readonly Diagnostic[];
}

export interface CommandExecutePayload {
	commandId: string;
	invocationId: string;
}

export interface CommandCancelPayload {
	invocationId: string;
}

export interface CommandResultPayload {
	invocationId: string;
	ok: boolean;
	error?: Diagnostic;
}

export interface AssetRequestPayload {
	assetId: string;
}

export interface AssetResponsePayload {
	assetId: string;
	content: AssetContent;
}

export interface AssetChangedPayload {
	assetId: string;
	content: AssetContent;
}

export interface ExportExecutePayload {
	outputId: string;
	invocationId: string;
}

/**
 * Exported Visual Output content handed back through `export.result`. Only serializable
 * references cross the seam (Web blob URL, Desktop opaque handle) — real filesystem
 * paths and raw pixels never travel in the envelope. Same shape as AssetContent.
 */
export type ExportContent = AssetContent;

export interface ExportResultPayload {
	invocationId: string;
	ok: boolean;
	error?: Diagnostic;
	/** Present when ok and the environment adapter produced content. */
	content?: ExportContent;
}

export interface DiagnosticEmitPayload {
	diagnostic: Diagnostic;
}

export const ENVIRONMENT_MESSAGE_NAMES = [
	'boot',
	'surface.ready',
	'surface.resize',
	'surface.dispose',
	'parameter.snapshot',
	'parameter.changed',
	'parameter.set',
	'parameter.compute',
	'command.execute',
	'command.cancel',
	'command.result',
	'asset.request',
	'asset.changed',
	'export.execute',
	'export.result',
	'diagnostic.emit'
] as const;

export type EnvironmentMessageName = (typeof ENVIRONMENT_MESSAGE_NAMES)[number];

export type EnvironmentMessagePayload =
	| BootPayload
	| SurfaceReadyPayload
	| SurfaceResizePayload
	| SurfaceDisposePayload
	| ParameterSnapshotRequestPayload
	| ParameterSnapshotResponsePayload
	| ParameterChangedPayload
	| ParameterSetRequestPayload
	| ParameterSetResponsePayload
	| ParameterComputeRequestPayload
	| ParameterComputeResponsePayload
	| CommandExecutePayload
	| CommandCancelPayload
	| CommandResultPayload
	| AssetRequestPayload
	| AssetResponsePayload
	| AssetChangedPayload
	| ExportExecutePayload
	| ExportResultPayload
	| DiagnosticEmitPayload;

export interface EnvironmentEnvelope {
	protocolVersion: EnvironmentProtocolVersion;
	sessionId: string;
	kind: EnvironmentMessageKind;
	name: EnvironmentMessageName;
	/** Correlation only for request/response pairing; never a per-message sequence. */
	requestId?: string;
	payload: EnvironmentMessagePayload;
}

export function createEnvironmentEnvelope(opts: {
	sessionId: string;
	kind: EnvironmentMessageKind;
	name: EnvironmentMessageName;
	requestId?: string;
	payload: unknown;
}): EnvironmentEnvelope {
	return {
		protocolVersion: ENVIRONMENT_PROTOCOL_VERSION,
		sessionId: opts.sessionId,
		kind: opts.kind,
		name: opts.name,
		...(opts.requestId !== undefined ? { requestId: opts.requestId } : {}),
		payload: opts.payload as EnvironmentMessagePayload
	};
}

// ---------------------------------------------------------------------------
// Runtime schema validators
// ---------------------------------------------------------------------------

type PayloadValidator = (input: unknown, path: string, diagnostics: Diagnostic[]) => unknown;

function isRecord(input: unknown): input is Record<string, unknown> {
	return input !== null && typeof input === 'object' && !Array.isArray(input);
}

function vString(input: unknown, path: string, diagnostics: Diagnostic[]): string | undefined {
	if (typeof input !== 'string') {
		diagnostics.push(error('env/payload', `${path} must be a string`, path));
		return undefined;
	}
	return input;
}

function vNonEmptyString(input: unknown, path: string, diagnostics: Diagnostic[]): string | undefined {
	const s = vString(input, path, diagnostics);
	if (s !== undefined && s.length === 0) {
		diagnostics.push(error('env/payload', `${path} must not be empty`, path));
		return undefined;
	}
	return s;
}

function vFiniteNumber(input: unknown, path: string, diagnostics: Diagnostic[]): number | undefined {
	if (typeof input !== 'number' || !Number.isFinite(input)) {
		diagnostics.push(error('env/payload', `${path} must be a finite number`, path));
		return undefined;
	}
	return input;
}

function vBoolean(input: unknown, path: string, diagnostics: Diagnostic[]): boolean | undefined {
	if (typeof input !== 'boolean') {
		diagnostics.push(error('env/payload', `${path} must be a boolean`, path));
		return undefined;
	}
	return input;
}

function vDiagnostic(input: unknown, path: string, diagnostics: Diagnostic[]): Diagnostic | undefined {
	if (!isRecord(input)) {
		diagnostics.push(error('env/payload', `${path} must be a diagnostic object`, path));
		return undefined;
	}
	if (input.severity !== 'error' && input.severity !== 'warning') {
		diagnostics.push(error('env/payload', `${path}.severity must be 'error' or 'warning'`, `${path}.severity`));
		return undefined;
	}
	if (typeof input.code !== 'string' || input.code.length === 0) {
		diagnostics.push(error('env/payload', `${path}.code must be a non-empty string`, `${path}.code`));
		return undefined;
	}
	if (typeof input.message !== 'string' || input.message.length === 0) {
		diagnostics.push(error('env/payload', `${path}.message must be a non-empty string`, `${path}.message`));
		return undefined;
	}
	return {
		severity: input.severity,
		code: input.code as string,
		message: input.message as string,
		...(input.path !== undefined ? { path: vString(input.path, `${path}.path`, diagnostics) as string } : {})
	};
}

function vParameterValue(input: unknown, path: string, diagnostics: Diagnostic[]): ParameterValue | undefined {
	if (typeof input === 'number' && Number.isFinite(input)) return input;
	if (typeof input === 'boolean') return input;
	if (typeof input === 'string') return input;
	diagnostics.push(error('env/payload', `${path} must be a number, boolean or string`, path));
	return undefined;
}

function vParameterSnapshot(input: unknown, path: string, diagnostics: Diagnostic[]): ParameterSnapshot | undefined {
	if (!isRecord(input)) {
		diagnostics.push(error('env/payload', `${path} must be a ParameterSnapshot object`, path));
		return undefined;
	}
	const revision = vFiniteNumber(input.revision, `${path}.revision`, diagnostics);
	if (typeof input.values !== 'object' || input.values === null || Array.isArray(input.values)) {
		diagnostics.push(error('env/payload', `${path}.values must be an object map`, `${path}.values`));
		return undefined;
	}
	const values: Record<string, ParameterValue> = {};
	for (const key of Object.keys(input.values)) {
		const value = vParameterValue((input.values as Record<string, unknown>)[key], `${path}.values.${key}`, diagnostics);
		if (value !== undefined) values[key] = value;
	}
	let revisions: Record<string, number> = {};
	if (typeof input.revisions !== 'object' || input.revisions === null || Array.isArray(input.revisions)) {
		diagnostics.push(error('env/payload', `${path}.revisions must be an object map`, `${path}.revisions`));
	} else {
		revisions = {};
		for (const key of Object.keys(input.revisions)) {
			const rev = vFiniteNumber((input.revisions as Record<string, unknown>)[key], `${path}.revisions.${key}`, diagnostics);
			if (rev !== undefined) revisions[key] = rev;
		}
	}
	if (revision === undefined) return undefined;
	return { revision, values, revisions };
}

function vAssetContent(input: unknown, path: string, diagnostics: Diagnostic[]): AssetContent | undefined {
	if (!isRecord(input)) {
		diagnostics.push(error('env/payload', `${path} must be an AssetContent object`, path));
		return undefined;
	}
	const kind = vString(input.kind, `${path}.kind`, diagnostics);
	if (kind === undefined) return undefined;
	if (kind === 'blob-url') {
		const mime = vString(input.mime, `${path}.mime`, diagnostics);
		const url = vString(input.url, `${path}.url`, diagnostics);
		if (mime === undefined || url === undefined) return undefined;
		return { kind, mime, url };
	}
	if (kind === 'opaque') {
		const handle = vNonEmptyString(input.handle, `${path}.handle`, diagnostics);
		if (handle === undefined) return undefined;
		return {
			kind,
			...(input.mime !== undefined ? { mime: vString(input.mime, `${path}.mime`, diagnostics) as string } : {}),
			handle
		};
	}
	if (kind === 'empty') return { kind: 'empty' };
	diagnostics.push(error('env/payload', `${path}.kind must be 'blob-url', 'opaque' or 'empty'`, `${path}.kind`));
	return undefined;
}

function vAssetSnapshot(input: unknown, path: string, diagnostics: Diagnostic[]): AssetSnapshot | undefined {
	if (!isRecord(input)) {
		diagnostics.push(error('env/payload', `${path} must be an AssetSnapshot object`, path));
		return undefined;
	}
	if (typeof input.values !== 'object' || input.values === null || Array.isArray(input.values)) {
		diagnostics.push(error('env/payload', `${path}.values must be an object map`, `${path}.values`));
		return undefined;
	}
	const values: Record<string, AssetContent | null> = {};
	for (const key of Object.keys(input.values)) {
		const raw = (input.values as Record<string, unknown>)[key];
		if (raw === null) {
			values[key] = null;
			continue;
		}
		const content = vAssetContent(raw, `${path}.values.${key}`, diagnostics);
		if (content !== undefined) values[key] = content;
	}
	return { values };
}

function vInventory(input: unknown, path: string, diagnostics: Diagnostic[]): EnvironmentInventory | undefined {
	if (!isRecord(input)) {
		diagnostics.push(error('env/payload', `${path} must be an EnvironmentInventory object`, path));
		return undefined;
	}
	const list = (field: string): readonly string[] | undefined => {
		const raw = input[field];
		if (!Array.isArray(raw) || !raw.every((item) => typeof item === 'string')) {
			diagnostics.push(error('env/payload', `${path}.${field} must be a string array`, `${path}.${field}`));
			return undefined;
		}
		return raw as readonly string[];
	};
	const assets = list('assets');
	const exports = list('exports');
	if (assets === undefined || exports === undefined) return undefined;
	return { assets, exports };
}

function vValues(input: unknown, path: string, diagnostics: Diagnostic[]): Record<string, ParameterValue> | undefined {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		diagnostics.push(error('env/payload', `${path} must be an object map`, path));
		return undefined;
	}
	const out: Record<string, ParameterValue> = {};
	for (const key of Object.keys(input)) {
		const value = vParameterValue((input as Record<string, unknown>)[key], `${path}.${key}`, diagnostics);
		if (value !== undefined) out[key] = value;
	}
	return out;
}

const MESSAGE_SCHEMAS: Record<
	EnvironmentMessageName,
	{ request?: PayloadValidator; response?: PayloadValidator; event?: PayloadValidator }
> = {
	boot: {
		request(input, path, diagnostics): BootPayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const endpoint = vEndpoint(input.endpoint, `${path}.endpoint`, diagnostics);
			const parameters = vParameterSnapshot(input.parameters, `${path}.parameters`, diagnostics);
			const assets = vAssetSnapshot(input.assets, `${path}.assets`, diagnostics);
			const inventory = vInventory(input.inventory, `${path}.inventory`, diagnostics);
			if (!isRecord(input.surface)) {
				diagnostics.push(error('env/payload', `${path}.surface must be an object`, `${path}.surface`));
				return undefined;
			}
			const surfaceKind = vSurfaceKind((input.surface as Record<string, unknown>).kind, `${path}.surface.kind`, diagnostics);
			const width = vFiniteNumber((input.surface as Record<string, unknown>).width, `${path}.surface.width`, diagnostics);
			const height = vFiniteNumber((input.surface as Record<string, unknown>).height, `${path}.surface.height`, diagnostics);
			if (endpoint === undefined || parameters === undefined || assets === undefined || inventory === undefined ||
				surfaceKind === undefined || width === undefined || height === undefined) {
				return undefined;
			}
			return { endpoint, parameters, assets, surface: { kind: surfaceKind, width, height }, inventory };
		}
	},
	'surface.ready': {
		event(input, path, diagnostics): SurfaceReadyPayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const endpoint = vEndpoint(input.endpoint, `${path}.endpoint`, diagnostics);
			const surface = vSurfaceKind(input.surface, `${path}.surface`, diagnostics);
			if (endpoint === undefined || surface === undefined) return undefined;
			return { endpoint, surface };
		}
	},
	'surface.resize': {
		event(input, path, diagnostics): SurfaceResizePayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const width = vFiniteNumber(input.width, `${path}.width`, diagnostics);
			const height = vFiniteNumber(input.height, `${path}.height`, diagnostics);
			if (width === undefined || height === undefined) return undefined;
			return { width, height };
		}
	},
	'surface.dispose': {
		event(input, path, diagnostics): SurfaceDisposePayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const reason = vNonEmptyString(input.reason, `${path}.reason`, diagnostics);
			if (reason === undefined) return undefined;
			return { reason };
		}
	},
	'parameter.snapshot': {
		request(input, path, diagnostics): ParameterSnapshotRequestPayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const snapshot = vParameterSnapshot(input.snapshot, `${path}.snapshot`, diagnostics);
			if (snapshot === undefined) return undefined;
			return { snapshot };
		},
		response(input, path, diagnostics): ParameterSnapshotResponsePayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			if (input.ok !== true) {
				diagnostics.push(error('env/payload', `${path}.ok must be true`, `${path}.ok`));
				return undefined;
			}
			return { ok: true };
		}
	},
	'parameter.changed': {
		event(input, path, diagnostics): ParameterChangedPayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const id = vNonEmptyString(input.id, `${path}.id`, diagnostics);
			const value = vParameterValue(input.value, `${path}.value`, diagnostics);
			const revision = vFiniteNumber(input.revision, `${path}.revision`, diagnostics);
			if (id === undefined || value === undefined || revision === undefined) return undefined;
			return { id, value, revision };
		}
	},
	'parameter.set': {
		request(input, path, diagnostics): ParameterSetRequestPayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const id = vNonEmptyString(input.id, `${path}.id`, diagnostics);
			const value = vParameterValue(input.value, `${path}.value`, diagnostics);
			const expectedRevision = vFiniteNumber(input.expectedRevision, `${path}.expectedRevision`, diagnostics);
			if (id === undefined || value === undefined || expectedRevision === undefined) return undefined;
			return { id, value, expectedRevision };
		},
		response(input, path, diagnostics): ParameterSetResponsePayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const id = vNonEmptyString(input.id, `${path}.id`, diagnostics);
			if (id === undefined) return undefined;
			if (input.accepted === true) {
				const value = vParameterValue(input.value, `${path}.value`, diagnostics);
				const revision = vFiniteNumber(input.revision, `${path}.revision`, diagnostics);
				if (value === undefined || revision === undefined) return undefined;
				return { accepted: true, id, value, revision };
			}
			if (input.accepted === false) {
				const diagnostic = vDiagnostic(input.diagnostic, `${path}.diagnostic`, diagnostics);
				if (diagnostic === undefined) return undefined;
				return { accepted: false, id, diagnostic };
			}
			diagnostics.push(error('env/payload', `${path}.accepted must be true or false`, `${path}.accepted`));
			return undefined;
		}
	},
	'parameter.compute': {
		request(input, path, diagnostics): ParameterComputeRequestPayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const ids = input.ids;
			if (!Array.isArray(ids) || !ids.every((i) => typeof i === 'string' && i.length > 0)) {
				diagnostics.push(error('env/payload', `${path}.ids must be a string array`, `${path}.ids`));
				return undefined;
			}
			const dependencies = vParameterSnapshot(input.dependencies, `${path}.dependencies`, diagnostics);
			if (dependencies === undefined) return undefined;
			return { ids: ids as readonly string[], dependencies };
		},
		response(input, path, diagnostics): ParameterComputeResponsePayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const values = vValues(input.values, `${path}.values`, diagnostics);
			if (values === undefined) return undefined;
			let diag: Diagnostic[] | undefined;
			if (input.diagnostics !== undefined) {
				if (!Array.isArray(input.diagnostics)) {
					diagnostics.push(error('env/payload', `${path}.diagnostics must be an array`, `${path}.diagnostics`));
					return undefined;
				}
				diag = [];
				for (let i = 0; i < input.diagnostics.length; i++) {
					const d = vDiagnostic(input.diagnostics[i], `${path}.diagnostics[${i}]`, diagnostics);
					if (d !== undefined) diag.push(d);
				}
			}
			return { values, ...(diag !== undefined && diag.length > 0 ? { diagnostics: diag } : {}) };
		}
	},
	'command.execute': {
		request(input, path, diagnostics): CommandExecutePayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const commandId = vNonEmptyString(input.commandId, `${path}.commandId`, diagnostics);
			const invocationId = vNonEmptyString(input.invocationId, `${path}.invocationId`, diagnostics);
			if (commandId === undefined || invocationId === undefined) return undefined;
			return { commandId, invocationId };
		}
	},
	'command.cancel': {
		request(input, path, diagnostics): CommandCancelPayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const invocationId = vNonEmptyString(input.invocationId, `${path}.invocationId`, diagnostics);
			if (invocationId === undefined) return undefined;
			return { invocationId };
		}
	},
	'command.result': {
		event(input, path, diagnostics): CommandResultPayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const invocationId = vNonEmptyString(input.invocationId, `${path}.invocationId`, diagnostics);
			const ok = vBoolean(input.ok, `${path}.ok`, diagnostics);
			if (invocationId === undefined || ok === undefined) return undefined;
			return {
				invocationId,
				ok,
				...(input.error !== undefined ? { error: vDiagnostic(input.error, `${path}.error`, diagnostics) as Diagnostic } : {})
			};
		}
	},
	'asset.request': {
		request(input, path, diagnostics): AssetRequestPayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const assetId = vNonEmptyString(input.assetId, `${path}.assetId`, diagnostics);
			if (assetId === undefined) return undefined;
			return { assetId };
		},
		response(input, path, diagnostics): AssetResponsePayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const assetId = vNonEmptyString(input.assetId, `${path}.assetId`, diagnostics);
			const content = vAssetContent(input.content, `${path}.content`, diagnostics);
			if (assetId === undefined || content === undefined) return undefined;
			return { assetId, content };
		}
	},
	'asset.changed': {
		event(input, path, diagnostics): AssetChangedPayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const assetId = vNonEmptyString(input.assetId, `${path}.assetId`, diagnostics);
			const content = vAssetContent(input.content, `${path}.content`, diagnostics);
			if (assetId === undefined || content === undefined) return undefined;
			return { assetId, content };
		}
	},
	'export.execute': {
		request(input, path, diagnostics): ExportExecutePayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const outputId = vNonEmptyString(input.outputId, `${path}.outputId`, diagnostics);
			const invocationId = vNonEmptyString(input.invocationId, `${path}.invocationId`, diagnostics);
			if (outputId === undefined || invocationId === undefined) return undefined;
			return { outputId, invocationId };
		}
	},
	'export.result': {
		event(input, path, diagnostics): ExportResultPayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const invocationId = vNonEmptyString(input.invocationId, `${path}.invocationId`, diagnostics);
			const ok = vBoolean(input.ok, `${path}.ok`, diagnostics);
			if (invocationId === undefined || ok === undefined) return undefined;
			let content: ExportContent | undefined;
			if (input.content !== undefined) {
				content = vAssetContent(input.content, `${path}.content`, diagnostics);
				if (content === undefined) return undefined;
			}
			return {
				invocationId,
				ok,
				...(input.error !== undefined ? { error: vDiagnostic(input.error, `${path}.error`, diagnostics) as Diagnostic } : {}),
				...(content !== undefined ? { content } : {})
			};
		}
	},
	'diagnostic.emit': {
		event(input, path, diagnostics): DiagnosticEmitPayload | undefined {
			if (!isRecord(input)) return reportObject(path, diagnostics);
			const diagnostic = vDiagnostic(input.diagnostic, `${path}.diagnostic`, diagnostics);
			if (diagnostic === undefined) return undefined;
			return { diagnostic };
		}
	}
};

// The registry above intentionally mirrors the union; this cast keeps the table total.
for (const name of ENVIRONMENT_MESSAGE_NAMES) {
	if (!(name in MESSAGE_SCHEMAS)) {
		throw new Error(`missing environment message schema for '${name}'`);
	}
}

function reportObject(path: string, diagnostics: Diagnostic[]): undefined {
	diagnostics.push(error('env/payload', `${path} must be an object`, path));
	return undefined;
}

function vEndpoint(input: unknown, path: string, diagnostics: Diagnostic[]): EnvironmentEndpointRole | undefined {
	if (input === 'main' || input === 'slate') return input;
	diagnostics.push(error('env/payload', `${path} must be 'main' or 'slate'`, path));
	return undefined;
}

function vSurfaceKind(input: unknown, path: string, diagnostics: Diagnostic[]): SurfaceKind | undefined {
	if (input === 'canvas' || input === 'slate') return input;
	diagnostics.push(error('env/payload', `${path} must be 'canvas' or 'slate'`, path));
	return undefined;
}

/**
 * Validates a full Environment Envelope: protocol version, session id, kind/name
 * combination and the name-specific payload shape. Total function: arbitrary input
 * produces typed diagnostics, never a throw.
 */
export function validateEnvironmentEnvelope(input: unknown): Result<EnvironmentEnvelope> {
	const diagnostics: Diagnostic[] = [];
	if (!isRecord(input)) {
		return fail([error('env/envelope', 'envelope must be an object')]);
	}

	if (input.protocolVersion !== ENVIRONMENT_PROTOCOL_VERSION) {
		diagnostics.push(
			error('env/protocol-version', `unsupported protocolVersion ${String(input.protocolVersion)}`, 'protocolVersion')
		);
	}
	if (typeof input.sessionId !== 'string' || input.sessionId.length === 0) {
		diagnostics.push(error('env/session-id', 'sessionId must be a non-empty string', 'sessionId'));
	}
	const kind = input.kind;
	if (kind !== 'request' && kind !== 'response' && kind !== 'event') {
		diagnostics.push(error('env/kind', "kind must be 'request', 'response' or 'event'", 'kind'));
	}
	const name = input.name;
	if (typeof name !== 'string' || !(ENVIRONMENT_MESSAGE_NAMES as readonly string[]).includes(name)) {
		diagnostics.push(error('env/name', `unknown message name '${String(name)}'`, 'name'));
	}

	if (input.requestId !== undefined) {
		if (typeof input.requestId !== 'string' || input.requestId.length === 0) {
			diagnostics.push(error('env/request-id', 'requestId must be a non-empty string when present', 'requestId'));
		} else if (kind === 'event') {
			diagnostics.push(error('env/request-id', 'events must not carry a requestId', 'requestId'));
		}
	} else if (kind === 'response') {
		diagnostics.push(error('env/request-id', 'responses must carry the requestId they answer', 'requestId'));
	}

	if (kind === 'request' || kind === 'response' || kind === 'event') {
		if (typeof name === 'string' && (ENVIRONMENT_MESSAGE_NAMES as readonly string[]).includes(name)) {
			const schema = MESSAGE_SCHEMAS[name as EnvironmentMessageName];
			if (schema === undefined) {
				diagnostics.push(error('env/schema', `no schema for message '${name}'`));
			} else {
				const validator = schema[kind];
				if (validator === undefined) {
					diagnostics.push(error('env/message-kind', `message '${name}' does not support kind '${kind}'`, 'kind'));
				} else {
					validator(input.payload, 'payload', diagnostics);
				}
			}
		}
	}

	if (diagnostics.length > 0) return fail(diagnostics);
	return ok(input as unknown as EnvironmentEnvelope);
}

/** Convenience: shallow-validate a payload against one name+kind without an envelope. */
export function validateEnvironmentPayload(
	name: EnvironmentMessageName,
	kind: EnvironmentMessageKind,
	payload: unknown
): Result<unknown> {
	const diagnostics: Diagnostic[] = [];
	const schema = MESSAGE_SCHEMAS[name];
	const validator = schema?.[kind];
	if (validator === undefined) {
		diagnostics.push(error('env/message-kind', `message '${name}' does not support kind '${kind}'`));
		return fail(diagnostics);
	}
	validator(payload, 'payload', diagnostics);
	return diagnostics.length > 0 ? fail(diagnostics) : ok(payload);
}