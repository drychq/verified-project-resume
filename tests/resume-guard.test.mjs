import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { makeNarrationRecords, makeRepositoryRecords } from './fixture-data.mjs';
import { auditRecords, main, renderWorkspace, sealRecords, validateRecords, writeRecords } from '../skills/verified-project-resume/scripts/workspace.mjs';

async function temporary(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'workspace-check-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function find(records, id) { return records.find((item) => item.id === id); }

test('valid detailed stories, bullet options, and selection pass', async () => {
  assert.deepEqual(await validateRecords(makeRepositoryRecords()), []);
});

test('six independent contributions create six stories while final selection stays concise', async () => {
  const records = makeRepositoryRecords({ storyCount: 6, selectedCount: 3 });
  assert.equal(records.filter((item) => item.record_type === 'story').length, 6);
  assert.equal(records.filter((item) => item.record_type === 'candidate-group').length, 6);
  assert.equal(find(records, 'selection:current').refs.selected_group_ids.length, 3);
  assert.deepEqual(await validateRecords(records), []);
});

test('one supported story may produce one final bullet without duplication', async () => {
  const records = makeRepositoryRecords({ storyCount: 1, selectedCount: 1 });
  assert.deepEqual(await validateRecords(records), []);
  assert.ok(auditRecords(records).warnings.some((value) => value.includes('Only one supported final bullet')));
});

test('eligible contribution must be covered by a story or explicitly omitted', async () => {
  const records = makeRepositoryRecords();
  records.splice(records.findIndex((item) => item.id === 'story-parser'), 1);
  assert.ok((await validateRecords(records, { stage: 'star' })).some((error) => error.includes('neither covered by a story')));
  find(records, 'contribution-parser').data.star_omission_reason = 'Evidence is duplicated by another reviewed story.';
  assert.ok(!(await validateRecords(records, { stage: 'star' })).some((error) => error.includes('neither covered by a story')));
});

test('a bullet option cannot bypass its story source chain', async () => {
  const records = makeRepositoryRecords();
  const candidate = find(records, 'candidate-parser-en');
  candidate.refs.claim_ids = ['claim-storage'];
  assert.ok((await validateRecords(records)).some((error) => error.includes('bypasses the cited story')));
});

test('candidate clauses cannot hide sources omitted from candidate refs', async () => {
  const records = makeRepositoryRecords({ languages: ['en'] });
  find(records, 'candidate-parser-en').data.clauses.method.claim_ids = ['claim-storage'];
  find(records, 'candidate-parser-en').data.clauses.method.evidence_ids = ['ev-storage'];
  assert.ok((await validateRecords(records)).some((error) => error.includes('candidate claim_ids must exactly match clause sources')));
});

test('a bullet option must cite a story and selection must cite options', async () => {
  const records = makeRepositoryRecords();
  find(records, 'candidate-parser-en').refs.story_ids = [];
  find(records, 'selection:current').refs.selected_group_ids = ['story-parser'];
  const errors = await validateRecords(records);
  assert.ok(errors.some((error) => error.includes('must cite a story')));
  assert.ok(errors.some((error) => error.includes('unknown candidate group')));
});

test('a bullet option cannot cite an ineligible story', async () => {
  const records = makeRepositoryRecords({ languages: ['en'] });
  find(records, 'story-parser').data.resume_eligible = false;
  assert.ok((await validateRecords(records)).some((error) => error.includes('is not resume eligible')));
});

test('no-number capability option remains valid', async () => {
  const records = makeRepositoryRecords({ storyCount: 1, selectedCount: 1, languages: ['en'] });
  assert.equal(records.filter((item) => item.record_type === 'metric').length, 0);
  assert.deepEqual(await validateRecords(records), []);
});

test('an injected number is rejected', async () => {
  const records = makeRepositoryRecords({ languages: ['en'] });
  find(records, 'candidate-parser-en').data.text += ' for 500 users';
  assert.ok((await validateRecords(records)).some((error) => error.includes("numeric token '500'")));
});

test('verified count passes, old metric status fails, and user-provided numbers need flags', async () => {
  const records = makeRepositoryRecords({ storyCount: 1, selectedCount: 1, languages: ['en'] });
  const metric = { record_type: 'metric', id: 'metric-tests', data: { name: 'deterministic tests', kind: 'count', status: 'verified-count', value: 12, unit: 'tests', baseline: null, result: null, measurement_method: 'Counted from the cited test evidence.', resume_eligible: true }, refs: { evidence_ids: ['ev-parser'] } };
  records.push(metric);
  find(records, 'contribution-parser').refs.metric_ids = ['metric-tests'];
  const story = find(records, 'story-parser'); story.refs.metric_ids = ['metric-tests']; story.data.results[0].metric_ids = ['metric-tests']; story.data.results[0].text = 'Passed 12 deterministic tests within the cited project boundary.';
  const candidate = find(records, 'candidate-parser-en'); candidate.refs.metric_ids = ['metric-tests']; candidate.data.text = 'Implemented the bounded parser change and passed 12 deterministic tests.'; candidate.data.clauses.result.metric_ids = ['metric-tests']; candidate.data.clauses.result.text = 'Passed 12 deterministic tests';
  assert.deepEqual(await validateRecords(records), []);
  metric.data.status = 'user-confirmed'; metric.data.resume_eligible = false;
  assert.ok((await validateRecords(records)).some((error) => error.includes("inadmissible metric 'metric-tests'")));
  const narration = makeNarrationRecords();
  find(narration, 'metric-risk-peak').data.review_flags = [];
  assert.ok((await validateRecords(narration)).some((error) => error.includes('review_flags')));
});

test('approximate wording is rejected on measured numbers and warned on user-provided numbers', async () => {
  const records = makeRepositoryRecords({ storyCount: 1, selectedCount: 1, languages: ['en'] });
  find(records, 'claim-parser').data.text += ' The user remembered about 12 tests.';
  find(records, 'candidate-parser-en').data.text += ' with about 12 tests';
  assert.ok((await validateRecords(records)).some((error) => error.includes('approximate or range')));
  const narration = makeNarrationRecords();
  const warnings = [];
  const errors = await validateRecords(narration, { warnings });
  assert.ok(!errors.some((error) => error.includes('approximate or range')));
  assert.ok(warnings.some((warning) => warning.includes('approximate')));
});

test('strong ownership verb is rejected without evidence', async () => {
  const records = makeRepositoryRecords({ languages: ['en'] });
  find(records, 'candidate-parser-en').data.text = 'Led and architected the parser subsystem.';
  const errors = await validateRecords(records);
  assert.ok(errors.some((error) => error.includes("strong verb 'led'")));
  assert.ok(errors.some((error) => error.includes('architecture wording')));
});

test('story Task and Result ownership and architecture wording are checked', async () => {
  const records = makeRepositoryRecords({ languages: ['en'] });
  find(records, 'story-parser').data.task[0].text = 'The user owned and architected the entire parser subsystem.';
  const errors = await validateRecords(records, { stage: 'star' });
  assert.ok(errors.some((error) => error.includes("strong verb 'owned'")));
  assert.ok(errors.some((error) => error.includes('architecture wording')));
  const resultRecords = makeRepositoryRecords({ languages: ['en'] });
  find(resultRecords, 'story-parser').data.results[0].text = 'The user owned and architected the entire parser subsystem.';
  const resultErrors = await validateRecords(resultRecords, { stage: 'star' });
  assert.ok(resultErrors.some((error) => error.includes("strong verb 'owned'")));
  assert.ok(resultErrors.some((error) => error.includes('architecture wording')));
});

test('dependency integration cannot be escalated to implementation', async () => {
  const records = makeRepositoryRecords({ languages: ['en'] });
  const claim = find(records, 'claim-storage');
  claim.data.action_kind = 'integrated'; claim.data.tags = ['dependency-integration'];
  const candidate = find(records, 'candidate-storage-en');
  candidate.data.text = 'Implemented SQLite for the storage path.';
  candidate.data.clauses.action.text = 'Implemented SQLite';
  const errors = await validateRecords(records);
  assert.ok(errors.some((error) => error.includes('implementation wording exceeds') || error.includes('escalated')));
});

test('production wording errors on code-backed text and warns on account-only text', async () => {
  const records = makeRepositoryRecords({ languages: ['en'] });
  find(records, 'candidate-cache-en').data.text += ' with production reliability at scale, thereby enabled growth';
  const errors = await validateRecords(records);
  for (const label of ['production wording', 'reliability wording', 'scale wording', 'causal wording']) assert.ok(errors.some((error) => error.includes(label)), label);
  const narration = makeNarrationRecords();
  find(narration, 'candidate-rule-parser-en').data.text += ' It runs in production.';
  const warnings = [];
  const narrationErrors = await validateRecords(narration, { warnings });
  assert.ok(!narrationErrors.some((error) => error.includes('production wording')));
  assert.ok(warnings.some((warning) => warning.includes('production')));
});

test('bilingual variants must use identical sources', async () => {
  const records = makeRepositoryRecords();
  find(records, 'candidate-parser-zh-CN').refs.evidence_ids = ['ev-storage'];
  assert.ok((await validateRecords(records)).some((error) => error.includes('bilingual variants')));
});

test('every option group must contain the requested languages and matching compression methods', async () => {
  const missing = makeRepositoryRecords();
  find(missing, 'group-parser').refs.candidate_ids = ['candidate-parser-en'];
  assert.ok((await validateRecords(missing)).some((error) => error.includes('exactly one candidate per selected language')));
  const mismatch = makeRepositoryRecords();
  find(mismatch, 'candidate-parser-en').data.compression_method = 'action-method-result';
  assert.ok((await validateRecords(mismatch)).some((error) => error.includes('same compression method')));
  const invented = makeRepositoryRecords();
  find(invented, 'candidate-parser-en').data.compression_method = 'fabricated-mode';
  find(invented, 'candidate-parser-zh-CN').data.compression_method = 'fabricated-mode';
  assert.ok((await validateRecords(invented)).some((error) => error.includes('invalid compression method')));
});

test('final selection requires a target role or job description', async () => {
  const records = makeRepositoryRecords();
  const selection = find(records, 'selection:current'); selection.data.target_role = ''; selection.data.job_description = '';
  assert.ok((await validateRecords(records)).some((error) => error.includes('target role or job description required')));
});

test('every unselected option group requires a role-specific omission reason', async () => {
  const records = makeRepositoryRecords({ storyCount: 3, selectedCount: 2 });
  find(records, 'group-cache').data.selection_omission_reason = null;
  assert.ok((await validateRecords(records)).some((error) => error.includes('unselected group requires')));
});

test('retargeting changes selection records without changing sources or stories', async () => {
  const first = makeRepositoryRecords({ storyCount: 3, selectedCount: 2 });
  const second = structuredClone(first);
  find(second, 'selection:current').data.target_role = 'storage engineer';
  find(second, 'selection:current').refs.selected_group_ids = ['group-storage', 'group-cache'];
  find(second, 'group-parser').data.selection_omission_reason = 'Less relevant to storage work.';
  find(second, 'group-cache').data.selection_omission_reason = null;
  assert.deepEqual(await validateRecords(second), []);
  const stableTypes = new Set(['evidence', 'claim', 'contribution', 'metric', 'story']);
  assert.deepEqual(first.filter((item) => stableTypes.has(item.record_type)), second.filter((item) => stableTypes.has(item.record_type)));
});

test('evidence digest is recomputed', async () => {
  const records = makeRepositoryRecords();
  find(records, 'ev-parser').data.excerpt = 'Tampered after collection.';
  assert.ok((await validateRecords(records, { stage: 'star' })).some((error) => error.includes('canonical-record digest mismatch')));
});

test('unavailable evidence cannot support a resume-eligible claim or metric', async () => {
  const records = makeRepositoryRecords({ storyCount: 1, selectedCount: 1, languages: ['en'] });
  const evidence = find(records, 'ev-parser'); evidence.data.availability = 'unavailable'; evidence.data.digest_basis = 'not-applicable'; evidence.data.sha256 = null;
  const errors = await validateRecords(records);
  assert.ok(errors.some((error) => error.includes('resume-eligible claim requires collected evidence')));
});

test('user-confirmed claims need collected user text, not one specific type', async () => {
  const records = makeRepositoryRecords({ storyCount: 1, selectedCount: 1, languages: ['en'] });
  records.push({ record_type: 'evidence', id: 'ev-confirm-unavailable', data: { type: 'user-confirmation', availability: 'unavailable', title: 'Missing confirmation', locator: {}, digest_basis: 'not-applicable', sha256: null, excerpt: null, collected_at: '2026-07-20T00:00:00Z' }, refs: {} });
  const claim = find(records, 'claim-parser'); claim.data.status = 'user-confirmed'; claim.refs.evidence_ids.push('ev-confirm-unavailable');
  find(records, 'contribution-parser').refs.evidence_ids.push('ev-confirm-unavailable');
  assert.ok((await validateRecords(records)).some((error) => error.includes('collected user text')));
});

test('a user-approved claim requires a collected proposal record', async () => {
  const records = makeRepositoryRecords({ languages: ['en'] });
  find(records, 'claim-parser').data.status = 'user-approved';
  assert.ok((await validateRecords(records)).some((error) => error.includes('requires a collected user-approved-proposal')));
});

test('a confirmed proposal may not introduce numbers or result wording the user did not provide', async () => {
  const records = makeNarrationRecords();
  const proposal = find(records, 'ev-prop-parser');
  proposal.data.proposal_excerpt = '规则解析模块基于 ANTLR 实现表达式解析，支持 5000 QPS 峰值，显著提升加载速度。';
  await sealRecords(records);
  const errors = await validateRecords(records);
  assert.ok(errors.some((error) => error.includes("proposed number '5000'")));
  assert.ok(errors.some((error) => error.includes('proposal introduces performance wording')));
});

test('a verified claim cannot rest on user text alone', async () => {
  const records = makeNarrationRecords();
  find(records, 'claim-risk-role').data.status = 'verified';
  assert.ok((await validateRecords(records)).some((error) => error.includes('requires at least one non-testimony source')));
});

test('selected bullets and overviews need interview Q&A in the resume stage only', async () => {
  const records = makeNarrationRecords();
  find(records, 'candidate-rule-parser-en').data.interview_qa = [];
  assert.ok((await validateRecords(records)).some((error) => error.includes('interview_qa') && error.includes('selected bullet')));
  assert.deepEqual(await validateRecords(records, { stage: 'star' }), []);
  const overviewRecords = makeNarrationRecords();
  find(overviewRecords, 'overview:en').data.interview_qa = [];
  assert.ok((await validateRecords(overviewRecords)).some((error) => error.includes('interview_qa')));
});

test('story sections and candidate clauses require claim and evidence sources', async () => {
  const storyRecords = makeRepositoryRecords({ languages: ['en'] });
  find(storyRecords, 'story-parser').data.situation[0] = { text: 'Unsourced context.', claim_ids: [], evidence_ids: [], metric_ids: [] };
  assert.ok((await validateRecords(storyRecords, { stage: 'star' })).some((error) => error.includes('sourced text requires')));
  const candidateRecords = makeRepositoryRecords({ languages: ['en'] });
  find(candidateRecords, 'candidate-parser-en').data.clauses.result = { text: 'Unsourced result.', claim_ids: [], evidence_ids: [], metric_ids: [] };
  assert.ok((await validateRecords(candidateRecords)).some((error) => error.includes('sourced text requires')));
});

test('the sealer recomputes evidence digests', async () => {
  const records = makeRepositoryRecords();
  find(records, 'ev-parser').data.sha256 = null;
  await sealRecords(records);
  assert.match(find(records, 'ev-parser').data.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(await validateRecords(records, { stage: 'star' }), []);
});

test('sealing the proposal confirmation digest is deterministic and idempotent', async () => {
  const records = makeNarrationRecords();
  find(records, 'ev-prop-parser').data.sha256 = null;
  await sealRecords(records);
  const sealed = find(records, 'ev-prop-parser').data.sha256;
  assert.match(sealed, /^[a-f0-9]{64}$/);
  await sealRecords(records);
  assert.equal(find(records, 'ev-prop-parser').data.sha256, sealed);
  assert.deepEqual(await validateRecords(records, { stage: 'star' }), []);
});

test('resume stage requires a project overview per requested language', async () => {
  const records = makeRepositoryRecords();
  const index = records.findIndex((item) => item.id === 'overview:en');
  records.splice(index, 1);
  assert.ok((await validateRecords(records)).some((error) => error.includes("missing project overview for language 'en'")));
  assert.deepEqual(await validateRecords(makeRepositoryRecords()), []);
});

test('the project overview is checked like any other resume text', async () => {
  const records = makeRepositoryRecords({ languages: ['en'] });
  find(records, 'overview:en').data.text += ' serving 500 users in production';
  const errors = await validateRecords(records);
  assert.ok(errors.some((error) => error.includes("numeric token '500'")));
  assert.ok(errors.some((error) => error.includes('production wording')));
  const unsourced = makeRepositoryRecords({ languages: ['en'] });
  find(unsourced, 'overview:en').data.claim_ids = [];
  find(unsourced, 'overview:en').data.evidence_ids = [];
  assert.ok((await validateRecords(unsourced)).some((error) => error.includes('sourced text requires')));
});

test('rendered resume.md includes the project overview above the bullets', async (t) => {
  const workspace = await temporary(t), records = makeRepositoryRecords(), recordsFile = path.join(workspace, '.verified-resume', 'records.jsonl');
  await writeRecords(recordsFile, records);
  assert.deepEqual(await renderWorkspace(records, workspace), []);
  const resume = await readFile(path.join(workspace, 'resume.md'), 'utf8');
  assert.match(resume, /## Project overview/);
  assert.ok(resume.indexOf('## Project overview') < resume.indexOf('## Selected bullets'));
  assert.match(resume, /course index project/i);
});

test('the workspace renderer writes the four public Markdown files', async (t) => {
  const workspace = await temporary(t), records = makeRepositoryRecords(), recordsFile = path.join(workspace, '.verified-resume', 'records.jsonl');
  await writeRecords(recordsFile, records);
  assert.deepEqual(await renderWorkspace(records, workspace), []);
  for (const name of ['stories.md', 'bullet-options.md', 'resume.md', 'review.md']) await stat(path.join(workspace, name));
  const stories = await readFile(path.join(workspace, 'stories.md'), 'utf8'), review = await readFile(path.join(workspace, 'review.md'), 'utf8');
  assert.match(stories, /Situation/); assert.match(stories, /Trade-offs/); assert.match(review, /Bullet options derive from stories/);
});

test('invalid workspace replaces public files with blocked notices', async (t) => {
  const workspace = await temporary(t), records = makeRepositoryRecords({ languages: ['en'] }), recordsFile = path.join(workspace, '.verified-resume', 'records.jsonl');
  await writeFile(path.join(workspace, 'resume.md'), '# Stale valid-looking resume\n', 'utf8');
  find(records, 'candidate-parser-en').data.text += ' for 500 users';
  await writeRecords(recordsFile, records);
  assert.ok((await renderWorkspace(records, workspace)).length > 0);
  await stat(path.join(workspace, 'review.md'));
  for (const name of ['stories.md', 'bullet-options.md', 'resume.md']) assert.match(await readFile(path.join(workspace, name), 'utf8'), /Not rendered because deterministic validation failed/);
  assert.doesNotMatch(await readFile(path.join(workspace, 'resume.md'), 'utf8'), /Stale valid-looking/);
});

test('validation never mutates record data', async () => {
  const records = makeRepositoryRecords();
  records.push({ record_type: 'evidence', id: 'ev-artifact', data: { type: 'file', availability: 'collected', title: 'raw artifact', locator: { path: 'raw/artifact.bin' }, digest_basis: 'file-bytes', sha256: 'a'.repeat(64), excerpt: null, collected_at: '2026-07-20T00:00:00Z' }, refs: {} });
  const before = structuredClone(records);
  await validateRecords(records);
  assert.deepEqual(records, before);
  assert.ok(!JSON.stringify(records).includes('_resolved_path'));
});

test('file-bytes digests are verified only when file verification is requested', async (t) => {
  const workspace = await temporary(t), artifact = path.join(workspace, 'artifact.bin');
  await writeFile(artifact, 'payload', 'utf8');
  const records = makeRepositoryRecords();
  records.push({ record_type: 'evidence', id: 'ev-artifact', data: { type: 'file', availability: 'collected', title: 'raw artifact', locator: { path: artifact }, digest_basis: 'file-bytes', sha256: null, excerpt: null, collected_at: '2026-07-20T00:00:00Z' }, refs: {} });
  await sealRecords(records);
  assert.deepEqual(await validateRecords(records, { verifyFiles: true }), []);
  await writeFile(artifact, 'tampered', 'utf8');
  assert.deepEqual(await validateRecords(records), []);
  assert.ok((await validateRecords(records, { verifyFiles: true })).some((error) => error.includes('file-bytes digest mismatch')));
  await rm(artifact);
  assert.ok((await validateRecords(records, { verifyFiles: true })).some((error) => error.includes('digest source file does not exist')));
});

test('a relative file-bytes locator requires a project repo_root', async () => {
  const relativeEvidence = { record_type: 'evidence', id: 'ev-artifact', data: { type: 'file', availability: 'collected', title: 'raw artifact', locator: { path: 'raw/artifact.bin' }, digest_basis: 'file-bytes', sha256: 'a'.repeat(64), excerpt: null, collected_at: '2026-07-20T00:00:00Z' }, refs: {} };
  const records = makeRepositoryRecords();
  find(records, 'project:course-index').data.repo_root = null;
  records.push(structuredClone(relativeEvidence));
  assert.ok((await validateRecords(records)).some((error) => error.includes('requires a project repo_root')));
  const sealTarget = makeRepositoryRecords();
  find(sealTarget, 'project:course-index').data.repo_root = null;
  sealTarget.push({ ...structuredClone(relativeEvidence), data: { ...structuredClone(relativeEvidence).data, sha256: null } });
  await assert.rejects(sealRecords(sealTarget), /requires a project repo_root/);
});

test('bilingual project overviews must use identical sources', async () => {
  const records = makeRepositoryRecords();
  const overview = find(records, 'overview:en');
  overview.data.claim_ids = ['claim-storage']; overview.data.evidence_ids = ['ev-storage'];
  overview.refs.claim_ids = ['claim-storage']; overview.refs.evidence_ids = ['ev-storage'];
  assert.ok((await validateRecords(records)).some((error) => error.includes('overview: bilingual variants must use identical sources')));
});

test('project overview refs must mirror data sources', async () => {
  const records = makeRepositoryRecords({ languages: ['en'] });
  find(records, 'overview:en').refs.claim_ids = [];
  assert.ok((await validateRecords(records)).some((error) => error.includes('refs must mirror data sources')));
});

test('the workspace CLI rejects unknown flags and invalid stages and answers help/version', async (t) => {
  assert.equal(await main(['validate', '--stag', 'resume']), 2);
  assert.equal(await main(['bogus-command']), 2);
  const workspace = await temporary(t), recordsFile = path.join(workspace, '.verified-resume', 'records.jsonl');
  await writeRecords(recordsFile, makeRepositoryRecords());
  assert.equal(await main(['validate', '--records', recordsFile, '--stage', 'bogus']), 2);
  assert.equal(await main(['validate', '--records', recordsFile, '--stage', 'resume']), 0);
  assert.equal(await main(['--help']), 0);
  assert.equal(await main(['--version']), 0);
});

test('the workspace CLI prints non-fatal warnings without failing', async (t) => {
  const workspace = await temporary(t), recordsFile = path.join(workspace, '.verified-resume', 'records.jsonl');
  await mkdir(path.dirname(recordsFile), { recursive: true });
  await writeRecords(recordsFile, makeNarrationRecords());
  assert.equal(await main(['validate', '--records', recordsFile, '--stage', 'resume']), 0);
});
