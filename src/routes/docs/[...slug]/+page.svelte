<script lang="ts">
	import { PixelIcon } from '$lib/components/ui';
	import { loadDocModule } from '$lib/docs/runtime';

	let { data } = $props();
	let docModulePromise = $derived(data.doc ? loadDocModule(data.doc.importPath) : null);
</script>

{#if data.doc && docModulePromise}
	<section class="docs-article">
		<div class="docs-article__meta">
			<span class="docs-article__path">{data.doc.sourcePath}</span>
		</div>

		<div class="docs-article__content">
			{#await docModulePromise then docModule}
				{@const DocComponent = docModule.default}
				<DocComponent />
			{:catch error}
				<div class="docs-article__error">
					<div class="docs-article__error-icon">
						<PixelIcon name="cancel" size={16} />
					</div>
					<div>
						<h1 class="docs-article__error-title">Document failed to load.</h1>
						<p class="docs-article__error-copy">{error instanceof Error ? error.message : 'Unknown loading error.'}</p>
					</div>
				</div>
			{/await}
		</div>
	</section>
{:else}
	<section class="docs-missing">
		<div class="docs-missing__icon">
			<PixelIcon name="cancel" size={18} />
		</div>
		<h1 class="docs-missing__title">Document not found.</h1>
		<p class="docs-missing__copy">
			The path /docs/{data.requestedSlug} does not match any Markdown file in the repository docs directory.
		</p>

		{#if data.firstDoc}
			<div class="docs-missing__actions">
				<a class="button button--solid button--md" href={data.firstDoc.href}>
					<PixelIcon name="arrow-right" size={14} />
					<span>Open {data.firstDoc.title}</span>
				</a>
			</div>
		{/if}
	</section>
{/if}

<style>
	.docs-article,
	.docs-missing {
		display: grid;
		gap: var(--space-5);
		min-height: 100%;
	}

	.docs-article__meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--color-border-soft);
	}

	.docs-article__path {
		color: var(--color-fg-muted);
		font-size: var(--font-size-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.docs-article__content {
		min-width: 0;
	}

	.docs-article__content :global(h1),
	.docs-article__content :global(h2),
	.docs-article__content :global(h3),
	.docs-article__content :global(h4) {
		margin: 0 0 var(--space-4);
		line-height: 1.2;
		letter-spacing: -0.02em;
	}

	.docs-article__content :global(h1) {
		font-size: clamp(26px, 3.6vw, 36px);
	}

	.docs-article__content :global(h2) {
		margin-top: var(--space-7);
		font-size: clamp(21px, 2.8vw, 30px);
	}

	.docs-article__content :global(h3) {
		margin-top: var(--space-6);
		font-size: clamp(18px, 2vw, 24px);
	}

	.docs-article__content :global(p),
	.docs-article__content :global(li),
	.docs-article__content :global(blockquote) {
		color: var(--color-fg-secondary);
		font-size: var(--font-size-3);
		line-height: 1.9;
	}

	.docs-article__content :global(p),
	.docs-article__content :global(ul),
	.docs-article__content :global(ol),
	.docs-article__content :global(pre),
	.docs-article__content :global(blockquote) {
		margin: 0 0 var(--space-4);
	}

	.docs-article__content :global(ul),
	.docs-article__content :global(ol) {
		padding-left: 20px;
	}

	.docs-article__content :global(a) {
		color: var(--color-fg-primary);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.docs-article__content :global(a:hover) {
		color: var(--color-accent-soft);
	}

	.docs-article__content :global(:not(pre) > code) {
		padding: 0 4px;
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-inset);
		font-size: var(--font-size-2);
	}

	.docs-article__content :global(pre) {
		overflow: auto;
		padding: var(--space-4);
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-inset);
	}

	.docs-article__content :global(pre code) {
		padding: 0;
		border: 0;
		background: transparent;
	}

	.docs-article__content :global(.hljs) {
		display: block;
		font-size: var(--font-size-2);
		line-height: 1.75;
		color: #d9e1ee;
	}

	.docs-article__content :global(code[class*='language-']),
	.docs-article__content :global(pre[class*='language-'] code) {
		display: block;
		font-size: var(--font-size-2);
		line-height: 1.75;
		color: #d9e1ee;
	}

	.docs-article__content :global(.token.comment),
	.docs-article__content :global(.token.prolog),
	.docs-article__content :global(.token.doctype),
	.docs-article__content :global(.token.cdata) {
		color: #7f8ea3;
	}

	.docs-article__content :global(.token.punctuation) {
		color: #c8d0df;
	}

	.docs-article__content :global(.token.namespace) {
		opacity: 0.7;
	}

	.docs-article__content :global(.token.property),
	.docs-article__content :global(.token.tag),
	.docs-article__content :global(.token.boolean),
	.docs-article__content :global(.token.number),
	.docs-article__content :global(.token.constant),
	.docs-article__content :global(.token.symbol),
	.docs-article__content :global(.token.deleted) {
		color: #f4c17a;
	}

	.docs-article__content :global(.token.selector),
	.docs-article__content :global(.token.attr-name),
	.docs-article__content :global(.token.string),
	.docs-article__content :global(.token.char),
	.docs-article__content :global(.token.builtin),
	.docs-article__content :global(.token.inserted) {
		color: #8cd4b7;
	}

	.docs-article__content :global(.token.operator),
	.docs-article__content :global(.token.entity),
	.docs-article__content :global(.token.url),
	.docs-article__content :global(.token.variable) {
		color: #cbb6ff;
	}

	.docs-article__content :global(.token.atrule),
	.docs-article__content :global(.token.attr-value),
	.docs-article__content :global(.token.function),
	.docs-article__content :global(.token.class-name) {
		color: #87aefb;
	}

	.docs-article__content :global(.token.keyword) {
		color: #f18fa8;
	}

	.docs-article__content :global(.token.regex),
	.docs-article__content :global(.token.important) {
		color: #8ecdfd;
	}

	.docs-article__content :global(.hljs-comment),
	.docs-article__content :global(.hljs-quote) {
		color: #7f8ea3;
	}

	.docs-article__content :global(.hljs-keyword),
	.docs-article__content :global(.hljs-selector-tag),
	.docs-article__content :global(.hljs-name),
	.docs-article__content :global(.hljs-subst) {
		color: #f18fa8;
	}

	.docs-article__content :global(.hljs-number),
	.docs-article__content :global(.hljs-literal),
	.docs-article__content :global(.hljs-variable),
	.docs-article__content :global(.hljs-template-variable),
	.docs-article__content :global(.hljs-tag .hljs-attr) {
		color: #f4c17a;
	}

	.docs-article__content :global(.hljs-string),
	.docs-article__content :global(.hljs-doctag) {
		color: #8cd4b7;
	}

	.docs-article__content :global(.hljs-title),
	.docs-article__content :global(.hljs-section),
	.docs-article__content :global(.hljs-selector-id) {
		color: #87aefb;
	}

	.docs-article__content :global(.hljs-type),
	.docs-article__content :global(.hljs-class .hljs-title) {
		color: #8ecdfd;
	}

	.docs-article__content :global(.hljs-tag),
	.docs-article__content :global(.hljs-selector-class),
	.docs-article__content :global(.hljs-selector-attr),
	.docs-article__content :global(.hljs-selector-pseudo),
	.docs-article__content :global(.hljs-attribute) {
		color: #cbb6ff;
	}

	.docs-article__content :global(.hljs-built_in),
	.docs-article__content :global(.hljs-builtin-name),
	.docs-article__content :global(.hljs-symbol),
	.docs-article__content :global(.hljs-bullet),
	.docs-article__content :global(.hljs-link) {
		color: #7bcde4;
	}

	.docs-article__content :global(.hljs-emphasis) {
		font-style: italic;
	}

	.docs-article__content :global(.hljs-strong) {
		font-weight: 700;
	}

	.docs-article__content :global(blockquote) {
		padding-left: var(--space-4);
		border-left: 2px solid var(--color-border-strong);
	}

	.docs-article__content :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: var(--space-4);
	}

	.docs-article__content :global(th),
	.docs-article__content :global(td) {
		padding: var(--space-3);
		border: 1px solid var(--color-border-soft);
		text-align: left;
	}

	.docs-article__error,
	.docs-missing {
		max-width: 760px;
	}

	.docs-article__error,
	.docs-missing {
		align-content: center;
	}

	.docs-article__error {
		display: flex;
		align-items: flex-start;
		gap: var(--space-4);
		padding: var(--space-5);
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-surface);
	}

	.docs-article__error-icon,
	.docs-missing__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: 1px solid var(--color-border-soft);
		background: var(--color-bg-inset);
		color: var(--color-fg-secondary);
	}

	.docs-article__error-title,
	.docs-missing__title {
		margin: 0 0 var(--space-2);
		font-size: clamp(22px, 2.8vw, 32px);
		line-height: 1.1;
		letter-spacing: -0.02em;
	}

	.docs-article__error-copy,
	.docs-missing__copy {
		margin: 0;
		color: var(--color-fg-secondary);
		font-size: var(--font-size-3);
		line-height: 1.8;
	}

	.docs-missing__actions {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-5);
	}
</style>