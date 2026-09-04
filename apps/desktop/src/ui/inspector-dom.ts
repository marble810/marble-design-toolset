/**
 * Standard Inspector DOM renderer for the Desktop Host UI.
 *
 * The InspectorHost core is a retained, DOM-free view model (tool-host); this renderer
 * mirrors it into the Host chrome. Pointer input never crosses the Environment API:
 * controls update the store locally and the renderer flushes coalesced batches on a
 * rAF schedule, exactly like the Web inspector.
 */
import type { CatalogEntry, InspectorBinding, InspectorTreeDescriptor, ParameterValue } from 'tool-contract';
import type { InspectorHost, InspectorNodeState, InspectorViewModel } from 'tool-host';

export interface InspectorDomHandle {
	readonly root: HTMLElement;
	/** Detaches listeners + cancels the rAF loop. */
	dispose(): void;
}

/** Element id → parameter binding, resolved from the Catalog inspector tree. */
function bindingMap(tree: InspectorTreeDescriptor): ReadonlyMap<string, InspectorBinding> {
	const map = new Map<string, InspectorBinding>();
	const walk = (elements: readonly { kind: string; id: string; binding?: InspectorBinding; children?: readonly unknown[] }[]): void => {
		for (const element of elements) {
			if (element.binding !== undefined) map.set(element.id, element.binding);
			const children = element.children as Array<{ kind: string; id: string; binding?: InspectorBinding; children?: readonly unknown[] }> | undefined;
			if (children !== undefined) walk(children);
		}
	};
	walk(tree.elements as never);
	return map;
}

