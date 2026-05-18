import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
renderMetadata,
renderPreviewComponent,
renderPreviewMasterComponent,
renderRecipeComponent,
renderRecipeMasterComponent,
renderStageComponent,
renderStageMasterComponent,
renderToolDefinition
} from './templates/index.js';

export const STARTER_TYPES = ['preview', 'stage'];
export const SUPPORTED_TECH_STACKS = ['three', 'pixi', 'gsap'];
export const CUSTOM_RECIPE_ID = 'custom';
export const CAPABILITY_RECIPES = [
{
id: 'preview-basic',
label: 'Basic preview',
starterType: 'preview',
techStacks: [],
componentSuffix: 'Preview',
description: 'Basic PreviewCanvas recipe scaffold for fixed-size previews.',
tags: ['starter', 'recipe', 'preview']
},
{
id: 'source-preview',
label: 'Source preview',
starterType: 'preview',
techStacks: [],
componentSuffix: 'SourcePreview',
description: 'Source input and PreviewCanvas recipe scaffold for local files.',
tags: ['starter', 'recipe', 'source', 'preview']
},
{
id: 'pixi-preview',
label: 'Pixi preview',
starterType: 'preview',
techStacks: ['pixi'],
componentSuffix: 'PixiPreview',
description: 'Pixi and PreviewCanvas recipe scaffold for 2D render tools.',
tags: ['starter', 'recipe', 'pixi', 'preview']
},
{
id: 'three-stage',
label: 'Three stage',
starterType: 'stage',
techStacks: ['three'],
componentSuffix: 'ThreeStage',
description: 'Three.js FullStage recipe scaffold for WebGL scenes.',
tags: ['starter', 'recipe', 'three', 'stage']
},
{
id: 'preview-export',
label: 'Preview export',
starterType: 'preview',
techStacks: [],
componentSuffix: 'ExportPreview',
description: 'PreviewCanvas recipe scaffold with framework export registration.',
tags: ['starter', 'recipe', 'export', 'preview'],
exportCapabilities: { image: true }
},
{
id: 'layout-template',
label: 'Layout template',
starterType: 'preview',
techStacks: [],
componentSuffix: 'LayoutPreview',
description: 'Responsive DOM layout template recipe with source slots, fonts, and PNG export.',
tags: ['starter', 'recipe', 'layout', 'template', 'dom'],
exportCapabilities: { image: true }
}
];

const RECIPE_ALIASES = new Map([
['basic', 'preview-basic'],
['preview', 'preview-basic'],
['preview-basic', 'preview-basic'],
['source', 'source-preview'],
['source-preview', 'source-preview'],
['file', 'source-preview'],
['files', 'source-preview'],
['pixi', 'pixi-preview'],
['pixi-preview', 'pixi-preview'],
['three', 'three-stage'],
['three-stage', 'three-stage'],
['webgl', 'three-stage'],
['export', 'preview-export'],
['preview-export', 'preview-export'],
['layout', 'layout-template'],
['layout-template', 'layout-template'],
['template', 'layout-template'],
['custom', CUSTOM_RECIPE_ID],
['manual', CUSTOM_RECIPE_ID],
['none', CUSTOM_RECIPE_ID]
]);

function capitalize(value) {
return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function tokenizeName(input) {
return input
.trim()
.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
.replace(/[^A-Za-z0-9]+/g, ' ')
.split(/\s+/)
.filter(Boolean)
.map((token) => token.toLowerCase());
}

export function deriveToolNames(input) {
const tokens = tokenizeName(input);

if (!tokens.length) {
throw new Error('Tool name must include at least one letter or number.');
}

const toolId = tokens.join('-');

if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(toolId)) {
throw new Error('Tool name must normalize to a kebab-case id that starts with a letter.');
}

return {
toolId,
displayName: tokens.map(capitalize).join(' '),
componentName: tokens.map(capitalize).join('')
};
}

