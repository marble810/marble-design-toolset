/**
 * Inspector Tree descriptor: a retained-mode, serializable tree built at Forge extraction
 * time by a descriptor-only `createInspector`. Bindings reference unique Parameter,
 * Command or private callback IDs.
 */
import { error, fail, ok, type Diagnostic, type Result } from './diagnostics.ts';
import { ID_PATTERN } from './manifest.ts';
import type { ParameterValue } from './environment.ts';

export type InspectorBinding =
	| { kind: 'parameter'; parameterId: string }
	| { kind: 'command'; commandId: string }
	| { kind: 'private-callback'; callbackId: string };

/**
 * Conditional visibility rule evaluated by the Host against the live Parameter Store.
 * The tree itself stays static in the Catalog; visibility only decides whether the Host
 * renders an element for the current Parameter values (e.g. preset controls that apply
 * only to one init-map source mode).
 */
export interface InspectorVisibilityRule {
	/** The Parameter whose current value decides visibility. */
	parameterId: string;
	/** The element is visible while the Parameter value equals one of these values. */
	equals: ParameterValue | readonly ParameterValue[];
}

export type InspectorElement =
	| { kind: 'label'; id: string; text: string; visibleWhen?: InspectorVisibilityRule }
	| { kind: 'section'; id: string; title: string; children: readonly InspectorElement[]; visibleWhen?: InspectorVisibilityRule }
	| { kind: 'slider'; id: string; label: string; binding: InspectorBinding; step?: number; visibleWhen?: InspectorVisibilityRule }
	| { kind: 'toggle'; id: string; label: string; binding: InspectorBinding; visibleWhen?: InspectorVisibilityRule }
	| { kind: 'select'; id: string; label: string; binding: InspectorBinding; visibleWhen?: InspectorVisibilityRule }
	| { kind: 'text'; id: string; label: string; binding: InspectorBinding; visibleWhen?: InspectorVisibilityRule }
	| { kind: 'button'; id: string; label: string; binding: InspectorBinding; visibleWhen?: InspectorVisibilityRule };

export interface InspectorTreeDescriptor {
	elements: readonly InspectorElement[];
}

export interface InspectorTargets {
	parameters: ReadonlySet<string>;
	commands: ReadonlySet<string>;
	callbacks: ReadonlySet<string>;
}

/** Shared visibility-rule validation for every Inspector element kind. */
function validateVisibilityRule(
	rule: unknown,
	targets: InspectorTargets,
	diagnostics: Diagnostic[],
	path: string
): void {
	if (rule === undefined) return;
	if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) {
		diagnostics.push(error('inspector/visible-when', `visibleWhen must be an object at ${path}`, path));
		return;
	}
	const r = rule as Record<string, unknown>;
	if (typeof r.parameterId !== 'string' || !targets.parameters.has(r.parameterId)) {
		diagnostics.push(
			error('inspector/visible-when', `visibleWhen references unknown parameter '${String(r.parameterId)}' at ${path}`, path)
		);
	}
	const isValue = (v: unknown): v is ParameterValue =>
		(typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean' || typeof v === 'string';
	if (Array.isArray(r.equals)) {
		if (r.equals.length === 0 || !r.equals.every((v) => isValue(v))) {
			diagnostics.push(
				error('inspector/visible-when', `visibleWhen.equals must be a non-empty array of primitive values at ${path}`, path)
			);
		}
	} else if (!isValue(r.equals)) {
		diagnostics.push(
			error('inspector/visible-when', `visibleWhen.equals must be a primitive value or a non-empty array at ${path}`, path)
		);
	}
}

const BINDING_KIND_MAP: Record<string, readonly string[]> = {
	slider: ['parameter'],
	toggle: ['parameter'],
	select: ['parameter'],
	text: ['parameter'],
	button: ['command', 'private-callback']
} as const;

export function validateInspectorTree(
	input: unknown,
	targets: InspectorTargets
): Result<InspectorTreeDescriptor> {
	if (input === null || typeof input !== 'object' || !Array.isArray((input as Record<string, unknown>).elements)) {
		return fail([error('inspector/tree', 'inspectorTree requires an elements array')]);
	}
	const tree = input as InspectorTreeDescriptor;
	const diagnostics: Diagnostic[] = [];
	const seenIds = new Set<string>();
	for (const el of tree.elements) {
		validateElement(el, targets, seenIds, diagnostics, 'root');
	}
	return diagnostics.length > 0 ? fail(diagnostics) : ok(tree);
}

function validateElement(
	el: InspectorElement,
	targets: InspectorTargets,
	seenIds: Set<string>,
	diagnostics: Diagnostic[],
	path: string
): void {
	if (el === null || typeof el !== 'object' || typeof (el as { kind?: unknown }).kind !== 'string') {
		diagnostics.push(error('inspector/invalid-element', `invalid element at ${path}`, path));
		return;
	}
	const id = (el as { id?: unknown }).id;
	if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
		diagnostics.push(error('inspector/duplicate-element', `element '${String(id)}' has an invalid id`, path));
	} else if (seenIds.has(id)) {
		diagnostics.push(error('inspector/duplicate-element', `duplicate element id '${id}'`, `${path}.${id}`));
	} else {
		seenIds.add(id);
	}

	validateVisibilityRule((el as { visibleWhen?: unknown }).visibleWhen, targets, diagnostics, `${path}.${String(id)}`);

	const kind = el.kind;
	if (kind === 'label') {
		if (typeof (el as { text?: unknown }).text !== 'string') {
			diagnostics.push(error('inspector/invalid-element', `label '${id}' requires text`, path));
		}
		return;
	}
	if (kind === 'section') {
		const children = (el as { children?: unknown }).children;
		if (!Array.isArray(children)) {
			diagnostics.push(error('inspector/invalid-element', `section '${id}' requires children`, path));
			return;
		}
		for (const child of children) {
			validateElement(child as InspectorElement, targets, seenIds, diagnostics, `${path}.${String(id)}`);
		}
		return;
	}

	const binding = (el as { binding?: unknown }).binding;
	if (binding === null || typeof binding !== 'object' || typeof (binding as { kind?: unknown }).kind !== 'string') {
		diagnostics.push(error('inspector/binding', `element '${String(id)}' has an invalid binding`, path));
		return;
	}
	const b = binding as InspectorBinding;
	const allowed = BINDING_KIND_MAP[kind] ?? [];
	if (!allowed.includes(b.kind)) {
		diagnostics.push(
			error('inspector/binding-kind', `element '${String(id)}' (${kind}) cannot bind kind '${b.kind}'`, path)
		);
		return;
	}
	if (b.kind === 'parameter' && !targets.parameters.has(b.parameterId)) {
		diagnostics.push(error('inspector/binding', `element '${String(id)}' binds unknown parameter '${b.parameterId}'`, path));
	} else if (b.kind === 'command' && !targets.commands.has(b.commandId)) {
		diagnostics.push(error('inspector/binding', `element '${String(id)}' binds unknown command '${b.commandId}'`, path));
	} else if (b.kind === 'private-callback' && !targets.callbacks.has(b.callbackId)) {
		diagnostics.push(
			error('inspector/binding', `element '${String(id)}' binds unknown private callback '${b.callbackId}'`, path)
		);
	}
}
