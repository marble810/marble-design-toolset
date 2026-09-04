/**
 * Descriptor-only Inspector SDK: builders that produce retained, serializable Inspector
 * Elements. This runs inside the Forge extraction realm and never touches Host DOM,
 * Svelte or GPU. Bindings only accept typed handles; inline anonymous callbacks throw.
 */
import type { InspectorBinding, InspectorElement, InspectorVisibilityRule } from 'tool-contract';

/** Typed handles derived from Tool Entry map keys. */
export interface ParameterHandle {
	readonly __deshelfParameterId: string;
}
export interface AssetHandle {
	readonly __deshelfAssetId: string;
	readonly label: string;
}
export interface CommandHandle {
	readonly __deshelfCommandId: string;
}
export interface PrivateCallbackHandle {
	readonly __deshelfCallbackId: string;
}

/** Conditional visibility: the element renders only while the Parameter matches. */
export interface VisibleWhenOptions {
	visibleWhen?: InspectorVisibilityRule;
}
export interface SectionOptions {
	visibleWhen?: InspectorVisibilityRule;
}
export interface SliderOptions {
	id: string;
	label: string;
	bind: ParameterHandle;
	step?: number;
	visibleWhen?: InspectorVisibilityRule;
}
export interface ToggleOptions extends VisibleWhenOptions {
	id: string;
	label: string;
	bind: ParameterHandle;
}
export interface SelectOptions extends VisibleWhenOptions {
	id: string;
	label: string;
	bind: ParameterHandle;
}
export interface TextOptions extends VisibleWhenOptions {
	id: string;
	label: string;
	bind: ParameterHandle;
}
export interface ButtonOptions extends VisibleWhenOptions {
	id: string;
	label: string;
	bind: PrivateCallbackHandle | CommandHandle;
}

export interface InspectorRoot {
	label(id: string, text: string, opts?: VisibleWhenOptions): void;
	section(id: string, title: string, build: (root: InspectorRoot) => void, opts?: SectionOptions): void;
	slider(opts: SliderOptions): void;
	toggle(opts: ToggleOptions): void;
	select(opts: SelectOptions): void;
	text(opts: TextOptions): void;
	button(opts: ButtonOptions): void;
}

const TYPED_HANDLE_MSG = 'inspector bindings require a typed handle from parameters/commands/privateCallbacks; inline anonymous callbacks are not allowed';

/** Applies the shared optional visibility rule to a partially built element. */
function withVisibility<E extends InspectorElement>(element: E, visibleWhen: InspectorVisibilityRule | undefined): E {
	return visibleWhen === undefined ? element : ({ ...element, visibleWhen } as E);
}

function requireParameterHandle(bind: unknown): ParameterHandle {
	if (bind !== null && typeof bind === 'object' && typeof (bind as ParameterHandle).__deshelfParameterId === 'string') {
		return bind as ParameterHandle;
	}
	throw new TypeError(TYPED_HANDLE_MSG);
}

function requireActionHandle(bind: unknown): PrivateCallbackHandle | CommandHandle {
	if (bind !== null && typeof bind === 'object') {
		const b = bind as Record<string, unknown>;
		if (typeof b.__deshelfCallbackId === 'string') return b as unknown as PrivateCallbackHandle;
		if (typeof b.__deshelfCommandId === 'string') return b as unknown as CommandHandle;
	}
	throw new TypeError(TYPED_HANDLE_MSG);
}

function createRoot(elements: InspectorElement[]): InspectorRoot {
	return {
		label(id: string, text: string, opts?: VisibleWhenOptions): void {
			elements.push(withVisibility({ kind: 'label', id, text }, opts?.visibleWhen));
		},
		section(id: string, title: string, build: (root: InspectorRoot) => void, opts?: SectionOptions): void {
			const children: InspectorElement[] = [];
			build(createRoot(children));
			elements.push(withVisibility({ kind: 'section', id, title, children }, opts?.visibleWhen));
		},
		slider(opts: SliderOptions): void {
			const b = requireParameterHandle(opts.bind);
			elements.push(
				withVisibility(
					{
						kind: 'slider',
						id: opts.id,
						label: opts.label,
						binding: { kind: 'parameter', parameterId: b.__deshelfParameterId } satisfies InspectorBinding,
						...(opts.step !== undefined ? { step: opts.step } : {})
					},
					opts.visibleWhen
				)
			);
		},
		toggle(opts: ToggleOptions): void {
			const b = requireParameterHandle(opts.bind);
			elements.push(
				withVisibility(
					{
						kind: 'toggle',
						id: opts.id,
						label: opts.label,
						binding: { kind: 'parameter', parameterId: b.__deshelfParameterId }
					},
					opts.visibleWhen
				)
			);
		},
		select(opts: SelectOptions): void {
			const b = requireParameterHandle(opts.bind);
			elements.push(
				withVisibility(
					{
						kind: 'select',
						id: opts.id,
						label: opts.label,
						binding: { kind: 'parameter', parameterId: b.__deshelfParameterId }
					},
					opts.visibleWhen
				)
			);
		},
		text(opts: TextOptions): void {
			const b = requireParameterHandle(opts.bind);
			elements.push(
				withVisibility(
					{
						kind: 'text',
						id: opts.id,
						label: opts.label,
						binding: { kind: 'parameter', parameterId: b.__deshelfParameterId }
					},
					opts.visibleWhen
				)
			);
		},
		button(opts: ButtonOptions): void {
			const b = requireActionHandle(opts.bind);
			const binding: InspectorBinding =
				'__deshelfCallbackId' in b
					? { kind: 'private-callback', callbackId: b.__deshelfCallbackId }
					: { kind: 'command', commandId: b.__deshelfCommandId };
			elements.push(withVisibility({ kind: 'button', id: opts.id, label: opts.label, binding }, opts.visibleWhen));
		}
	};
}

export { createRoot };
