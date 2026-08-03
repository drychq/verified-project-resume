import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export async function writeJson(file, data) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8' });
}

export async function fileSha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function evidence(id, type, title, excerpt) {
  const item = {
    id, type, availability: 'collected', title, locator: { path: title },
    digest_basis: type === 'user-confirmation' ? 'user-confirmation-text' : 'canonical-record',
    sha256: null, excerpt, collected_at: '2026-07-20T00:00:00Z',
  };
  if (type === 'user-confirmation') item.sha256 = digest(excerpt);
  else {
    // Match Python's canonical JSON: sorted keys, compact separators, UTF-8 text.
    const payload = { excerpt: item.excerpt, locator: item.locator, title: item.title, type: item.type };
    item.sha256 = digest(JSON.stringify(payload));
  }
  return item;
}

function claim(id, text, scope, status, ownership_level, action_kind, evidence_ids, resume_eligible, tags = []) {
  return { id, text, scope, status, ownership_level, action_kind, tags, evidence_ids,
    confidence: status === 'verified' ? 'high' : 'medium',
    confidence_reason: 'Synthetic fixture evidence explicitly supports this narrow claim.', resume_eligible };
}

function starItem(id, text, claim_ids, evidence_ids, metric_ids = [], status = 'verified', resume_eligible = true) {
  return { id, text, claim_ids, evidence_ids, metric_ids, status, resume_eligible };
}

