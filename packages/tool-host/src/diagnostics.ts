/**
 * Session-scoped diagnostic log: keeps the last N diagnostics (startup failures, invalid
 * computed results, surface problems, container-emitted diagnostics) for Host chrome and
 * Reload/Restart flows.
 */
import type { Diagnostic } from 'tool-contract';

export class DiagnosticLog {
	private readonly entries: Diagnostic[] = [];
	private readonly capacity: number;

	constructor(capacity = 50) {
		this.capacity = capacity;
	}

	push(diagnostic: Diagnostic): Diagnostic {
		this.entries.push(diagnostic);
		if (this.entries.length > this.capacity) {
			this.entries.splice(0, this.entries.length - this.capacity);
		}
		return diagnostic;
	}

	list(): readonly Diagnostic[] {
		return this.entries;
	}

	clear(): void {
		this.entries.length = 0;
	}
}