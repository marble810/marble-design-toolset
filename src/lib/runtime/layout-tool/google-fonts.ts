export interface ParsedGoogleFontUrl {
	family: string;
	weights: readonly number[];
}

function normalizeGoogleFontFamily(value: string): string {
	return decodeURIComponent(value).replace(/\+/g, ' ').trim().replace(/\s+/g, ' ');
}

function parseGoogleFontWeights(value: string): number[] {
	return [...new Set(Array.from(value.matchAll(/\b([1-9]00)\b/g), (match) => Number(match[1])))]
		.filter((weight) => Number.isFinite(weight))
		.sort((left, right) => left - right);
}

function parseGoogleFontSelection(value: string): ParsedGoogleFontUrl | null {
	const [familySource, axesSource = ''] = value.split(':', 2);
	const family = normalizeGoogleFontFamily(familySource);
	if (!family) {
		return null;
	}

	return {
		family,
		weights: parseGoogleFontWeights(axesSource)
	};
}

export function parseGoogleFontUrlInput(input: string): ParsedGoogleFontUrl | null {
	const trimmed = input.trim();
	if (!trimmed) {
		return null;
	}

	const candidate =
		/^[a-z]+:\/\//i.test(trimmed) || !/^fonts\./i.test(trimmed) ? trimmed : `https://${trimmed}`;
	let url: URL;
	try {
		url = new URL(candidate);
	} catch {
		return null;
	}

	if (url.hostname.includes('fonts.googleapis.com')) {
		for (const family of url.searchParams.getAll('family')) {
			const parsed = parseGoogleFontSelection(family);
			if (parsed) {
				return parsed;
			}
		}
	}

	if (url.hostname.includes('fonts.google.com')) {
		const selectionFamily = url.searchParams.get('selection.family') ?? url.searchParams.get('family');
		if (selectionFamily) {
			const parsed = parseGoogleFontSelection(selectionFamily);
			if (parsed) {
				return parsed;
			}
		}

		const specimen = url.pathname.match(/\/specimen\/([^/?#]+)/)?.[1];
		if (specimen) {
			const parsed = parseGoogleFontSelection(specimen);
			if (parsed) {
				return parsed;
			}
		}

		const query = url.searchParams.get('query');
		if (query) {
			return parseGoogleFontSelection(query);
		}
	}

	return null;
}

export function createGoogleFontsBrowseUrl(input = ''): string {
	const parsed = parseGoogleFontUrlInput(input);
	const query = (parsed?.family ?? input).trim();
	if (!query) {
		return 'https://fonts.google.com/';
	}

	return `https://fonts.google.com/?query=${encodeURIComponent(query)}`;
}
