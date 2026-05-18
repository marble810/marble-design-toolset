import assert from 'node:assert/strict';
import test from 'node:test';

import { createGoogleFontsBrowseUrl, parseGoogleFontUrlInput } from './google-fonts.ts';

test('parseGoogleFontUrlInput parses Google Fonts CSS URLs with family and weights', () => {
	assert.deepEqual(
		parseGoogleFontUrlInput(
			'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap'
		),
		{ family: 'Inter', weights: [400, 700] }
	);
});

test('parseGoogleFontUrlInput parses Google Fonts specimen URLs', () => {
	assert.deepEqual(parseGoogleFontUrlInput('https://fonts.google.com/specimen/Noto+Sans+SC'), {
		family: 'Noto Sans SC',
		weights: []
	});
});

test('parseGoogleFontUrlInput parses Google Fonts share selection URLs', () => {
	assert.deepEqual(
		parseGoogleFontUrlInput(
			'https://fonts.google.com/share?selection.family=Roboto:wght@400;500;700'
		),
		{ family: 'Roboto', weights: [400, 500, 700] }
	);
});

test('createGoogleFontsBrowseUrl uses parsed family names when given a Google Fonts URL', () => {
	assert.equal(
		createGoogleFontsBrowseUrl('https://fonts.google.com/specimen/Space+Grotesk'),
		'https://fonts.google.com/?query=Space%20Grotesk'
	);
	assert.equal(createGoogleFontsBrowseUrl(''), 'https://fonts.google.com/');
});
