import type { WorkspaceState } from '$lib/types/tool';
import { sanitizeWorkspaceToolSelection } from './tool-availability.js';

const STORAGE_KEY = 'marble-design-toolset:workspace';
export const DEFAULT_LEFT_PANEL_WIDTH_VW = 28;
export const MIN_LEFT_PANEL_WIDTH_VW = 22;
export const MAX_LEFT_PANEL_WIDTH_VW = 40;

function defaultState(): WorkspaceState {
	return {
		openToolIds: [],
		activeToolId: null,
		leftPanelWidthVw: DEFAULT_LEFT_PANEL_WIDTH_VW
	};
}

export function clampLeftPanelWidthVw(value: number): number {
	if (!Number.isFinite(value)) {
		return DEFAULT_LEFT_PANEL_WIDTH_VW;
	}

	return Math.min(MAX_LEFT_PANEL_WIDTH_VW, Math.max(MIN_LEFT_PANEL_WIDTH_VW, Math.round(value)));
}

export function readHashToolId(): string | null {
	if (typeof window === 'undefined') {
		return null;
	}

	const rawHash = window.location.hash.replace(/^#/, '').trim();
	return rawHash || null;
}

export function writeHashToolId(toolId: string | null): void {
	if (typeof window === 'undefined') {
		return;
	}

	const nextUrl = toolId
		? `${window.location.pathname}${window.location.search}#${toolId}`
		: `${window.location.pathname}${window.location.search}`;

	window.history.replaceState(window.history.state, '', nextUrl);
}

function sanitizeState(input: Partial<WorkspaceState> | null | undefined, validToolIds: string[]): WorkspaceState {
	const { openToolIds, activeToolId } = sanitizeWorkspaceToolSelection(input, validToolIds);

	return {
		openToolIds,
		activeToolId,
		leftPanelWidthVw: clampLeftPanelWidthVw(input?.leftPanelWidthVw ?? DEFAULT_LEFT_PANEL_WIDTH_VW)
	};
}

export function readStoredWorkspaceState(validToolIds: string[]): WorkspaceState {
	if (typeof window === 'undefined') {
		return defaultState();
	}

	try {
		const rawValue = window.localStorage.getItem(STORAGE_KEY);
		if (!rawValue) {
			return defaultState();
		}

		return sanitizeState(JSON.parse(rawValue), validToolIds);
	} catch {
		return defaultState();
	}
}

export function resolveInitialWorkspaceState(validToolIds: string[]): WorkspaceState {
	const stored = readStoredWorkspaceState(validToolIds);
	const hashToolId = readHashToolId();

	if (!hashToolId || !validToolIds.includes(hashToolId)) {
		return stored;
	}

	const openToolIds = stored.openToolIds.includes(hashToolId)
		? stored.openToolIds
		: [...stored.openToolIds, hashToolId];

	return {
		...stored,
		openToolIds,
		activeToolId: hashToolId
	};
}

export function persistWorkspaceState(state: WorkspaceState): void {
	if (typeof window === 'undefined') {
		return;
	}

	window.localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({
			openToolIds: state.openToolIds,
			activeToolId: state.activeToolId,
			leftPanelWidthVw: clampLeftPanelWidthVw(state.leftPanelWidthVw)
		})
	);
}