export function makeArchive(repoRoot = '/synthetic/course-index') {
  return {
    schema_version: '1.0.0',
    project: { id: 'course-index', name: 'Course Index', repo_root: repoRoot, revision: '1234567890abcdef', repository_kind: 'course', remote_url: null },
    analysis_scope: { start_date: null, end_date: null, starter_ref: 'starter', upstream_ref: null, github_availability: 'unavailable', execution_policy: 'ask-before-execute', collected_at: '2026-07-20T00:00:00Z' },
    identity: { names: ['Student Dev'], emails: ['student@example.test', 'student+school@example.test'], github_handle: null, status: 'confirmed' },
    evidence: [
      evidence('ev-starter', 'upstream', 'starter/src/core.cpp', 'Parser and lookup existed in starter.'),
      evidence('ev-parser-diff', 'diff', 'src/parser.cpp', 'Student added bounded token parsing.'),
      evidence('ev-dependency', 'dependency', 'src/storage.cpp', 'Student called SQLite through a wrapper.'),
      evidence('ev-test', 'test', 'tests/test_index.cpp', '12 deterministic tests passed.'),
      evidence('ev-benchmark', 'benchmark', 'benchmarks/raw.json', 'Baseline 20 ms; result 10 ms.'),
      evidence('ev-fix-diff', 'diff', 'src/cache.cpp', 'Student fixed an invalidation bug in teammate-owned cache code.'),
      evidence('ev-confirm', 'user-confirmation', 'user confirmation 1', 'I was responsible for parser boundary validation.'),
      evidence('ev-readme', 'file', 'README.md', 'A future target says 10x faster, without raw measurement.'),
    ],
    claims: [
      claim('c-project', 'The course project provides parsing, indexed lookup, and persistent storage.', 'project', 'verified', 'none', 'none', ['ev-starter', 'ev-dependency'], true),
      claim('c-starter', 'Parsing and lookup existed in the supplied starter.', 'starter', 'verified', 'none', 'none', ['ev-starter'], false),
      claim('c-parser', 'The user implemented bounded token parsing in the assigned parser module.', 'user-partial', 'verified', 'shared', 'implemented', ['ev-parser-diff'], true),
      claim('c-integration', 'The user integrated SQLite through the project storage wrapper.', 'user-partial', 'verified', 'contributor', 'integrated', ['ev-dependency'], true, ['dependency-integration']),
      claim('c-tests', 'The user added and ran deterministic correctness tests for parser and storage boundaries.', 'user-partial', 'verified', 'contributor', 'tested', ['ev-test'], true),
      claim('c-fix', 'The user debugged and fixed cache invalidation in a module originally implemented by a teammate.', 'user-partial', 'verified', 'contributor', 'debugged', ['ev-fix-diff', 'ev-test'], true),
      claim('c-team-architecture', 'The team used a parser, index, storage, and cache architecture.', 'team', 'verified', 'shared', 'none', ['ev-starter', 'ev-dependency'], true),
      claim('c-confirmed-role', 'The user was responsible for parser boundary validation.', 'user-partial', 'user-confirmed', 'contributor', 'tested', ['ev-confirm'], true),
      claim('c-planned', 'A 10x speedup was documented as a future target.', 'project', 'inferred', 'none', 'none', ['ev-readme'], false),
      claim('c-production', 'The project may be production reliable.', 'unknown', 'unknown', 'unknown', 'none', [], false),
    ],
    contributions: [
      { id: 'con-parser', summary: 'Bounded parser implementation and validation', claim_ids: ['c-parser', 'c-confirmed-role'], evidence_ids: ['ev-parser-diff', 'ev-confirm'], paths: ['src/parser.cpp'], symbols: ['Parser::parseToken'], commit_ids: ['commit-user-parser'] },
      { id: 'con-storage', summary: 'SQLite wrapper integration and correctness tests', claim_ids: ['c-integration', 'c-tests'], evidence_ids: ['ev-dependency', 'ev-test'], paths: ['src/storage.cpp', 'tests/test_index.cpp'], symbols: ['Storage::put'], commit_ids: ['commit-user-storage'] },
      { id: 'con-cache-fix', summary: 'Targeted cache invalidation bug fix', claim_ids: ['c-fix'], evidence_ids: ['ev-fix-diff', 'ev-test'], paths: ['src/cache.cpp'], symbols: ['Cache::invalidate'], commit_ids: ['commit-user-fix'] },
    ],
    metrics: [
      { id: 'm-latency', name: 'parser fixture latency', kind: 'performance', status: 'verified-measured', value: 10, unit: 'ms', baseline: 20, result: 10, measurement_method: 'Median of the fixed synthetic input using the recorded benchmark command.', evidence_ids: ['ev-benchmark'], resume_eligible: true },
      { id: 'm-tests', name: 'deterministic correctness tests', kind: 'count', status: 'verified-count', value: 12, unit: 'tests', baseline: null, result: null, measurement_method: 'Counted from recorded test output.', evidence_ids: ['ev-test'], resume_eligible: true },
      { id: 'm-readme-target', name: 'README future speedup target', kind: 'performance', status: 'documented-unverified', value: '10x', unit: null, baseline: null, result: null, measurement_method: null, evidence_ids: ['ev-readme'], resume_eligible: false },
      { id: 'm-user-number', name: 'remembered throughput', kind: 'performance', status: 'user-confirmed', value: 1000, unit: 'ops/s', baseline: null, result: null, measurement_method: null, evidence_ids: ['ev-confirm'], resume_eligible: false },
    ],
    star: {
      situation: [starItem('s-1', 'The starter supplied the core parser and lookup path, so project capability was separated from student work.', ['c-starter', 'c-project'], ['ev-starter'], [], 'verified', false)],
      task: [starItem('t-1', 'The user was responsible for parser boundary validation.', ['c-confirmed-role'], ['ev-confirm'], [], 'user-confirmed')],
      action: [
        starItem('a-1', 'Implemented bounded token parsing in the assigned module.', ['c-parser'], ['ev-parser-diff']),
        starItem('a-2', 'Integrated SQLite through the existing storage wrapper and tested boundary behavior.', ['c-integration', 'c-tests'], ['ev-dependency', 'ev-test']),
        starItem('a-3', 'Debugged and fixed cache invalidation without claiming the teammate-owned module architecture.', ['c-fix'], ['ev-fix-diff', 'ev-test']),
      ],
      result: [
        starItem('r-1', 'Measured parser fixture latency changed from 20 ms to 10 ms under the recorded method.', ['c-parser'], ['ev-parser-diff', 'ev-benchmark'], ['m-latency']),
        starItem('r-2', 'The parser and storage boundaries passed 12 deterministic tests.', ['c-tests'], ['ev-test'], ['m-tests']),
        starItem('r-3', 'The confirmed cache invalidation defect was eliminated in the tested fixture.', ['c-fix'], ['ev-fix-diff', 'ev-test']),
      ],
    },
    open_questions: [{ id: 'q-1', question: 'Was the parser design assigned or proposed by the user?', affects_claim_ids: ['c-parser'], status: 'open' }],
    interview_topics: [
      { id: 'i-1', topic: 'Parser boundary handling', claim_ids: ['c-parser', 'c-confirmed-role'], questions: ['Which malformed inputs were rejected?', 'Why was the parser change bounded to one module?'] },
      { id: 'i-2', topic: 'Benchmark limits', claim_ids: ['c-parser'], questions: ['How was the fixture held constant?', 'Why is this not a production performance claim?'] },
    ],
    execution_log: [{ id: 'run-1', kind: 'benchmark', command: './bench_parser --fixture fixed.txt', cwd: repoRoot, approval: 'approved', status: 'completed', exit_code: 0, stdout_path: 'benchmarks/raw.json', stderr_path: null, timestamp: '2026-07-20T00:00:00Z' }],
  };
}