export function normalizeStarterType(input) {
const normalized = input.trim().toLowerCase();

if (!normalized || normalized === '1' || normalized === 'preview' || normalized === 'p') {
return 'preview';
}

if (normalized === '2' || normalized === 'stage' || normalized === 's') {
return 'stage';
}

throw new Error(`Unknown starter type: ${input}`);
}

export function normalizeRecipeInput(input) {
const normalized = input.trim().toLowerCase();

if (!normalized) {
return 'preview-basic';
}

const numericChoice = Number.parseInt(normalized, 10);
if (String(numericChoice) === normalized) {
if (numericChoice >= 1 && numericChoice <= CAPABILITY_RECIPES.length) {
return CAPABILITY_RECIPES[numericChoice - 1].id;
}
if (numericChoice === CAPABILITY_RECIPES.length + 1) {
return CUSTOM_RECIPE_ID;
}
}

const alias = RECIPE_ALIASES.get(normalized);
if (alias) {
return alias;
}

throw new Error(`Unknown capability recipe: ${input}`);
}

export function getCapabilityRecipe(recipeId) {
return CAPABILITY_RECIPES.find((recipe) => recipe.id === recipeId) ?? null;
}

export function parseTechStackInput(input) {
if (!input.trim()) {
return [];
}

const values = input
.split(',')
.map((value) => value.trim().toLowerCase())
.filter(Boolean);

const deduped = [];

for (const value of values) {
if (!SUPPORTED_TECH_STACKS.includes(value)) {
throw new Error(`Unsupported tech stack: ${value}`);
}

if (!deduped.includes(value)) {
deduped.push(value);
}
}

return deduped;
}

async function promptUntilValid({ rl, question, parse, fallback }) {
while (true) {
const answer = await rl.question(question);
const value = answer.trim() || fallback;

try {
return parse(value ?? '');
} catch (error) {
console.error(error instanceof Error ? error.message : String(error));
}
}
}

function formatRecipePrompt() {
const recipeChoices = CAPABILITY_RECIPES.map((recipe, index) => `[${index + 1}] ${recipe.id}`).join(', ');
return `Capability recipe (${recipeChoices}, [${CAPABILITY_RECIPES.length + 1}] custom) [1]: `;
}

export async function collectScaffoldOptions({ rl, initialName }) {
const toolIdentity = initialName
? deriveToolNames(initialName)
: await promptUntilValid({
rl,
question: 'Tool name: ',
parse: deriveToolNames
});

const recipeId = await promptUntilValid({
rl,
question: formatRecipePrompt(),
parse: normalizeRecipeInput,
fallback: 'preview-basic'
});

if (recipeId !== CUSTOM_RECIPE_ID) {
const recipe = getCapabilityRecipe(recipeId);
if (!recipe) {
throw new Error(`Unknown capability recipe: ${recipeId}`);
}

return {
...toolIdentity,
recipeId: recipe.id,
starterType: recipe.starterType,
techStacks: [...recipe.techStacks],
description: recipe.description,
tags: [...recipe.tags],
version: '1.0.0',
enabled: true
};
}

const starterType = await promptUntilValid({
rl,
question: 'Starter type ([1] preview, [2] stage) [1]: ',
parse: normalizeStarterType,
fallback: 'preview'
});

const techStacks = await promptUntilValid({
rl,
question: `Tech stacks (comma-separated: ${SUPPORTED_TECH_STACKS.join(', ')}) [none]: `,
parse: parseTechStackInput,
fallback: ''
});

return {
...toolIdentity,
recipeId: CUSTOM_RECIPE_ID,
starterType,
techStacks,
description: `${capitalize(starterType)} starter scaffold for the ${toolIdentity.displayName} tool.`,
tags: ['starter', starterType],
version: '1.0.0',
enabled: true
};
}

async function assertToolDirectoryAvailable(toolDir) {
try {
await access(toolDir);
throw new Error(`Tool directory already exists: ${toolDir}`);
} catch (error) {
if (error instanceof Error && error.message.startsWith('Tool directory already exists:')) {
throw error;
}
}
}

