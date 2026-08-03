import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeLedger } from './fixture-data.mjs';
import { renderPool, renderResume, renderReview, renderStar } from '../skills/verified-project-resume/scripts/workspace.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = path.join(ROOT, 'skills', 'verified-project-resume');

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(item));
    else if (entry.isFile()) output.push(item);
  }
  return output;
}

test('top-level skills directory exposes one consolidated skill', async () => {
  const entries = await readdir(path.join(ROOT, 'skills'), { withFileTypes: true });
  const discovered = [];
  for (const entry of entries) if (entry.isDirectory()) {
    try { if ((await stat(path.join(ROOT, 'skills', entry.name, 'SKILL.md'))).isFile()) discovered.push(entry.name); } catch {}
  }
  assert.deepEqual(discovered.sort(), ['verified-project-resume']);
});

test('skill frontmatter is valid and matches its directory', async () => {
  const text = await readFile(path.join(SKILL, 'SKILL.md'), 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match);
  const fields = Object.fromEntries(match[1].split('\n').map((line) => { const index = line.indexOf(':'); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }));
  assert.equal(fields.name, 'verified-project-resume');
  assert.ok(fields.description.length > 100);
});

test('single skill is self-contained and Node-only', async () => {
  for (const item of ['SKILL.md', 'LICENSE', 'scripts', 'references', 'agents/openai.yaml']) assert.ok(await stat(path.join(SKILL, item)));
  const scripts = await filesBelow(path.join(SKILL, 'scripts'));
  assert.ok(scripts.some((file) => file.endsWith('.mjs')));
  assert.ok(!scripts.some((file) => file.endsWith('.py')));
  for (const script of scripts) {
    const text = await readFile(script, 'utf8');
    for (const marker of [/\b(?:import|from)\s+openai\b/i, /\b(?:import|from)\s+anthropic\b/i, /(?:from\s+['"]|require\(['"])(?:openai|@anthropic-ai|codex)/i]) assert.doesNotMatch(text, marker);
  }
});

test('core instructions are host-neutral and keep JSONL private', async () => {
  const text = (await readFile(path.join(SKILL, 'SKILL.md'), 'utf8')).toLowerCase();
  for (const marker of ['codex', 'openai', 'claude code']) assert.ok(!text.includes(marker));
  assert.match(text, /private machine state|machine records/);
  assert.doesNotMatch(text, /schema_version:\s*["']?2/);
  const metadata = await readFile(path.join(SKILL, 'agents/openai.yaml'), 'utf8');
  assert.match(metadata, /allow_implicit_invocation:\s*false/);
});

test('no public JSON schemas remain in the consolidated skill', async () => {
  const files = await filesBelow(SKILL);
  assert.ok(!files.some((file) => file.endsWith('.schema.json')));
});

test('English and Chinese READMEs share the universal install command', async () => {
  const command = 'npx skills add drychq/verified-project-resume';
  for (const name of ['README.md', 'README.zh-CN.md']) assert.ok((await readFile(path.join(ROOT, name), 'utf8')).includes(command));
});

test('script version matches package metadata and both READMEs', async () => {
  const { VERSION } = await import('../skills/verified-project-resume/scripts/lib/common.mjs');
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(VERSION, manifest.version);
  for (const name of ['README.md', 'README.zh-CN.md']) assert.ok((await readFile(path.join(ROOT, name), 'utf8')).includes(VERSION), name);
});

test('checked-in demo ships the four Markdown artifacts and the private ledger', async () => {
  for (const name of ['star.md', 'resume-candidate-pool.md', 'resume.md', 'review.md', '.verified-resume/ledger.jsonl']) assert.ok(await stat(path.join(ROOT, 'examples/synthetic-demo', name)));
});

test('checked-in demo is exactly reproducible from the generator fixture', async () => {
  const records = makeLedger({ storyCount: 6, selectedCount: 3, languages: ['zh-CN', 'en'] });
  const demo = path.join(ROOT, 'examples/synthetic-demo');
  assert.equal(await readFile(path.join(demo, '.verified-resume/ledger.jsonl'), 'utf8'), `${records.map((item) => JSON.stringify(item)).join('\n')}\n`);
  for (const [name, expected] of [['star.md', renderStar(records)], ['resume-candidate-pool.md', renderPool(records)], ['resume.md', renderResume(records)], ['review.md', renderReview(records, [])]]) assert.equal(await readFile(path.join(demo, name), 'utf8'), expected, name);
});