function sourced(language, text, claim_ids, evidence_ids, metric_ids = []) { return { language, text, claim_ids, evidence_ids, metric_ids }; }
function clause(text, claim_ids, evidence_ids, metric_ids = []) { return { text, claim_ids, evidence_ids, metric_ids }; }
function candidate(id, language, text, action, method, result, submittable) {
  return { id, language, text, clauses: { action, method, result }, interview_questions: ['What did the cited diff change?', 'What are the evidence limits?'], risk_flags: [], submittable };
}

export async function makeCandidates(archivePath, both = true, passed = true) {
  const languages = both ? ['zh-CN', 'en'] : ['en'];
  const summaries = [];
  if (languages.includes('zh-CN')) summaries.push(sourced('zh-CN', '基于课程 starter 扩展的索引项目，包含解析、持久化与缓存能力。', ['c-project'], ['ev-starter', 'ev-dependency']));
  summaries.push(sourced('en', 'A course index extending a supplied starter with parsing, persistence, and caching capabilities.', ['c-project'], ['ev-starter', 'ev-dependency']));
  const specs = [
    ['parser-latency', 'action-method-result', {
      'zh-CN': ['在分配的解析模块中实现有界 token 解析，通过固定合成输入将延迟从 20 ms 降至 10 ms。', clause('实现有界 token 解析', ['c-parser'], ['ev-parser-diff']), clause('使用固定合成输入验证解析路径', ['c-parser'], ['ev-parser-diff']), clause('延迟从 20 ms 降至 10 ms', ['c-parser'], ['ev-parser-diff', 'ev-benchmark'], ['m-latency'])],
      en: ['Implemented bounded token parsing in the assigned module, reducing fixed-fixture latency from 20 ms to 10 ms under the recorded benchmark method.', clause('Implemented bounded token parsing', ['c-parser'], ['ev-parser-diff']), clause('Used a fixed synthetic input under the recorded method', ['c-parser'], ['ev-parser-diff']), clause('Reduced latency from 20 ms to 10 ms', ['c-parser'], ['ev-parser-diff', 'ev-benchmark'], ['m-latency'])],
    }],
    ['storage-tests', 'action-method-verified-capability', {
      'zh-CN': ['通过现有存储封装集成 SQLite，并用 12 项确定性测试验证解析与存储边界。', clause('集成 SQLite', ['c-integration'], ['ev-dependency']), clause('通过现有存储封装并编写边界测试', ['c-integration', 'c-tests'], ['ev-dependency', 'ev-test']), clause('通过 12 项确定性测试', ['c-tests'], ['ev-test'], ['m-tests'])],
      en: ['Integrated SQLite through the existing storage wrapper and validated parser and storage boundaries with 12 deterministic tests.', clause('Integrated SQLite', ['c-integration'], ['ev-dependency']), clause('Used the existing wrapper and added boundary tests', ['c-integration', 'c-tests'], ['ev-dependency', 'ev-test']), clause('Passed 12 deterministic tests', ['c-tests'], ['ev-test'], ['m-tests'])],
    }],
    ['cache-fix', 'action-method-verified-capability', {
      'zh-CN': ['定位并修复队友模块中的缓存失效缺陷，通过回归测试确认目标错误路径已消除。', clause('定位并修复缓存失效缺陷', ['c-fix'], ['ev-fix-diff', 'ev-test']), clause('限制修改范围并执行回归测试', ['c-fix'], ['ev-fix-diff', 'ev-test']), clause('确认目标错误路径已消除', ['c-fix'], ['ev-fix-diff', 'ev-test'])],
      en: ['Debugged and fixed cache invalidation in a module implemented by a teammate, using regression tests to confirm the targeted failure path was eliminated.', clause('Debugged and fixed cache invalidation', ['c-fix'], ['ev-fix-diff', 'ev-test']), clause('Kept the change scoped and ran regression tests', ['c-fix'], ['ev-fix-diff', 'ev-test']), clause('Confirmed the targeted failure path was eliminated', ['c-fix'], ['ev-fix-diff', 'ev-test'])],
    }],
  ];
  const groups = specs.map(([semantic_group_id, compression_method, variants]) => ({
    semantic_group_id, compression_method,
    variants: languages.map((language) => {
      const [text, action, method, result] = variants[language];
      return candidate(`${semantic_group_id}-${language}`, language, text, action, method, result, passed);
    }),
  }));
  return {
    schema_version: '1.0.0',
    source_archive: { path: path.resolve(archivePath), sha256: await fileSha256(archivePath) },
    settings: { target_role: 'systems engineer', languages, bullet_count: 3, focus: 'correctness and measured performance' },
    project_summaries: summaries, candidate_groups: groups,
    excluded_claims: [
      { claim_id: 'c-starter', reason: 'Starter functionality is not a user contribution.' },
      { claim_id: 'c-team-architecture', reason: 'Valid team context, but not selected for the concise candidate set.' },
      { claim_id: 'c-confirmed-role', reason: 'Qualitative responsibility is supported but redundant with the selected parser action.' },
      { claim_id: 'c-planned', reason: 'Future target is inferred and unmeasured.' },
      { claim_id: 'c-production', reason: 'Production reliability is unknown.' },
    ],
    warnings: ['Measured latency applies only to the fixed synthetic fixture.'],
    guard: { version: '1.0.0', status: passed ? 'pass' : 'draft', errors: [], checked_at: passed ? '2026-07-20T00:00:00Z' : null },
  };
}

