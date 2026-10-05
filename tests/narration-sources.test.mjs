import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { makeNarrationRecords } from './fixture-data.mjs';
import { renderWorkspace, sealRecords, validateRecords, writeRecords } from '../skills/verified-project-resume/scripts/workspace.mjs';

async function temporary(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'narration-sources-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function find(records, id) { return records.find((item) => item.id === id); }

test('records built from a narrated account pass both stages without a repository', async () => {
  const records = makeNarrationRecords();
  assert.deepEqual(await validateRecords(records, { stage: 'star' }), []);
  const warnings = [];
  assert.deepEqual(await validateRecords(records, { warnings }), []);
  assert.ok(warnings.some((value) => value.includes('approximate')));
  assert.ok(warnings.some((value) => value.includes('performance wording')));
});

test('the rendered workspace includes a complete interview prep section and a clean resume', async (t) => {
  const workspace = await temporary(t);
  const records = makeNarrationRecords();
  await writeRecords(path.join(workspace, '.verified-resume', 'records.jsonl'), records);
  assert.deepEqual(await renderWorkspace(records, workspace), []);
  for (const name of ['stories.md', 'bullet-options.md', 'resume.md', 'review.md']) await stat(path.join(workspace, name));
  const review = await readFile(path.join(workspace, 'review.md'), 'utf8');
  assert.match(review, /## Interview prep/);
  assert.match(review, /### Grounding summary/);
  assert.match(review, /### Numbers you provided/);
  assert.match(review, /2000 QPS/);
  assert.match(review, /user-provided-number/);
  assert.match(review, /approximate wording/);
  assert.match(review, /Likely questions and suggested answers/);
  const resume = await readFile(path.join(workspace, 'resume.md'), 'utf8');
  assert.match(resume, /## Project overview/);
  assert.doesNotMatch(resume, /Interview prep/i);
  assert.doesNotMatch(resume, /user-provided/);
  assert.doesNotMatch(resume, /WARNING/);
});

test('tampering with a recorded confirmation breaks its digest', async () => {
  const records = makeNarrationRecords();
  find(records, 'ev-prop-parser').data.confirmation_excerpt = '对，都确认过了。';
  assert.ok((await validateRecords(records, { stage: 'star' })).some((error) => error.includes('invalid proposal confirmation digest')));
});

test('sealing recomputes proposal digests deterministically', async () => {
  const records = makeNarrationRecords();
  find(records, 'ev-prop-parser').data.sha256 = null;
  await sealRecords(records);
  const sealed = find(records, 'ev-prop-parser').data.sha256;
  assert.match(sealed, /^[a-f0-9]{64}$/);
  await sealRecords(records);
  assert.equal(find(records, 'ev-prop-parser').data.sha256, sealed);
  assert.deepEqual(await validateRecords(records, { stage: 'star' }), []);
});

test('the audit lists how each selected bullet is grounded', async () => {
  const { auditRecords } = await import('../skills/verified-project-resume/scripts/workspace.mjs');
  const audit = auditRecords(makeNarrationRecords());
  const candidate = audit.interviewPrep.find((item) => item.id === 'candidate-rule-parser-zh-CN');
  assert.ok(candidate);
  assert.equal(candidate.code_supported, 0);
  assert.ok(candidate.user_stated + candidate.proposal_confirmed > 0);
  assert.equal(candidate.user_numbers, 1);
  assert.ok(candidate.flags.includes('user-provided-number'));
  assert.ok(candidate.flags.includes('approximate-user-number'));
  assert.ok(audit.warnings.some((value) => value.includes('number provided from memory')));
});
