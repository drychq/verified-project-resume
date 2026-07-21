import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { makeArchive, makeLedger } from './fixture-data.mjs';
import { auditLedger, importLegacyArchive, main, renderWorkspace, sealLedger, validateLedger, writeLedger } from '../skills/verified-project-resume/scripts/workspace.mjs';

async function temporary(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'workspace-guard-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function find(records, id) { return records.find((item) => item.id === id); }

test('valid detailed STAR, candidate pool, and selection pass', async () => {
  assert.deepEqual(await validateLedger(makeLedger()), []);
});

test('six independent contributions create six stories while final selection stays concise', async () => {
  const records = makeLedger({ storyCount: 6, selectedCount: 3 });
  assert.equal(records.filter((item) => item.record_type === 'story').length, 6);
  assert.equal(records.filter((item) => item.record_type === 'candidate-group').length, 6);
  assert.equal(find(records, 'selection:current').refs.selected_group_ids.length, 3);
  assert.deepEqual(await validateLedger(records), []);
});

test('one supported story may produce one final bullet without duplication', async () => {
  const records = makeLedger({ storyCount: 1, selectedCount: 1 });
  assert.deepEqual(await validateLedger(records), []);
  assert.ok(auditLedger(records).warnings.some((value) => value.includes('Only one supported final bullet')));
});

test('eligible contribution must be covered by STAR or explicitly omitted', async () => {
  const records = makeLedger();
  records.splice(records.findIndex((item) => item.id === 'story-parser'), 1);
  assert.ok((await validateLedger(records, { stage: 'star' })).some((error) => error.includes('neither covered by STAR')));
  find(records, 'contribution-parser').data.star_omission_reason = 'Evidence is duplicated by another reviewed story.';
  assert.ok(!(await validateLedger(records, { stage: 'star' })).some((error) => error.includes('neither covered by STAR')));
});

test('candidate cannot bypass its STAR source chain', async () => {
  const records = makeLedger();
  const candidate = find(records, 'candidate-parser-en');
  candidate.refs.claim_ids = ['claim-storage'];
  assert.ok((await validateLedger(records)).some((error) => error.includes('bypasses the cited STAR story')));
});

test('candidate clauses cannot hide sources omitted from candidate refs', async () => {
  const records = makeLedger({ languages: ['en'] });
  find(records, 'candidate-parser-en').data.clauses.method.claim_ids = ['claim-storage'];
  find(records, 'candidate-parser-en').data.clauses.method.evidence_ids = ['ev-storage'];
  assert.ok((await validateLedger(records)).some((error) => error.includes('candidate claim_ids must exactly match clause sources')));
});

test('candidate must cite a STAR story and selection must cite the pool', async () => {
  const records = makeLedger();
  find(records, 'candidate-parser-en').refs.story_ids = [];
  find(records, 'selection:current').refs.selected_group_ids = ['story-parser'];
  const errors = await validateLedger(records);
  assert.ok(errors.some((error) => error.includes('must cite a STAR story')));
  assert.ok(errors.some((error) => error.includes('unknown candidate group')));
});

test('candidate cannot cite an ineligible or unreviewed legacy story', async () => {
  const records = makeLedger({ languages: ['en'] });
  const story = find(records, 'story-parser'); story.data.resume_eligible = false; story.data.legacy_review_required = true;
  assert.ok((await validateLedger(records)).some((error) => error.includes("is not resume eligible")));
});

test('no-number verified capability candidate remains valid', async () => {
  const records = makeLedger({ storyCount: 1, selectedCount: 1, languages: ['en'] });
  assert.equal(records.filter((item) => item.record_type === 'metric').length, 0);
  assert.deepEqual(await validateLedger(records), []);
});

test('injected number is rejected', async () => {
  const records = makeLedger({ languages: ['en'] });
  find(records, 'candidate-parser-en').data.text += ' for 500 users';
  assert.ok((await validateLedger(records)).some((error) => error.includes("numeric token '500'")));
});

test('verified count is allowed while user-confirmed metric is rejected', async () => {
  const records = makeLedger({ storyCount: 1, selectedCount: 1, languages: ['en'] });
  const metric = { record_type: 'metric', id: 'metric-tests', data: { name: 'deterministic tests', kind: 'count', status: 'verified-count', value: 12, unit: 'tests', baseline: null, result: null, measurement_method: 'Counted from the cited test evidence.', resume_eligible: true }, refs: { evidence_ids: ['ev-parser'] } };
  records.push(metric);
  find(records, 'contribution-parser').refs.metric_ids = ['metric-tests'];
  const story = find(records, 'story-parser'); story.refs.metric_ids = ['metric-tests']; story.data.results[0].metric_ids = ['metric-tests']; story.data.results[0].text = 'Passed 12 deterministic tests within the cited project boundary.';
  const candidate = find(records, 'candidate-parser-en'); candidate.refs.metric_ids = ['metric-tests']; candidate.data.text = 'Implemented the bounded parser change and passed 12 deterministic tests.'; candidate.data.clauses.result.metric_ids = ['metric-tests']; candidate.data.clauses.result.text = 'Passed 12 deterministic tests';
  assert.deepEqual(await validateLedger(records), []);
  metric.data.status = 'user-confirmed'; metric.data.resume_eligible = false;
  assert.ok((await validateLedger(records)).some((error) => error.includes("inadmissible metric 'metric-tests'")));
});

test('approximate numeric wording is rejected', async () => {
  const records = makeLedger({ storyCount: 1, selectedCount: 1, languages: ['en'] });
  find(records, 'claim-parser').data.text += ' The user remembered about 12 tests.';
  find(records, 'candidate-parser-en').data.text += ' with about 12 tests';
  assert.ok((await validateLedger(records)).some((error) => error.includes('approximate or range')));
});

test('strong ownership verb is rejected without evidence', async () => {
  const records = makeLedger({ languages: ['en'] });
  find(records, 'candidate-parser-en').data.text = 'Led and architected the parser subsystem.';
  const errors = await validateLedger(records);
  assert.ok(errors.some((error) => error.includes("strong verb 'led'")));
  assert.ok(errors.some((error) => error.includes('architecture wording')));
});

test('STAR Task ownership and architecture wording is guarded', async () => {
  const records = makeLedger({ languages: ['en'] });
  find(records, 'story-parser').data.task[0].text = 'The user owned and architected the entire parser subsystem.';
  const errors = await validateLedger(records, { stage: 'star' });
  assert.ok(errors.some((error) => error.includes("strong verb 'owned'")));
  assert.ok(errors.some((error) => error.includes('architecture wording')));
  const resultRecords = makeLedger({ languages: ['en'] });
  find(resultRecords, 'story-parser').data.results[0].text = 'The user owned and architected the entire parser subsystem.';
  const resultErrors = await validateLedger(resultRecords, { stage: 'star' });
  assert.ok(resultErrors.some((error) => error.includes("strong verb 'owned'")));
  assert.ok(resultErrors.some((error) => error.includes('architecture wording')));
});

test('dependency integration cannot be escalated to implementation', async () => {
  const records = makeLedger({ languages: ['en'] });
  const claim = find(records, 'claim-storage');
  claim.data.action_kind = 'integrated'; claim.data.tags = ['dependency-integration'];
  const candidate = find(records, 'candidate-storage-en');
  candidate.data.text = 'Implemented SQLite for the storage path.';
  candidate.data.clauses.action.text = 'Implemented SQLite';
  const errors = await validateLedger(records);
  assert.ok(errors.some((error) => error.includes('implementation wording exceeds') || error.includes('escalated')));
});

test('production, reliability, scale, and causal wording require evidence tags', async () => {
  const records = makeLedger({ languages: ['en'] });
  find(records, 'candidate-cache-en').data.text += ' with production reliability at scale, thereby enabled growth';
  const errors = await validateLedger(records);
  for (const label of ['production wording', 'reliability wording', 'scale wording', 'causal wording']) assert.ok(errors.some((error) => error.includes(label)), label);
});

test('bilingual variants must use identical sources', async () => {
  const records = makeLedger();
  find(records, 'candidate-parser-zh-CN').refs.evidence_ids = ['ev-storage'];
  assert.ok((await validateLedger(records)).some((error) => error.includes('bilingual variants')));
});

test('every candidate group must contain the requested languages and matching compression methods', async () => {
  const missing = makeLedger();
  find(missing, 'group-parser').refs.candidate_ids = ['candidate-parser-en'];
  assert.ok((await validateLedger(missing)).some((error) => error.includes('exactly one candidate per selected language')));
  const mismatch = makeLedger();
  find(mismatch, 'candidate-parser-en').data.compression_method = 'action-method-result';
  assert.ok((await validateLedger(mismatch)).some((error) => error.includes('same compression method')));
  const invented = makeLedger();
  find(invented, 'candidate-parser-en').data.compression_method = 'fabricated-mode';
  find(invented, 'candidate-parser-zh-CN').data.compression_method = 'fabricated-mode';
  assert.ok((await validateLedger(invented)).some((error) => error.includes('invalid compression method')));
});

test('final selection requires a target role or job description', async () => {
  const records = makeLedger();
  const selection = find(records, 'selection:current'); selection.data.target_role = ''; selection.data.job_description = '';
  assert.ok((await validateLedger(records)).some((error) => error.includes('target role or job description required')));
});

test('every unselected candidate group requires a role-specific omission reason', async () => {
  const records = makeLedger({ storyCount: 3, selectedCount: 2 });
  find(records, 'group-cache').data.selection_omission_reason = null;
  assert.ok((await validateLedger(records)).some((error) => error.includes('unselected group requires')));
});

test('retargeting changes selection records without changing verified facts or STAR', async () => {
  const first = makeLedger({ storyCount: 3, selectedCount: 2 });
  const second = structuredClone(first);
  find(second, 'selection:current').data.target_role = 'storage engineer';
  find(second, 'selection:current').refs.selected_group_ids = ['group-storage', 'group-cache'];
  find(second, 'group-parser').data.selection_omission_reason = 'Less relevant to storage work.';
  find(second, 'group-cache').data.selection_omission_reason = null;
  assert.deepEqual(await validateLedger(second), []);
  const stableTypes = new Set(['evidence', 'claim', 'contribution', 'metric', 'story']);
  assert.deepEqual(first.filter((item) => stableTypes.has(item.record_type)), second.filter((item) => stableTypes.has(item.record_type)));
});

test('evidence digest is recomputed', async () => {
  const records = makeLedger();
  find(records, 'ev-parser').data.excerpt = 'Tampered after collection.';
  assert.ok((await validateLedger(records, { stage: 'star' })).some((error) => error.includes('canonical-record digest mismatch')));
});

test('unavailable evidence cannot support a resume-eligible claim or metric', async () => {
  const records = makeLedger({ storyCount: 1, selectedCount: 1, languages: ['en'] });
  const evidence = find(records, 'ev-parser'); evidence.data.availability = 'unavailable'; evidence.data.digest_basis = 'not-applicable'; evidence.data.sha256 = null;
  const errors = await validateLedger(records);
  assert.ok(errors.some((error) => error.includes('resume-eligible claim requires collected evidence')));
});

test('user-confirmed claim requires collected confirmation evidence specifically', async () => {
  const records = makeLedger({ storyCount: 1, selectedCount: 1, languages: ['en'] });
  records.push({ record_type: 'evidence', id: 'ev-confirm-unavailable', data: { type: 'user-confirmation', availability: 'unavailable', title: 'Missing confirmation', locator: {}, digest_basis: 'not-applicable', sha256: null, excerpt: null, collected_at: '2026-07-20T00:00:00Z' }, refs: {} });
  const claim = find(records, 'claim-parser'); claim.data.status = 'user-confirmed'; claim.refs.evidence_ids.push('ev-confirm-unavailable');
  find(records, 'contribution-parser').refs.evidence_ids.push('ev-confirm-unavailable');
  const errors = await validateLedger(records);
  assert.ok(errors.some((error) => error.includes('collected user-confirmation evidence')));
});

test('STAR sections and candidate clauses require claim and evidence sources', async () => {
  const starRecords = makeLedger({ languages: ['en'] });
  find(starRecords, 'story-parser').data.situation[0] = { text: 'Unsourced context.', claim_ids: [], evidence_ids: [], metric_ids: [] };
  assert.ok((await validateLedger(starRecords, { stage: 'star' })).some((error) => error.includes('sourced text requires')));
  const candidateRecords = makeLedger({ languages: ['en'] });
  find(candidateRecords, 'candidate-parser-en').data.clauses.result = { text: 'Unsourced result.', claim_ids: [], evidence_ids: [], metric_ids: [] };
  assert.ok((await validateLedger(candidateRecords)).some((error) => error.includes('sourced text requires')));
});

test('private ledger sealer recomputes evidence digests without schema negotiation', async () => {
  const records = makeLedger();
  find(records, 'ev-parser').data.sha256 = null;
  await sealLedger(records);
  assert.match(find(records, 'ev-parser').data.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(await validateLedger(records, { stage: 'star' }), []);
});

test('legacy 1.0 import preserves facts, regenerates stories, and requires review', async () => {
  const archive = makeArchive();
  const records = importLegacyArchive(archive);
  assert.equal(records.filter((item) => item.record_type === 'evidence').length, archive.evidence.length);
  assert.equal(records.filter((item) => item.record_type === 'story').length, archive.contributions.length);
  assert.ok(records.filter((item) => item.record_type === 'story').every((item) => item.data.legacy_review_required && !item.data.resume_eligible));
  assert.deepEqual(await validateLedger(records, { stage: 'star' }), []);
});

test('invalid legacy import cannot overwrite an existing private ledger', async (t) => {
  const workspace = await temporary(t), privateDirectory = path.join(workspace, '.verified-resume'), ledger = path.join(privateDirectory, 'ledger.jsonl'), archive = path.join(workspace, 'invalid.json');
  await mkdir(privateDirectory, { recursive: true });
  await writeFile(ledger, 'SENTINEL\n', 'utf8');
  await writeFile(archive, JSON.stringify({ schema_version: '1.0.0' }), 'utf8');
  await assert.rejects(main(['import-legacy', '--archive', archive, '--workspace', workspace]));
  assert.equal(await readFile(ledger, 'utf8'), 'SENTINEL\n');
});

test('valid legacy import refuses to overwrite an existing private ledger', async (t) => {
  const workspace = await temporary(t), privateDirectory = path.join(workspace, '.verified-resume'), ledger = path.join(privateDirectory, 'ledger.jsonl'), archive = path.join(workspace, 'legacy.json');
  await mkdir(privateDirectory, { recursive: true });
  await writeFile(ledger, 'SENTINEL\n', 'utf8');
  await writeFile(archive, JSON.stringify(makeArchive()), 'utf8');
  assert.equal(await main(['import-legacy', '--archive', archive, '--workspace', workspace]), 1);
  assert.equal(await readFile(ledger, 'utf8'), 'SENTINEL\n');
});

test('workspace renderer writes the four public Markdown artifacts', async (t) => {
  const workspace = await temporary(t), records = makeLedger(), ledger = path.join(workspace, '.verified-resume', 'ledger.jsonl');
  await writeLedger(ledger, records);
  assert.deepEqual(await renderWorkspace(records, workspace), []);
  for (const name of ['star.md', 'resume-candidate-pool.md', 'resume.md', 'review.md']) await stat(path.join(workspace, name));
  const star = await readFile(path.join(workspace, 'star.md'), 'utf8'), review = await readFile(path.join(workspace, 'review.md'), 'utf8');
  assert.match(star, /Situation/); assert.match(star, /Trade-offs/); assert.match(review, /Candidate pool derives from STAR/);
});

test('invalid workspace replaces public artifacts with blocked notices', async (t) => {
  const workspace = await temporary(t), records = makeLedger({ languages: ['en'] }), ledger = path.join(workspace, '.verified-resume', 'ledger.jsonl');
  await writeFile(path.join(workspace, 'resume.md'), '# Stale valid-looking resume\n', 'utf8');
  find(records, 'candidate-parser-en').data.text += ' for 500 users';
  await writeLedger(ledger, records);
  assert.ok((await renderWorkspace(records, workspace)).length > 0);
  await stat(path.join(workspace, 'review.md'));
  for (const name of ['star.md', 'resume-candidate-pool.md', 'resume.md']) assert.match(await readFile(path.join(workspace, name), 'utf8'), /Not rendered because deterministic validation failed/);
  assert.doesNotMatch(await readFile(path.join(workspace, 'resume.md'), 'utf8'), /Stale valid-looking/);
});
