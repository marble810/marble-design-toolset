import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';
import rehypeHighlight from 'rehype-highlight';

const markdownExtensions = ['.md'];

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', ...markdownExtensions],
	preprocess: [
		vitePreprocess(),
		mdsvex({
			extensions: markdownExtensions,
			rehypePlugins: [[rehypeHighlight, { detect: true, ignoreMissing: true }]]
		})
	],
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			precompress: false,
			strict: true
		})
	}
};

export default config;
