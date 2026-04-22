import { getDocBySlugPath, getDocRouteEntries } from '$lib/docs/metadata';

export function entries() {
	return getDocRouteEntries();
}

export function load({ params }) {
	const requestedSlug = params.slug ?? '';
	const doc = getDocBySlugPath(requestedSlug);

	return {
		doc,
		requestedSlug,
		notFound: !doc
	};
}