function ledgerRecord(record_type, id, data = {}, refs = {}) { return { record_type, id, data, refs }; }

function ledgerEvidence(id, title, excerpt) {
  const data = {
    type: 'diff', availability: 'collected', title, locator: { path: title },
    digest_basis: 'canonical-record', sha256: null, excerpt, collected_at: '2026-07-20T00:00:00Z',
  };
  data.sha256 = digest(JSON.stringify({ excerpt: data.excerpt, locator: data.locator, title: data.title, type: data.type }));
  return ledgerRecord('evidence', id, data, {});
}

function sourcedLedger(text, claim_ids, evidence_ids, metric_ids = []) { return { text, claim_ids, evidence_ids, metric_ids }; }

export function makeLedger({ storyCount = 3, languages = ['zh-CN', 'en'], selectedCount = Math.min(3, storyCount), includeSelection = true } = {}) {
  const records = [
    ledgerRecord('project', 'project:course-index', { id: 'course-index', name: 'Course Index', repo_root: '/synthetic-fixture/course-index', revision: '1234567890abcdef', repository_kind: 'course', remote_url: null }, {}),
    ledgerRecord('analysis', 'analysis:primary', { execution_policy: 'ask-before-execute', collected_at: '2026-07-20T00:00:00Z' }, {}),
    ledgerRecord('identity', 'identity:primary', { names: ['Student Dev'], emails: ['student@example.test'], status: 'confirmed' }, {}),
  ];
  const labels = ['parser', 'storage', 'cache', 'scheduler', 'protocol', 'index', 'logging', 'testing'];
  const groupIds = [];
  for (let index = 0; index < storyCount; index += 1) {
    const label = labels[index] ?? `component-${index + 1}`;
    const evidenceId = `ev-${label}`, claimId = `claim-${label}`, contributionId = `contribution-${label}`, storyId = `story-${label}`, groupId = `group-${label}`;
    const claimText = `The user implemented the bounded ${label} change and verified its project-specific behavior.`;
    records.push(ledgerEvidence(evidenceId, `src/${label}.cpp`, `Student implemented and verified the bounded ${label} change.`));
    records.push(ledgerRecord('claim', claimId, {
      text: claimText, scope: 'user-partial', status: 'verified', ownership_level: 'shared', action_kind: 'implemented', tags: [], confidence: 'high', confidence_reason: 'The synthetic diff directly supports the bounded change.', resume_eligible: true,
    }, { evidence_ids: [evidenceId] }));
    records.push(ledgerRecord('contribution', contributionId, { summary: `${label} implementation and validation`, paths: [`src/${label}.cpp`], symbols: [`${label}::run`], commit_ids: [`commit-${label}`], star_omission_reason: null }, { claim_ids: [claimId], evidence_ids: [evidenceId], metric_ids: [] }));
    const section = (text) => sourcedLedger(text, [claimId], [evidenceId]);
    records.push(ledgerRecord('story', storyId, {
      title: `${label} implementation and validation`,
      situation: [section(`The verified project path required a bounded ${label} change.`)],
      task: [section(`The user was responsible for the scoped ${label} implementation and its validation.`)],
      actions: [section(`Implemented the bounded ${label} behavior within the assigned path.`), section(`Validated the ${label} behavior against the cited project evidence.`)],
      results: [section(`Established the verified ${label} capability within the tested project boundary.`)],
      constraints: ['Personal ownership is limited to the cited change.'], decisions: [`Kept the ${label} change within its existing module boundary.`], tradeoffs: ['Preferred a bounded change over claiming broader subsystem ownership.'],
      result_limits: ['The evidence supports the project-specific capability, not production scale or reliability.'],
      interview_questions: [`Why was the ${label} change kept within this boundary?`], risk_flags: [], resume_eligible: true, legacy_review_required: false,
    }, { contribution_ids: [contributionId], claim_ids: [claimId], evidence_ids: [evidenceId], metric_ids: [], open_question_ids: [] }));
    const candidateIds = [];
    for (const language of languages) {
      const text = language === 'zh-CN' ? `在既有模块边界内实现并验证 ${label} 变更，形成可核验的项目能力。` : `Implemented and validated the bounded ${label} change, establishing the verified project capability.`;
      const candidateId = `candidate-${label}-${language}`;
      candidateIds.push(candidateId);
      records.push(ledgerRecord('candidate', candidateId, {
        language, text, compression_method: 'action-method-verified-capability',
        clauses: {
          action: section(language === 'zh-CN' ? `实现 ${label} 变更` : `Implemented the bounded ${label} change`),
          method: section(language === 'zh-CN' ? '限制在既有模块边界内并验证行为' : 'Kept the change bounded and validated its behavior'),
          result: section(language === 'zh-CN' ? '形成可核验的项目能力' : 'Established the verified project capability'),
        },
        interview_questions: [`What did the ${label} diff change?`], risk_flags: [],
      }, { story_ids: [storyId], claim_ids: [claimId], evidence_ids: [evidenceId], metric_ids: [] }));
    }
    groupIds.push(groupId);
    records.push(ledgerRecord('candidate-group', groupId, { title: `${label} candidate`, selection_omission_reason: index < selectedCount ? null : 'Less relevant to the current target role than selected candidates.' }, { story_ids: [storyId], candidate_ids: candidateIds }));
  }
  if (includeSelection) {
    const overviewTexts = {
      'zh-CN': '面向课程场景的索引项目：本人负责在既有模块边界内实现并验证核心组件变更。',
      en: 'A course index project where the user implemented and validated bounded component changes within existing module boundaries.',
    };
    for (const language of languages) records.push(ledgerRecord('overview', `overview:${language}`, {
      language, ...sourcedLedger(overviewTexts[language], ['claim-parser'], ['ev-parser']),
    }, { claim_ids: ['claim-parser'], evidence_ids: ['ev-parser'], metric_ids: [] }));
    records.push(ledgerRecord('selection', 'selection:current', {
      target_role: 'systems engineer', job_description: 'Build and validate bounded systems components.', focus: 'correctness and implementation boundaries', languages,
    }, { selected_group_ids: groupIds.slice(0, selectedCount) }));
  }
  return records;
}

