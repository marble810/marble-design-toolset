/**
 * Retained Standard Inspector: consumes the Catalog Entry `inspectorTree` (or the
 * default tree generated from Parameter descriptors) and maintains headless display
 * state for every element: values mirrored from the Host Parameter Store, disabled
 * state for computed parameters, and running/result state for action buttons.
 *
 * The renderer core is DOM-free; Web/Desktop adapters render the view model. Host
 * controls merge pointer input through the store (`update` + app-driven `flush`), so
 * pointer events never cross the Environment API.
 */
import type { Diagnostic, InspectorBinding, InspectorElement, InspectorTreeDescriptor } from 'tool-contract';
import { error, type ParameterValue } from 'tool-contract';
import type { ParameterStore, ParameterSetResult } from '../parameter-store.ts';
import type { CommandActionResult, CommandStatusEvent, CommandStatusKind } from '../command-runner.ts';
import type { Unsubscribe } from 'tool-contract';

export interface InspectorNodeState {
	id: string;
	kind: InspectorElement['kind'];
	label: string;
	text?: string;
	title?: string;
	value?: ParameterValue;
	disabled?: boolean;
	running?: boolean;
	result?: CommandStatusKind;
	children?: InspectorNodeState[];
}

export interface InspectorViewModel {
	elements: readonly InspectorNodeState[];
}

export interface ActionStatusSource {
	subscribe(handler: (event: CommandStatusEvent) => void): Unsubscribe;
}

export interface InspectorHostOptions {
	tree: InspectorTreeDescriptor;
	store: ParameterStore;
	/** Routes a button binding: public Tool Command or Inspector private callback. */
	executeAction: (binding: InspectorBinding) => CommandActionResult;
	commandStatus: ActionStatusSource;
	/** Reported when a bound action is rejected (single-flight, closed runner). */
	onActionRejected?: (diagnostic: Diagnostic) => void;
}

interface Node {
	element: InspectorElement;
	children: Node[];
}

function isParameterBinding(binding: InspectorBinding): binding is { kind: 'parameter'; parameterId: string } {
	return binding.kind === 'parameter';
}

export class InspectorHost {
	private readonly options: InspectorHostOptions;
	private readonly root: Node;
	private readonly nodes = new Map<string, Node>();
	/** invocationId → elementId so runner status events update the right button. */
	private readonly invocationElements = new Map<string, string>();
	private readonly listeners = new Set<(model: InspectorViewModel) => void>();
	private readonly storeUnsubscribe: Unsubscribe;
	private readonly statusUnsubscribe: Unsubscribe;
	private disposed = false;

	constructor(options: InspectorHostOptions) {
		this.options = options;
		this.root = { element: { kind: 'section', id: '__root', title: '', children: [] }, children: [] };
		for (const element of options.tree.elements) {
			this.root.children.push(this.buildNode(element));
		}

		this.storeUnsubscribe = options.store.subscribe((event) => {
			if (event.type === 'changed') this.refreshValues([event.id]);
		});
		this.statusUnsubscribe = options.commandStatus.subscribe((event) => this.onCommandStatus(event));
	}

	// ------------------------------------------------------------------ reads

	viewModel(): InspectorViewModel {
		return { elements: this.root.children.map((node) => this.toState(node)) };
	}

	getNodeState(id: string): InspectorNodeState | undefined {
		const node = this.nodes.get(id);
		return node === undefined ? undefined : this.toState(node);
	}

