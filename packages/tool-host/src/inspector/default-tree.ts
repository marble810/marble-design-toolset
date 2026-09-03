/**
 * Default Inspector Tree: when a Catalog Entry has no `createInspector` output (empty or
 * absent tree), the Host renders one control per Parameter descriptor. Computed
 * parameters appear as disabled controls — the Host schedules them, the user never sets
 * them directly.
 */
import type {
	CatalogEntry,
	InspectorElement,
	InspectorTreeDescriptor,
	ParameterDescriptor
} from 'tool-contract';

export function buildDefaultInspectorTree(parameters: Record<string, ParameterDescriptor>): InspectorTreeDescriptor {
	const elements: InspectorElement[] = [];
	for (const id of Object.keys(parameters)) {
		const descriptor = parameters[id];
		const binding = { kind: 'parameter', parameterId: id } as const;
		switch (descriptor.type) {
			case 'number':
				elements.push({ kind: 'slider', id, label: descriptor.label, binding });
				break;
			case 'boolean':
				elements.push({ kind: 'toggle', id, label: descriptor.label, binding });
				break;
			case 'select':
				elements.push({ kind: 'select', id, label: descriptor.label, binding });
				break;
			case 'string':
				elements.push({ kind: 'text', id, label: descriptor.label, binding });
				break;
		}
	}
	return { elements };
}

/**
 * Single source of truth for the tree a Session renders: the Catalog `inspectorTree`
 * when it declares elements, otherwise the default tree generated from Parameter
 * descriptors. Constructor, Restart and staged Reload must all go through here so the
 * three paths cannot drift.
 */
export function resolveInspectorTree(entry: CatalogEntry): InspectorTreeDescriptor {
	if (entry.inspectorTree.elements.length > 0) return entry.inspectorTree;
	return buildDefaultInspectorTree(entry.parameters);
}