function git(repo, args, name = 'Fixture', email = 'fixture@example.test') {
  const env = { ...process.env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name,
    GIT_COMMITTER_EMAIL: email, GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z', TZ: 'UTC', LC_ALL: 'C' };
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', env });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

export { git as fixtureGit };

export async function createGitFixture(repo) {
  await mkdir(repo, { recursive: true });
  git(repo, ['init', '-q']);
  await mkdir(path.join(repo, 'src'));
  await writeFile(path.join(repo, 'src/core.cpp'), 'int lookup(int key) { return key; }\n');
  await writeFile(path.join(repo, 'README.md'), '# Starter\n\nFuture target: 10x faster.\n');
  git(repo, ['add', '.']); git(repo, ['commit', '-qm', 'starter: provide core lookup'], 'Course Staff', 'staff@example.test');
  const starter = git(repo, ['rev-parse', 'HEAD']); git(repo, ['tag', 'starter']);
  await writeFile(path.join(repo, 'src/parser.cpp'), 'int parse(int token) { return token < 0 ? 0 : token; }\n');
  git(repo, ['add', 'src/parser.cpp']); git(repo, ['commit', '-qm', 'implement bounded parser'], 'Student Dev', 'student@example.test');
  const first_user = git(repo, ['rev-parse', 'HEAD']);
  await writeFile(path.join(repo, 'src/cache.cpp'), 'int cache_get(int key) { return key; }\n');
  git(repo, ['add', 'src/cache.cpp']); git(repo, ['commit', '-qm', 'add cache module'], 'Team Mate', 'teammate@example.test');
  const teammate = git(repo, ['rev-parse', 'HEAD']);
  await writeFile(path.join(repo, 'src/cache.cpp'), 'int cache_get(int key) { return key < 0 ? -1 : key; }\n');
  git(repo, ['add', 'src/cache.cpp']); git(repo, ['commit', '-qm', 'fix cache invalidation\n\nCo-authored-by: Team Mate <teammate@example.test>'], 'Student Dev', 'student+school@example.test');
  const second_user = git(repo, ['rev-parse', 'HEAD']);
  await writeFile(path.join(repo, 'src/shared.cpp'), 'int shared_path() { return 1; }\n');
  git(repo, ['add', 'src/shared.cpp']); git(repo, ['commit', '-qm', 'add shared path\n\nCo-authored-by: Student Dev <student@example.test>'], 'Team Mate', 'teammate@example.test');
  const coauthor_only = git(repo, ['rev-parse', 'HEAD']);
  return { starter, first_user, teammate, second_user, coauthor_only };
}
