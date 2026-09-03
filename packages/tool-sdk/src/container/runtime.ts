/**
 * Tool Container runtime (inside the Tool realm): turns a raw EnvironmentTransport plus
 * a loaded Tool Entry definition into a bootable surface. It waits for the single
 * `boot` request, mirrors Parameter/Asset state locally, mounts the surface through an
 * injected hook, emits `surface.ready`, and answers the Host-driven management messages
 * (parameter snapshot/changed/compute, command execute/cancel, export execute, asset
 * changes, surface resize/dispose).
 *
 * This module stays framework-free: Svelte mounting, iframe plumbing and artifact URL
 * loading are injected via `loadDefinition` / `mountSurface`. rAF, GPU objects,
 * simulation state and Canvas pixels stay inside the container — only small control
 * messages ever cross the Environment API.
 */
import {
	error,
	validateEnvironmentEnvelope,
	type AssetContent,
	type AssetSnapshot,
	type BootSurface,
	type CommandExecutePayload,
	type CommandResultPayload,
	type Diagnostic,
	type EnvironmentEndpointRole,
	type EnvironmentEnvelope,
	type EnvironmentMessageName,
	type EnvironmentTransport,
	type ExportContent,
	type ParameterComputeRequestPayload,
	type ParameterComputeResponsePayload,
	type ParameterSetResponsePayload,
	type ParameterSnapshot,
	type ParameterValue,
	type SurfaceKind,
	type Unsubscribe
} from 'tool-contract';
import { EnvironmentClient } from '../client.ts';
import type { CommandExecutionContext, VisualToolDefinition } from '../define-visual-tool.ts';

// ---------------------------------------------------------------------------
// Surface context handed to mounted Canvas/Slate components
// ---------------------------------------------------------------------------

export interface ContainerParameterMirror {
	/** Latest Parameter snapshot known to this container. */
	snapshot(): ParameterSnapshot;
	subscribe(listener: (snapshot: ParameterSnapshot) => void): Unsubscribe;
}

export interface ContainerAssetMirror {
	values(): Record<string, AssetContent | null>;
	subscribe(listener: (values: Record<string, AssetContent | null>) => void): Unsubscribe;
}

export interface ContainerSurfaceContext {
	readonly sessionId: string;
	readonly endpoint: EnvironmentEndpointRole;
	/** Current Surface kind + size; updated by Host `surface.resize` events. */
	surface(): BootSurface;
	onSurface(listener: (surface: BootSurface) => void): Unsubscribe;
	parameters: ContainerParameterMirror;
	assets: ContainerAssetMirror;
	/** Submits a parameter change through the Host Parameter Store. */
	setParameter(id: string, value: ParameterValue, expectedRevision: number): Promise<ParameterSetResponsePayload>;
	/** Requests asset content from the Host environment adapter. */
	requestAsset(assetId: string): Promise<AssetContent>;
	/** Reports a diagnostic to the Host diagnostic log. */
	reportDiagnostic(diagnostic: Diagnostic): void;
	/** The management-plane client (advanced use; tools normally use the mirrors above). */
	client: EnvironmentClient;
}

// ---------------------------------------------------------------------------
// Runtime options + handle
// ---------------------------------------------------------------------------

export interface ToolContainerRuntimeOptions {
	transport: EnvironmentTransport;
	endpoint: EnvironmentEndpointRole;
	/**
	 * Loads the Tool Entry definition. The Web container dynamically imports the
	 * pre-compiled artifact URL; tests return a stub definition directly.
	 */
	loadDefinition: () => Promise<VisualToolDefinition>;
	/**
	 * Mounts the visual surface (Canvas for `main`, Tool Slate for `slate`). Receives the
	 * live context and the loaded definition; resolves with an unmount function.
	 */
	mountSurface: (context: ContainerSurfaceContext, definition: VisualToolDefinition) => Promise<() => void> | (() => void);
	/** Boot failures: invalid boot envelope, definition load error, mount error. */
	onBootError?: (diagnostic: Diagnostic) => void;
	/** Invalid management-plane messages observed after boot. */
	onInvalidMessage?: (reason: string) => void;
}