	subscribe(listener: (model: InspectorViewModel) => void): Unsubscribe {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	// ------------------------------------------------------------------ input

	/**
	 * Host control pointer input: coalesces into the store; nothing crosses the
	 * Environment API until the app flushes (rAF / pointerup).
	 */
	setValue(elementId: string, value: ParameterValue): void {
		if (this.disposed) return;
		const binding = this.parameterBinding(elementId);
		if (binding === undefined) return;
		this.options.store.update(binding.parameterId, value);
		this.emit();
	}

	/** Applies all coalesced control updates as one batch; returns per-parameter results. */
	flushValues(): ParameterSetResult[] {
		const results = this.options.store.flush();
		this.emit();
		return results;
	}

	/** Triggers a button binding (public command or private callback). */
	trigger(elementId: string): CommandActionResult {
		if (this.disposed) return { ok: false, diagnostic: error('inspector/closed', 'inspector is closed', elementId) };
		const node = this.nodes.get(elementId);
		if (node === undefined) {
			return { ok: false, diagnostic: error('inspector/element', `unknown element '${elementId}'`, elementId) };
		}
		const element = node.element;
		if (element.kind !== 'button') {
			return { ok: false, diagnostic: error('inspector/element', `'${elementId}' is not a button`, elementId) };
		}
		if (this.toState(node).running === true) {
			return { ok: false, diagnostic: error('command/single-flight', `'${elementId}' is already running`, elementId) };
		}
		const result = this.options.executeAction(element.binding);
		if (result.ok) {
			this.invocationElements.set(result.invocationId, elementId);
		} else {
			this.options.onActionRejected?.(result.diagnostic);
		}
		this.emit();
		return result;
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.storeUnsubscribe();
		this.statusUnsubscribe();
		this.listeners.clear();
	}

	// ------------------------------------------------------------------ internals

	private buildNode(element: InspectorElement): Node {
		const node: Node = { element, children: [] };
		this.nodes.set(element.id, node);
		if (element.kind === 'section') {
			for (const child of element.children) {
				node.children.push(this.buildNode(child));
			}
		}
		return node;
	}

	private parameterBinding(elementId: string): { kind: 'parameter'; parameterId: string } | undefined {
		const node = this.nodes.get(elementId);
		if (node === undefined) return undefined;
		const binding = (node.element as { binding?: InspectorBinding }).binding;
		return binding !== undefined && isParameterBinding(binding) ? binding : undefined;
	}

	private toState(node: Node): InspectorNodeState {
		const element = node.element;
		switch (element.kind) {
			case 'label':
				return { id: element.id, kind: 'label', label: '', text: element.text };
			case 'section':
				return {
					id: element.id,
					kind: 'section',
					label: '',
					title: element.title,
					children: node.children.map((child) => this.toState(child))
				};
			case 'slider':
			case 'toggle':
			case 'select':
			case 'text': {
				const binding = element.binding;
				if (binding.kind !== 'parameter') return { id: element.id, kind: element.kind, label: element.label };
				const descriptor = this.options.store.descriptor(binding.parameterId);
				return {
					id: element.id,
					kind: element.kind,
					label: element.label,
					value: this.options.store.get(binding.parameterId),
					disabled: descriptor !== undefined && descriptor.mode === 'computed'
				};
			}
			case 'button': {
				const running = this.isRunning(element.id);
				return { id: element.id, kind: 'button', label: element.label, running, disabled: running };
			}
		}
	}

	private isRunning(elementId: string): boolean {
		for (const mapped of this.invocationElements.values()) {
			if (mapped === elementId) return true;
		}
		return false;
	}

	private onCommandStatus(event: CommandStatusEvent): void {
		const elementId = this.invocationElements.get(event.invocationId);
		if (elementId === undefined) return;
		if (event.status === 'completed' || event.status === 'failed') {
			this.invocationElements.delete(event.invocationId);
		}
		// 'canceled' (cancel-grace expired, callback still running) keeps the invocation
		// mapped so the control stays unavailable while Session health is Unresponsive;
		// only Restart (Inspector disposal) releases it.
		this.emit();
	}

	private refreshValues(ids: readonly string[]): void {
		void ids;
		this.emit();
	}

	private emit(): void {
		if (this.disposed) return;
		const model = this.viewModel();
		for (const listener of [...this.listeners]) {
			listener(model);
		}
	}
}