function resolveRecipe(recipeId) {
if (!recipeId || recipeId === CUSTOM_RECIPE_ID) {
return null;
}

if (typeof recipeId === 'object' && 'id' in recipeId) {
return resolveRecipe(recipeId.id);
}

const recipe = getCapabilityRecipe(recipeId);
if (!recipe) {
throw new Error(`Unsupported capability recipe: ${recipeId}`);
}
return recipe;
}

export function buildScaffoldFiles({
toolId,
displayName,
componentName,
starterType = 'preview',
techStacks = [],
recipeId,
recipe,
description,
tags,
version = '1.0.0',
enabled = true
}) {
const resolvedRecipe = resolveRecipe(recipeId ?? recipe);
const resolvedStarterType = resolvedRecipe?.starterType ?? starterType;
const resolvedTechStacks = resolvedRecipe ? [...resolvedRecipe.techStacks] : techStacks;
const resolvedDescription = description ?? resolvedRecipe?.description ?? `${capitalize(resolvedStarterType)} starter scaffold for the ${displayName} tool.`;
const resolvedTags = tags ?? resolvedRecipe?.tags ?? ['starter', resolvedStarterType];
const childComponentName = resolvedRecipe
? `${componentName}${resolvedRecipe.componentSuffix}`
: resolvedStarterType === 'stage'
? `${componentName}Stage`
: `${componentName}Preview`;
const masterComponent = resolvedRecipe
? renderRecipeMasterComponent({
toolId,
componentName,
displayName,
techStacks: resolvedTechStacks,
recipe: resolvedRecipe,
childComponentName
})
: resolvedStarterType === 'stage'
? renderStageMasterComponent({ toolId, componentName, displayName, techStacks: resolvedTechStacks })
: renderPreviewMasterComponent({ toolId, componentName, displayName, techStacks: resolvedTechStacks });
const childComponent = resolvedRecipe
? renderRecipeComponent({ toolId, displayName, recipe: resolvedRecipe })
: resolvedStarterType === 'stage'
? renderStageComponent({ toolId, displayName, techStacks: resolvedTechStacks })
: renderPreviewComponent({ toolId, displayName });

return new Map([
[
'metadata.json',
renderMetadata({
displayName,
description: resolvedDescription,
starterType: resolvedStarterType,
version,
enabled,
tags: resolvedTags,
exportCapabilities: resolvedRecipe?.exportCapabilities
})
],
['index.ts', renderToolDefinition({ componentName, techStacks: resolvedTechStacks })],
[`${componentName}.svelte`, masterComponent],
[path.join('components', `${childComponentName}.svelte`), childComponent]
]);
}

export async function createToolScaffold({ workspaceRoot, ...options }) {
const recipe = resolveRecipe(options.recipeId ?? options.recipe);
const starterType = recipe?.starterType ?? options.starterType;
const techStacks = recipe ? [...recipe.techStacks] : (options.techStacks ?? []);

if (!STARTER_TYPES.includes(starterType)) {
throw new Error(`Unsupported starter type: ${starterType}`);
}

for (const techStack of techStacks) {
if (!SUPPORTED_TECH_STACKS.includes(techStack)) {
throw new Error(`Unsupported tech stack: ${techStack}`);
}
}

const toolDir = path.join(workspaceRoot, 'src', 'tools', options.toolId);
await assertToolDirectoryAvailable(toolDir);

const files = buildScaffoldFiles({ ...options, starterType, techStacks, recipeId: recipe?.id ?? options.recipeId });
await mkdir(path.join(toolDir, 'components'), { recursive: true });

for (const [relativePath, content] of files) {
await writeFile(path.join(toolDir, relativePath), content, 'utf8');
}

return {
toolDir,
createdFiles: [...files.keys()],
toolId: options.toolId,
displayName: options.displayName,
recipeId: recipe?.id ?? options.recipeId ?? null
};
}