export interface ToolContainerRuntimeHandle {
	/** Resolves once `surface.ready` has been emitted (definition loaded + mounted). */
	ready: Promise<void>;
	context: ContainerSurfaceContext;
	/** Resolves with the shutdown reason on `surface.dispose` or `close()`. */
	disposed: Promise<'surface-dispose' | 'closed'>;
	/** Forces shutdown (unmount + client dispose) without a Host dispose. */
	close(): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function isParameterValue(value: unknown): value is ParameterValue {
	return (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean' || typeof value === 'string';
}

function cloneSnapshot(snapshot: ParameterSnapshot): ParameterSnapshot {
	return {
		revision: snapshot.revision,
		values: { ...snapshot.values },
		revisions: { ...snapshot.revisions }
	};
}

/** Normalizes a Tool Output `render` result into serializable ExportContent. */
async function normalizeExportContent(rendered: unknown, mime: string): Promise<ExportContent> {
	if (rendered instanceof Blob) {
		return { kind: 'blob-url', mime: rendered.type !== '' ? rendered.type : mime, url: URL.createObjectURL(rendered) };
	}
	if (rendered instanceof ArrayBuffer) {
		return { kind: 'blob-url', mime, url: URL.createObjectURL(new Blob([rendered], { type: mime })) };
	}
	if (ArrayBuffer.isView(rendered)) {
		const view = rendered as ArrayBufferView;
		return {
			kind: 'blob-url',
			mime,
			url: URL.createObjectURL(
				new Blob([view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer], { type: mime })
			)
		};
	}
	if (typeof rendered === 'string' && (rendered.startsWith('blob:') || rendered.startsWith('data:'))) {
		return { kind: 'blob-url', mime, url: rendered };
	}
	return { kind: 'empty' };
}

export function startToolContainer(options: ToolContainerRuntimeOptions): ToolContainerRuntimeHandle {
	const { transport, endpoint } = options;

	let client: EnvironmentClient | undefined;
	let definition: VisualToolDefinition | undefined;
	let unmount: (() => void) | undefined;
	let shutDown = false;
	let shutdownReason: 'surface-dispose' | 'closed' | undefined;
	let sessionId = '';
	let surface: BootSurface = { kind: (endpoint === 'main' ? 'canvas' : 'slate') as SurfaceKind, width: 0, height: 0 };
	let parameterSnapshot: ParameterSnapshot = { revision: 0, values: {}, revisions: {} };
	let assetValues: Record<string, AssetContent | null> = {};

	const surfaceListeners = new Set<(surface: BootSurface) => void>();
	const parameterListeners = new Set<(snapshot: ParameterSnapshot) => void>();
	const assetListeners = new Set<(values: Record<string, AssetContent | null>) => void>();
	const activeInvocations = new Map<string, AbortController>();
	/**
	 * Definition-dependent work (commands, compute, exports) that arrived after boot but
	 * before the artifact finished loading. The Host may legitimately send a compute wave
	 * immediately after `boot` (deferred HostReady waves are retried at that point), so
	 * these messages are queued in arrival order and drained once the definition exists.
	 */
	let pendingDefinitionWork: Array<() => void> = [];

	let resolveReady!: () => void;
	let readyReject!: (reason: Error) => void;
	let readySettled = false;
	const ready = new Promise<void>((resolve, reject) => {
		resolveReady = () => {
			if (readySettled) return;
			readySettled = true;
			resolve();
		};
		readyReject = (reason) => {
			if (readySettled) return;
			readySettled = true;
			reject(reason);
		};
	});

	let resolveDisposed!: (reason: 'surface-dispose' | 'closed') => void;
	const disposed = new Promise<'surface-dispose' | 'closed'>((resolve) => {
		resolveDisposed = resolve;
	});

	const context: ContainerSurfaceContext = {
		get sessionId() {
			return sessionId;
		},
		endpoint,
		surface: () => ({ ...surface }),
		onSurface(listener) {
			surfaceListeners.add(listener);
			return () => surfaceListeners.delete(listener);
		},
		parameters: {
			snapshot: () => cloneSnapshot(parameterSnapshot),
			subscribe(listener) {
				parameterListeners.add(listener);
				return () => parameterListeners.delete(listener);
			}
		},
		assets: {
			values: () => ({ ...assetValues }),
			subscribe(listener) {
				assetListeners.add(listener);
				return () => assetListeners.delete(listener);
			}
		},
		async setParameter(id, value, expectedRevision) {
			if (client === undefined) throw new Error('container/not-booted');
			const response = (await client.request('parameter.set', { id, value, expectedRevision })) as ParameterSetResponsePayload;
			// A committed change is echoed back via `parameter.changed`; mirrors update there.
			return response;
		},
		async requestAsset(assetId) {
			if (client === undefined) throw new Error('container/not-booted');
			const response = (await client.request('asset.request', { assetId })) as { assetId: string; content: AssetContent };
			return response.content;
		},
		reportDiagnostic(diagnostic) {
			if (client === undefined || shutDown) return;
			client.emit('diagnostic.emit', { diagnostic });
		},
		client: undefined as unknown as EnvironmentClient
	};

	// ------------------------------------------------------------------ shutdown

	let definitionDisposed = false;

	function disposeDefinition(): void {
		if (definitionDisposed || definition === undefined || endpoint !== 'main') return;
		definitionDisposed = true;
		try {
			definition.dispose?.();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			client?.emit('diagnostic.emit', {
				diagnostic: error('container/dispose-failed', `Tool dispose failed: ${message}`)
			});
		}
	}

	function unmountSurface(): void {
		try {
			unmount?.();
		} catch {
			// unmount failures must not block teardown
		}
		unmount = undefined;
	}

	function shutdown(reason: 'surface-dispose' | 'closed'): void {
		if (shutDown) return;
		shutDown = true;
		shutdownReason = reason;
		pendingDefinitionWork = [];
		for (const controller of activeInvocations.values()) controller.abort();
		activeInvocations.clear();
		unmountSurface();
		disposeDefinition();
		client?.dispose();
		// A runtime closed before finishing boot can never become ready.
		readyReject(new Error(`container/shutdown: ${reason}`));
		resolveDisposed(reason);
	}

	// ------------------------------------------------------------------ mirrors

	function notifyParameterListeners(): void {
		const snapshot = cloneSnapshot(parameterSnapshot);
		for (const listener of [...parameterListeners]) listener(snapshot);
	}

	function notifyAssetListeners(): void {
		const values = { ...assetValues };
		for (const listener of [...assetListeners]) listener(values);
	}

	function applySnapshot(snapshot: ParameterSnapshot): void {
		parameterSnapshot = cloneSnapshot(snapshot);
		notifyParameterListeners();
	}

	function applyParameterChanged(id: string, value: ParameterValue, revision: number): void {
		parameterSnapshot = {
			revision: Math.max(parameterSnapshot.revision, revision),
			values: { ...parameterSnapshot.values, [id]: value },
			revisions: { ...parameterSnapshot.revisions, [id]: revision }
		};
		notifyParameterListeners();
	}

	// ------------------------------------------------------------------ handlers

	function handleCommandExecute(payload: CommandExecutePayload): void {
		if (client === undefined || shutDown) return;
		let cancellation = activeInvocations.get(payload.invocationId);
		if (cancellation === undefined) {
			cancellation = new AbortController();
			activeInvocations.set(payload.invocationId, cancellation);
		}
		if (definition === undefined) {
			pendingDefinitionWork.push(() => handleCommandExecute(payload));
			return;
		}
		// Public commands and Inspector private callbacks intentionally share the
		// command.execute protocol and a collision-free stable ID namespace.
		const command = definition.commands?.[payload.commandId] ?? definition.privateCallbacks?.[payload.commandId];
		if (command === undefined || typeof command.run !== 'function') {
			activeInvocations.delete(payload.invocationId);
			client.emit('command.result', {
				invocationId: payload.invocationId,
				ok: false,
				error: error('command/unknown', `unknown command '${payload.commandId}'`, payload.commandId)
			} satisfies CommandResultPayload);
			return;
		}
		// JavaScript callbacks cannot be pre-empted. AbortSignal makes cancellation
		// observable to cooperative callbacks, while callbacks that settle during the
		// Host grace period still report their actual success/failure result.
		const run = command.run as unknown as (context: CommandExecutionContext) => unknown;
		void Promise.resolve()
			.then(() => run({ signal: cancellation.signal }))
			.then(
				() => finishCommand(payload),
				(err: unknown) => finishCommand(payload, err)
			);
	}

	function finishCommand(payload: CommandExecutePayload, runError?: unknown): void {
		if (!activeInvocations.delete(payload.invocationId)) return;
		if (client === undefined || shutDown) return;
		if (runError === undefined) {
			client.emit('command.result', { invocationId: payload.invocationId, ok: true });
			return;
		}
		const message = runError instanceof Error ? runError.message : String(runError);
		client.emit('command.result', {
			invocationId: payload.invocationId,
			ok: false,
			error: error('command/run-failed', `command '${payload.commandId}' failed: ${message}`, payload.commandId)
		});
	}

	function handleCompute(payload: ParameterComputeRequestPayload, requestId: string | undefined): void {
		if (client === undefined || requestId === undefined) return;
		if (definition === undefined) {
			pendingDefinitionWork.push(() => handleCompute(payload, requestId));
			return;
		}
		const dependencies = payload.dependencies.values;
		const values: Record<string, ParameterValue> = {};
		const diagnostics: Diagnostic[] = [];
		for (const id of payload.ids) {
			const compute = definition.parameters?.[id]?.compute;
			if (typeof compute !== 'function') {
				diagnostics.push(error('parameter/compute-invalid', `parameter '${id}' has no compute callback`, id));
				continue;
			}
			try {
				const value = compute(dependencies);
				if (isParameterValue(value)) {
					values[id] = value;
				} else {
					diagnostics.push(error('parameter/compute-invalid', `computed '${id}' produced a non-primitive value`, id));
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				diagnostics.push(error('parameter/compute-invalid', `computed '${id}' threw: ${message}`, id));
			}
		}
		const response: ParameterComputeResponsePayload = { values, ...(diagnostics.length > 0 ? { diagnostics } : {}) };
		client.respond(requestId, 'parameter.compute', response);
	}

	async function handleExportExecute(payload: { outputId: string; invocationId: string }): Promise<void> {
		if (client === undefined || shutDown) return;
		if (definition === undefined) {
			pendingDefinitionWork.push(() => void handleExportExecute(payload));
			return;
		}
		const output = definition.outputs?.[payload.outputId];
		if (output === undefined || typeof output.render !== 'function') {
			client.emit('export.result', {
				invocationId: payload.invocationId,
				ok: false,
				error: error('export/unknown', `unknown output '${payload.outputId}'`, payload.outputId)
			});
			return;
		}
		try {
			// `render` is Tool-owned and untyped at the contract boundary; the container
			// passes a serializable export context (surface size + current parameters).
			const render = output.render as unknown as (ctx: {
				surface: BootSurface;
				parameters: Record<string, ParameterValue>;
				width: number;
				height: number;
			}) => unknown;
			const rendered = await render({
				surface: { ...surface },
				parameters: cloneSnapshot(parameterSnapshot).values,
				width: surface.width,
				height: surface.height
			});
			if (shutDown) return;
			const content = await normalizeExportContent(rendered, output.mime);
			client.emit('export.result', {
				invocationId: payload.invocationId,
				ok: true,
				...(content.kind !== 'empty' ? { content } : {})
			});
		} catch (err) {
			if (client === undefined || shutDown) return;
			const message = err instanceof Error ? err.message : String(err);
			client.emit('export.result', {
				invocationId: payload.invocationId,
				ok: false,
				error: error('export/render-failed', `output '${payload.outputId}' render failed: ${message}`, payload.outputId)
			});
		}
	}

	// ------------------------------------------------------------------ boot

	const rawUnsubscribe = transport.subscribe((raw) => onRawMessage(raw));

	function onRawMessage(raw: unknown): void {
		if (shutDown) return;
		// After boot the EnvironmentClient owns the subscription; the raw listener only
		// waits for the single boot request and ignores everything else.
		if (client !== undefined) return;
		const validation = validateEnvironmentEnvelope(raw);
		if (!validation.ok) {
			options.onBootError?.(error('container/invalid-envelope', `dropped invalid pre-boot envelope`));
			return;
		}
		const envelope: EnvironmentEnvelope = validation.value;
		if (envelope.name !== 'boot') return;
		if (envelope.kind !== 'request') {
			options.onBootError?.(error('container/invalid-boot', 'boot must be a request'));
			return;
		}
		const payload = envelope.payload as { endpoint: EnvironmentEndpointRole };
		if (payload.endpoint !== endpoint) {
			// Pre-boot errors do not settle `ready`: the container keeps waiting for a
			// valid boot (a real adapter may receive a corrected boot later).
			options.onBootError?.(
				error('container/endpoint-mismatch', `boot declared endpoint '${payload.endpoint}' but container runs '${endpoint}'`)
			);
			return;
		}
		beginSession(envelope);
	}

	function beginSession(bootEnvelope: EnvironmentEnvelope): void {
		sessionId = bootEnvelope.sessionId;
		const boot = bootEnvelope.payload as {
			endpoint: EnvironmentEndpointRole;
			parameters: ParameterSnapshot;
			assets: AssetSnapshot;
			surface: BootSurface;
		};
		surface = { kind: boot.surface.kind, width: boot.surface.width, height: boot.surface.height };
		parameterSnapshot = cloneSnapshot(boot.parameters);
		assetValues = { ...boot.assets.values };

		client = new EnvironmentClient(transport, {
			sessionId,
			endpoint,
			onInvalidMessage: (reason) => options.onInvalidMessage?.(reason)
		});
		context.client = client;

		client.on('parameter.snapshot', (payload, requestId) => {
			applySnapshot((payload as { snapshot: ParameterSnapshot }).snapshot);
			if (requestId !== undefined) client?.respond(requestId, 'parameter.snapshot', { ok: true });
		});
		client.on('parameter.changed', (payload) => {
			const changed = payload as { id: string; value: ParameterValue; revision: number };
			applyParameterChanged(changed.id, changed.value, changed.revision);
		});
		client.on('asset.changed', (payload) => {
			const changed = payload as { assetId: string; content: AssetContent };
			assetValues = { ...assetValues, [changed.assetId]: changed.content };
			notifyAssetListeners();
		});
		client.on('surface.resize', (payload) => {
			const resize = payload as { width: number; height: number };
			surface = { ...surface, width: resize.width, height: resize.height };
			for (const listener of [...surfaceListeners]) listener({ ...surface });
		});
		client.on('surface.dispose', () => shutdown('surface-dispose'));
		client.on('command.execute', (payload) => handleCommandExecute(payload as CommandExecutePayload));
		client.on('command.cancel', (payload) => {
			const invocationId = (payload as { invocationId: string }).invocationId;
			activeInvocations.get(invocationId)?.abort();
		});
		client.on('parameter.compute', (payload, requestId) => handleCompute(payload as ParameterComputeRequestPayload, requestId));
		client.on('export.execute', (payload) => {
			void handleExportExecute(payload as { outputId: string; invocationId: string });
		});

		void bootSurface();
	}

	async function bootSurface(): Promise<void> {
		try {
			definition = await options.loadDefinition();
			if (definition === null || typeof definition !== 'object') {
				throw new Error('Tool Entry must default-export a defineVisualTool definition');
			}
			if (shutDown) {
				disposeDefinition();
				return;
			}
			const unmountFn = await options.mountSurface(context, definition);
			if (shutDown) {
				unmountFn?.();
				return;
			}
			unmount = unmountFn ?? undefined;
			client?.emit('surface.ready', { endpoint, surface: surface.kind });
			// Drain work that queued while the artifact was loading (arrival order kept).
			const queued = pendingDefinitionWork;
			pendingDefinitionWork = [];
			for (const work of queued) work();
			resolveReady();
		} catch (err) {
			unmountSurface();
			disposeDefinition();
			const message = err instanceof Error ? err.message : String(err);
			const diagnostic = error('container/boot-failed', `Tool Container boot failed: ${message}`);
			options.onBootError?.(diagnostic);
			client?.emit('diagnostic.emit', { diagnostic });
			readyReject(new Error(`container/boot-failed: ${message}`));
		}
	}

	return {
		ready,
		context,
		disposed,
		close() {
			shutdown('closed');
			rawUnsubscribe();
		}
	};
}

/** Message names a booted container may still receive; exported for conformance checks. */
export const CONTAINER_INBOUND_MESSAGE_NAMES: readonly EnvironmentMessageName[] = [
	'parameter.snapshot',
	'parameter.changed',
	'parameter.compute',
	'command.execute',
	'command.cancel',
	'asset.changed',
	'export.execute',
	'surface.resize',
	'surface.dispose'
];
