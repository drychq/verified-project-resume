import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGitFixture, writeJson } from './fixture-data.mjs';
import { commandGit } from '../skills/verified-project-resume/scripts/collect_evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'skills/verified-project-resume/scripts/collect_evidence.mjs');
const NO_GIT_FIXTURE = path.join(ROOT, 'tests/fixtures/no-git-repository');

async function temporary(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'repo-evidence-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function runScript(args, env = process.env) { return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env }); }
function collectGit(repo, identity, out, extra = {}) { return commandGit({ repo, identity, out, starter_ref: null, upstream_ref: null, start_date: null, end_date: null, ...extra }); }

test('inventory classifies files without executing the project', async (t) => {
  const directory = await temporary(t); const output = path.join(directory, 'inventory.json');
  const result = runScript(['inventory', '--repo', NO_GIT_FIXTURE, '--out', output]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(await readFile(output, 'utf8'));
  const categories = Object.fromEntries(payload.files.map((item) => [item.path, item.category]));
  assert.equal(categories['README.md'], 'documentation');
  assert.equal(categories['src/index.cpp'], 'source');
  assert.equal(categories['tests/test_index.cpp'], 'test');
  assert.equal(categories['benchmarks/README.md'], 'benchmark');
  assert.equal(categories['vendor/tinydb.h'], 'vendor');
  assert.equal(payload.collection_policy, 'read-only-no-project-execution');
});

test('git collection degrades outside a standalone work tree', async (t) => {
  const directory = await temporary(t), identity = path.join(directory, 'identity.json'), output = path.join(directory, 'git.json');
  await writeJson(identity, { names: ['Student Dev'], emails: [], github_handle: null, status: 'partial' });
  assert.equal(collectGit(NO_GIT_FIXTURE, identity, output), 0);
  const payload = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(payload.availability, 'unavailable');
  assert.deepEqual(payload.identity_commits, []);
});

test('git collection degrades when git executable is unavailable', async (t) => {
  const directory = await temporary(t), identity = path.join(directory, 'identity.json'), output = path.join(directory, 'git.json');
  await writeJson(identity, { names: ['Student Dev'], emails: [], github_handle: null, status: 'partial' });
  const result = runScript(['git', '--repo', NO_GIT_FIXTURE, '--identity', identity, '--out', output], { ...process.env, PATH: '' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(await readFile(output, 'utf8')).reason, 'git executable is unavailable');
});

test('multiple emails, coauthors, and starter diff are preserved', async (t) => {
  const directory = await temporary(t), repo = path.join(directory, 'repo');
  const commits = await createGitFixture(repo), identity = path.join(directory, 'identity.json'), output = path.join(directory, 'git.json');
  await writeJson(identity, { names: ['Student Dev'], emails: ['student@example.test', 'student+school@example.test'], github_handle: null, status: 'confirmed' });
  assert.equal(collectGit(repo, identity, output, { starter_ref: 'starter' }), 0);
  const payload = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(payload.identity_commit_count, 3);
  assert.deepEqual(new Set(payload.identity_commits.map((item) => item.sha)), new Set([commits.first_user, commits.second_user, commits.coauthor_only]));
  assert.ok(!payload.identity_commits.some((item) => item.sha === commits.teammate));
  assert.deepEqual(new Set(payload.baselines[0].changed_files.map((item) => item.path)), new Set(['src/parser.cpp', 'src/cache.cpp', 'src/shared.cpp']));
});

test('missing identity does not claim commits', async (t) => {
  const directory = await temporary(t), repo = path.join(directory, 'repo'); await createGitFixture(repo);
  const identity = path.join(directory, 'identity.json'), output = path.join(directory, 'git.json');
  await writeJson(identity, { names: [], emails: [], github_handle: null, status: 'missing' });
  assert.equal(collectGit(repo, identity, output), 0);
  const payload = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(payload.identity_commit_count, 0); assert.ok(payload.commit_count > 0);
});

test('collector CLI exposes only inventory and git', () => {
  const result = runScript(['validate', '--archive', 'anything.json']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /inventory,git/);
});