export function renderInspector(host: InspectorHost, entry: CatalogEntry): InspectorDomHandle {
	const root = document.createElement('div');
	root.className = 'inspector';

	const elements = new Map<string, { state: InspectorNodeState; input?: HTMLInputElement | HTMLSelectElement; valueLabel?: HTMLElement; button?: HTMLButtonElement }>();
	const bindings = bindingMap(entry.inspectorTree);
	const pendingUpdates = new Map<string, ParameterValue>();
	let rafHandle: number | undefined;
	let disposed = false;

	function flush(): void {
		rafHandle = undefined;
		if (disposed || pendingUpdates.size === 0) return;
		for (const [id, value] of pendingUpdates) host.setValue(id, value);
		pendingUpdates.clear();
		host.flushValues();
	}

	function scheduleFlush(): void {
		if (rafHandle !== undefined || disposed) return;
		rafHandle = requestAnimationFrame(flush);
	}

	function parameterIdFor(elementId: string): string | undefined {
		const binding = bindings.get(elementId);
		return binding !== undefined && binding.kind === 'parameter' ? binding.parameterId : undefined;
	}

	function descriptorFor(elementId: string) {
		const parameterId = parameterIdFor(elementId);
		return parameterId !== undefined ? entry.parameters[parameterId] : undefined;
	}

	// ------------------------------------------------------------------ rendering

	function renderSection(state: InspectorNodeState, container: HTMLElement): void {
		if (state.visible === false) return;
		const section = document.createElement('section');
		section.className = 'inspector__section';
		const title = document.createElement('h3');
		title.className = 'inspector__section-title';
		title.textContent = state.title ?? '';
		section.appendChild(title);
		container.appendChild(section);
		for (const child of state.children ?? []) renderElement(child, section);
	}

	function renderElement(state: InspectorNodeState, container: HTMLElement): void {
		if (state.visible === false) return;
		if (state.kind === 'section') {
			renderSection(state, container);
			return;
		}
		const row = document.createElement('div');
		row.className = `inspector__row inspector__row--${state.kind}`;
		const record: NonNullable<ReturnType<typeof elements.get>> = { state };
		elements.set(state.id, record);

		switch (state.kind) {
			case 'label': {
				const span = document.createElement('span');
				span.className = 'inspector__label';
				span.textContent = state.text ?? state.label;
				row.appendChild(span);
				break;
			}
			case 'slider': {
				const input = document.createElement('input');
				input.type = 'range';
				input.disabled = state.disabled === true;
				const descriptor = descriptorFor(state.id);
				const range = descriptor !== undefined && descriptor.constraint.type === 'number'
					? { min: descriptor.constraint.min, max: descriptor.constraint.max, step: descriptor.constraint.step ?? 1 }
					: { min: 0, max: 100, step: 1 };
				input.min = String(range.min);
				input.max = String(range.max);
				input.step = String(range.step);
				if (typeof state.value === 'number') input.value = String(state.value);
				input.addEventListener('input', () => {
					pendingUpdates.set(state.id, Number(input.value));
					scheduleFlush();
				});
				row.appendChild(labelFor(state));
				row.appendChild(input);
				const valueLabel = document.createElement('span');
				valueLabel.className = 'inspector__value';
				valueLabel.textContent = formatValue(state.value);
				row.appendChild(valueLabel);
				record.input = input;
				record.valueLabel = valueLabel;
				break;
			}
			case 'toggle': {
				const label = labelFor(state);
				const input = document.createElement('input');
				input.type = 'checkbox';
				input.disabled = state.disabled === true;
				input.checked = state.value === true;
				input.addEventListener('change', () => {
					pendingUpdates.set(state.id, input.checked);
					scheduleFlush();
				});
				label.appendChild(input);
				row.appendChild(label);
				record.input = input;
				break;
			}
			case 'select': {
				const select = document.createElement('select');
				select.disabled = state.disabled === true;
				const descriptor = descriptorFor(state.id);
				const options = descriptor !== undefined && descriptor.constraint.type === 'select' ? descriptor.constraint.options : [];
				for (const option of options) {
					const opt = document.createElement('option');
					opt.value = option;
					opt.textContent = option;
					select.appendChild(opt);
				}
				if (typeof state.value === 'string') select.value = state.value;
				select.addEventListener('change', () => {
					pendingUpdates.set(state.id, select.value);
					scheduleFlush();
				});
				row.appendChild(labelFor(state));
				row.appendChild(select);
				record.input = select;
				break;
			}
			case 'text': {
				const input = document.createElement('input');
				input.type = 'text';
				input.disabled = state.disabled === true;
				input.value = typeof state.value === 'string' ? state.value : '';
				input.addEventListener('change', () => {
					pendingUpdates.set(state.id, input.value);
					scheduleFlush();
				});
				row.appendChild(labelFor(state));
				row.appendChild(input);
				record.input = input;
				break;
			}
			case 'button': {
				const button = document.createElement('button');
				button.type = 'button';
				button.textContent = state.label;
				if (state.title !== undefined) button.title = state.title;
				button.addEventListener('click', () => host.trigger(state.id));
				row.appendChild(button);
				record.button = button;
				break;
			}
		}
		container.appendChild(row);
	}

	function labelFor(state: InspectorNodeState): HTMLLabelElement {
		const label = document.createElement('label');
		label.className = 'inspector__control-label';
		label.textContent = state.label;
		return label;
	}

	function formatValue(value: unknown): string {
		if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
		if (typeof value === 'boolean') return value ? 'on' : 'off';
		if (typeof value === 'string') return value;
		return '';
	}

	function flattenModel(model: InspectorViewModel): InspectorNodeState[] {
		const out: InspectorNodeState[] = [];
		const walk = (nodes: readonly InspectorNodeState[]): void => {
			for (const node of nodes) {
				out.push(node);
				if (node.children !== undefined) walk(node.children);
			}
		};
		walk(model.elements);
		return out;
	}

	// ------------------------------------------------------------------ model sync

	function updateValues(): void {
		for (const [id, record] of elements) {
			const fresh = host.getNodeState(id);
			if (fresh === undefined) continue;
			record.state = fresh;
			if (record.input !== undefined && document.activeElement !== record.input) {
				if (record.input.type === 'checkbox') record.input.checked = fresh.value === true;
				else if (record.input instanceof HTMLSelectElement || record.input.type === 'text') {
					record.input.value = typeof fresh.value === 'string' ? fresh.value : '';
				} else if (typeof fresh.value === 'number') record.input.value = String(fresh.value);
			}
			if (record.valueLabel !== undefined) record.valueLabel.textContent = formatValue(fresh.value);
			if (record.input !== undefined) record.input.disabled = fresh.disabled === true;
			if (record.button !== undefined) {
				record.button.disabled = fresh.running === true;
				record.button.textContent = fresh.running === true ? '…' : fresh.label;
			}
		}
	}

	function applyModel(model: InspectorViewModel): void {
		// Visibility flips (visibleWhen) re-render: the retained row records would be stale.
		const signature = flattenModel(model)
			.map((element) => `${element.id}:${element.visible === false ? 'h' : 'v'}`)
			.join('|');
		if (signature === root.dataset.signature) {
			updateValues();
			return;
		}
		root.dataset.signature = signature;
		root.textContent = '';
		elements.clear();
		for (const element of model.elements) renderElement(element, root);
		updateValues();
	}

	// InspectorHost emits on store value changes, action status and structure updates —
	// one subscription drives everything.
	const unsubscribe = host.subscribe(applyModel);
	applyModel(host.viewModel());

	return {
		root,
		dispose(): void {
			disposed = true;
			if (rafHandle !== undefined) cancelAnimationFrame(rafHandle);
			unsubscribe();
			root.textContent = '';
		}
	};
}
