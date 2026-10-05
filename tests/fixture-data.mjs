import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { canonical, sha256Text } from '../skills/verified-project-resume/scripts/lib/records.mjs';

export async function writeJson(file, data) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8' });
}

function record(record_type, id, data = {}, refs = {}) { return { record_type, id, data, refs }; }

function sourced(text, claim_ids, evidence_ids, metric_ids = []) { return { text, claim_ids, evidence_ids, metric_ids }; }

function projectEvidence(id, title, excerpt) {
  const data = {
    type: 'diff', availability: 'collected', title, locator: { path: title },
    digest_basis: 'canonical-record', sha256: null, excerpt, collected_at: '2026-07-20T00:00:00Z',
  };
  data.sha256 = sha256Text(canonical({ type: data.type, title: data.title, locator: data.locator, excerpt: data.excerpt }));
  return record('evidence', id, data, {});
}

function userTextEvidence(id, type, title, excerpt) {
  return record('evidence', id, {
    type, availability: 'collected', title, locator: {},
    digest_basis: 'user-confirmation-text', sha256: sha256Text(excerpt), excerpt, collected_at: '2026-07-20T00:00:00Z',
  }, {});
}

function proposalEvidence(id, title, proposalExcerpt, confirmationExcerpt) {
  return record('evidence', id, {
    type: 'user-approved-proposal', availability: 'collected', title, locator: {},
    digest_basis: 'proposal-confirmation-text', sha256: sha256Text(canonical({ proposal_excerpt: proposalExcerpt, confirmation_excerpt: confirmationExcerpt })),
    proposal_excerpt: proposalExcerpt, confirmation_excerpt: confirmationExcerpt, collected_at: '2026-07-20T00:00:00Z',
  }, {});
}

function narrationClaim(id, text, scope, status, ownership_level, action_kind, evidence_ids, tags = []) {
  return record('claim', id, { text, scope, status, ownership_level, action_kind, tags,
    confidence: status === 'verified' ? 'high' : 'medium',
    confidence_reason: 'Synthetic fixture evidence explicitly supports this narrow claim.', resume_eligible: true }, { evidence_ids });
}

export function makeRepositoryRecords({ storyCount = 3, languages = ['zh-CN', 'en'], selectedCount = Math.min(3, storyCount), includeSelection = true } = {}) {
  const records = [
    record('project', 'project:course-index', { id: 'course-index', name: 'Course Index', repo_root: '/synthetic-fixture/course-index', revision: '1234567890abcdef', repository_kind: 'course', remote_url: null }, {}),
    record('analysis', 'analysis:primary', { execution_policy: 'ask-before-execute', collected_at: '2026-07-20T00:00:00Z' }, {}),
    record('identity', 'identity:primary', { names: ['Student Dev'], emails: ['student@example.test'], status: 'confirmed' }, {}),
  ];
  const labels = ['parser', 'storage', 'cache', 'scheduler', 'protocol', 'index', 'logging', 'testing'];
  const groupIds = [];
  for (let index = 0; index < storyCount; index += 1) {
    const label = labels[index] ?? `component-${index + 1}`;
    const evidenceId = `ev-${label}`, claimId = `claim-${label}`, contributionId = `contribution-${label}`, storyId = `story-${label}`, groupId = `group-${label}`;
    const claimText = `The user implemented the bounded ${label} change and validated its project-specific behavior.`;
    records.push(projectEvidence(evidenceId, `src/${label}.cpp`, `Student implemented and validated the bounded ${label} change.`));
    records.push(record('claim', claimId, {
      text: claimText, scope: 'user-partial', status: 'verified', ownership_level: 'shared', action_kind: 'implemented', tags: [], confidence: 'high', confidence_reason: 'The synthetic diff directly supports the bounded change.', resume_eligible: true,
    }, { evidence_ids: [evidenceId] }));
    records.push(record('contribution', contributionId, { summary: `${label} implementation and validation`, paths: [`src/${label}.cpp`], symbols: [`${label}::run`], commit_ids: [`commit-${label}`], star_omission_reason: null }, { claim_ids: [claimId], evidence_ids: [evidenceId], metric_ids: [] }));
    const section = (text) => sourced(text, [claimId], [evidenceId]);
    records.push(record('story', storyId, {
      title: `${label} implementation and validation`,
      situation: [section(`The project required a bounded ${label} change within the existing module.`)],
      task: [section(`The user was responsible for the scoped ${label} implementation and its validation.`)],
      actions: [section(`Implemented the bounded ${label} behavior within the assigned path.`), section(`Validated the ${label} behavior against the cited project evidence.`)],
      results: [section(`Established the ${label} capability within the cited project boundary.`)],
      constraints: ['Personal ownership is limited to the cited change.'], decisions: [`Kept the ${label} change within its existing module boundary.`], tradeoffs: ['Preferred a bounded change over claiming broader subsystem ownership.'],
      result_limits: ['The sources support the project-specific capability, not production scale or reliability.'],
      interview_questions: [`Why was the ${label} change kept within this boundary?`], risk_flags: [], resume_eligible: true,
    }, { contribution_ids: [contributionId], claim_ids: [claimId], evidence_ids: [evidenceId], metric_ids: [], open_question_ids: [] }));
    const candidateIds = [];
    for (const language of languages) {
      const text = language === 'zh-CN' ? `在既有模块边界内实现并验证 ${label} 变更，形成有来源的项目能力。` : `Implemented and validated the bounded ${label} change, establishing the capability from recorded sources.`;
      const candidateId = `candidate-${label}-${language}`;
      candidateIds.push(candidateId);
      records.push(record('candidate', candidateId, {
        language, text, compression_method: 'action-method-capability',
        clauses: {
          action: section(language === 'zh-CN' ? `实现 ${label} 变更` : `Implemented the bounded ${label} change`),
          method: section(language === 'zh-CN' ? '限制在既有模块边界内并验证行为' : 'Kept the change bounded and validated its behavior'),
          result: section(language === 'zh-CN' ? '形成有来源的项目能力' : 'Established the capability from recorded sources'),
        },
        interview_questions: [`What did the ${label} change cover?`],
        interview_qa: language === 'zh-CN'
          ? [{ question: `这次 ${label} 改动覆盖了什么？`, answer: '只覆盖证据里记录的边界内改动，不主张更多所有权。' }]
          : [{ question: `What did the ${label} change cover?`, answer: 'Only the bounded change recorded in the cited evidence; no broader ownership.' }],
        risk_flags: [],
      }, { story_ids: [storyId], claim_ids: [claimId], evidence_ids: [evidenceId], metric_ids: [] }));
    }
    groupIds.push(groupId);
    records.push(record('candidate-group', groupId, { title: `${label} option`, selection_omission_reason: index < selectedCount ? null : 'Less relevant to the current target role than selected options.' }, { story_ids: [storyId], candidate_ids: candidateIds }));
  }
  if (includeSelection) {
    const overviewTexts = {
      'zh-CN': '面向课程场景的索引项目：本人负责在既有模块边界内实现并验证核心组件变更。',
      en: 'A course index project where the user implemented and validated bounded component changes within existing module boundaries.',
    };
    const overviewQa = {
      'zh-CN': [{ question: '这些组件都是你一个人做的吗？', answer: '不是；只包括证据里记录的边界内改动。' }],
      en: [{ question: 'Did you build every component alone?', answer: 'No; the sources cover bounded changes within each module.' }],
    };
    for (const language of languages) records.push(record('overview', `overview:${language}`, {
      language, ...sourced(overviewTexts[language], ['claim-parser'], ['ev-parser']), interview_qa: overviewQa[language],
    }, { claim_ids: ['claim-parser'], evidence_ids: ['ev-parser'], metric_ids: [] }));
    records.push(record('selection', 'selection:current', {
      target_role: 'systems engineer', job_description: 'Build and validate bounded systems components.', focus: 'correctness and implementation boundaries', languages,
    }, { selected_group_ids: groupIds.slice(0, selectedCount) }));
  }
  return records;
}

export function makeNarrationRecords({ languages = ['zh-CN', 'en'] } = {}) {
  const records = [
    record('project', 'project:risk-rule-engine', { id: 'risk-rule-engine', name: 'Risk Rule Engine', repo_root: null, revision: null, repository_kind: 'confidential', remote_url: null }, {}),
    record('analysis', 'analysis:primary', { provided_sources: ['user statements', 'user materials'], code_available: false, collected_at: '2026-07-20T00:00:00Z' }, {}),
    record('identity', 'identity:primary', { names: ['Demo User'], emails: [], github_handle: null, status: 'self-reported' }, {}),
    userTextEvidence('ev-narr-context', 'user-statement', 'user statement: project context', '系统是内部风控服务，规则原先写死在代码里，改一次规则要走完整的发版流程。'),
    userTextEvidence('ev-narr-role', 'user-statement', 'user statement: role', '我在组里负责风控规则引擎的规则解析模块，主要是把旧的硬编码规则迁移成可配置的 DSL。'),
    userTextEvidence('ev-narr-owner', 'user-confirmation', 'user confirmation: ownership', '对，解析模块主要是我做的，另一个同事负责接入层。'),
    userTextEvidence('ev-narr-perf', 'user-statement', 'user statement: effect', '重构之后规则加载快了不少，以前改规则要提前一周准备，后来基本当天就能上。'),
    userTextEvidence('ev-narr-number', 'user-statement', 'user statement: scale', '峰值大概 2000 QPS 吧，平时是几百的量级。'),
    userTextEvidence('ev-old-resume', 'user-material', 'old resume excerpt', '旧简历摘录：负责风控策略配置化改造，参与规则引擎重构。'),
    proposalEvidence('ev-prop-parser', 'confirmed proposal: parser', '规则解析模块基于 ANTLR 实现表达式解析，支持规则文件热加载。', '对，是 ANTLR 做的，热加载也是我加的。'),
  ];
  records.push(narrationClaim('claim-risk-project', '项目是内部风控服务，规则原先硬编码在代码中，修改规则需要完整发版。', 'project', 'user-confirmed', 'none', 'none', ['ev-narr-context']));
  records.push(narrationClaim('claim-risk-role', '用户负责风控规则引擎的规则解析模块，与接入层同事协作。', 'user-partial', 'user-confirmed', 'shared', 'implemented', ['ev-narr-role', 'ev-narr-owner']));
  records.push(narrationClaim('claim-risk-migrate', '用户参与把硬编码规则迁移为可配置的规则描述。', 'user-partial', 'user-confirmed', 'shared', 'implemented', ['ev-old-resume', 'ev-narr-role']));
  records.push(narrationClaim('claim-risk-parser', '规则解析模块基于 ANTLR 实现表达式解析，支持规则文件热加载。', 'user-partial', 'user-approved', 'shared', 'implemented', ['ev-prop-parser']));
  records.push(narrationClaim('claim-risk-perf', '重构后规则加载与发布明显加快，改规则不再需要提前一周准备。', 'user-partial', 'user-confirmed', 'shared', 'optimized', ['ev-narr-perf']));
  records.push(record('metric', 'metric-risk-peak', {
    name: 'peak request rate', kind: 'performance', status: 'user-provided', value: 2000, unit: 'QPS', baseline: null, result: null,
    measurement_method: null, source_note: '口述回忆的峰值量级', review_flags: ['user-provided-number'], resume_eligible: true,
  }, { evidence_ids: ['ev-narr-number'] }));
  records.push(record('contribution', 'contribution-rule-engine', {
    summary: '风控规则引擎解析模块与规则配置化改造', paths: [], symbols: [], commit_ids: [], star_omission_reason: null,
  }, { claim_ids: ['claim-risk-role', 'claim-risk-migrate', 'claim-risk-parser', 'claim-risk-perf'], evidence_ids: ['ev-narr-role', 'ev-narr-owner', 'ev-old-resume', 'ev-prop-parser', 'ev-narr-perf', 'ev-narr-number'], metric_ids: ['metric-risk-peak'] }));
  records.push(record('story', 'story-rule-engine', {
    title: '风控规则引擎：解析模块与规则配置化',
    situation: [sourced('项目是内部风控服务，规则原先硬编码在代码里，改一次规则要走完整发版流程。', ['claim-risk-project'], ['ev-narr-context'])],
    task: [sourced('用户负责规则解析模块，与接入层同事协作。', ['claim-risk-role'], ['ev-narr-role', 'ev-narr-owner'])],
    actions: [
      sourced('基于 ANTLR 实现表达式解析器，支持规则文件热加载。', ['claim-risk-parser'], ['ev-prop-parser']),
      sourced('把硬编码规则迁移为可配置的规则描述。', ['claim-risk-migrate'], ['ev-old-resume', 'ev-narr-role']),
    ],
    results: [sourced('规则加载与发布明显加快，峰值约 2000 QPS 场景下保持稳定。', ['claim-risk-perf'], ['ev-narr-perf', 'ev-narr-number'], ['metric-risk-peak'])],
    constraints: ['代码与文档不能带出公司，全部来源为用户口述、旧材料与逐条确认。'],
    decisions: ['解析方案采用 ANTLR 表达式解析（经用户逐条确认）。'],
    tradeoffs: ['以规则文件热加载代替重新发版。'],
    result_limits: ['数字来自用户口述回忆，没有监控截图；性能表述仅由口述支撑。'],
    interview_questions: ['热加载与解析器分别由谁完成？', '峰值 2000 QPS 的口径是什么？'],
    risk_flags: ['user-provided-number'], resume_eligible: true,
  }, { contribution_ids: ['contribution-rule-engine'], claim_ids: ['claim-risk-project', 'claim-risk-role', 'claim-risk-migrate', 'claim-risk-parser', 'claim-risk-perf'], evidence_ids: ['ev-narr-context', 'ev-narr-role', 'ev-narr-owner', 'ev-old-resume', 'ev-prop-parser', 'ev-narr-perf', 'ev-narr-number'], metric_ids: ['metric-risk-peak'], open_question_ids: ['q-qps-source'] }));

  const parserTexts = {
    'zh-CN': '负责风控规则引擎的规则解析模块，基于 ANTLR 实现表达式解析与文件热加载，并将硬编码规则迁移为可配置定义，在峰值约 2000 QPS 场景下提升规则发布效率。',
    en: 'Worked on the rule-parsing module of the risk-control rule engine, built the expression parser with ANTLR and file hot reload, migrated hard-coded rules to configurable definitions, and improved rule rollout efficiency under a peak load of about 2000 QPS.',
  };
  const configTexts = {
    'zh-CN': '将硬编码风控规则迁移为可配置的规则描述，并配合解析模块改造缩短规则上线流程。',
    en: 'Migrated hard-coded risk rules to configurable rule definitions and shortened the rule rollout path alongside the parser rework.',
  };
  const parserQa = {
    'zh-CN': [
      { question: 'ANTLR 方案是你定的吗？', answer: '方案由我提出并在整理时逐条确认，解析器与热加载都是我实现的。' },
      { question: '2000 QPS 这个数字从哪来？', answer: '口述回忆的峰值量级，没有监控截图，答辩时按回忆值说明。' },
    ],
    en: [
      { question: 'Was the ANTLR choice yours?', answer: 'I proposed it and confirmed the wording item by item; I built the parser and the hot reload.' },
      { question: 'Where does 2000 QPS come from?', answer: 'A remembered peak magnitude; there is no dashboard screenshot, so I state it as recalled.' },
    ],
  };
  const parserClauses = {
    'zh-CN': {
      action: sourced('基于 ANTLR 实现表达式解析与文件热加载', ['claim-risk-parser'], ['ev-prop-parser']),
      method: sourced('将硬编码规则迁移为可配置定义', ['claim-risk-migrate'], ['ev-old-resume', 'ev-narr-role']),
      result: sourced('在峰值约 2000 QPS 场景下提升规则发布效率', ['claim-risk-perf'], ['ev-narr-perf', 'ev-narr-number'], ['metric-risk-peak']),
    },
    en: {
      action: sourced('Built the expression parser with ANTLR and file hot reload', ['claim-risk-parser'], ['ev-prop-parser']),
      method: sourced('Migrated hard-coded rules to configurable definitions', ['claim-risk-migrate'], ['ev-old-resume', 'ev-narr-role']),
      result: sourced('Improved rule rollout efficiency under a peak load of about 2000 QPS', ['claim-risk-perf'], ['ev-narr-perf', 'ev-narr-number'], ['metric-risk-peak']),
    },
  };
  const configClauses = {
    'zh-CN': {
      action: sourced('将硬编码风控规则迁移为可配置描述', ['claim-risk-migrate'], ['ev-old-resume', 'ev-narr-role']),
      method: sourced('配合解析模块改造', ['claim-risk-parser'], ['ev-prop-parser']),
      result: sourced('缩短规则上线流程', ['claim-risk-perf'], ['ev-narr-perf']),
    },
    en: {
      action: sourced('Migrated hard-coded risk rules to configurable definitions', ['claim-risk-migrate'], ['ev-old-resume', 'ev-narr-role']),
      method: sourced('Worked alongside the parser rework', ['claim-risk-parser'], ['ev-prop-parser']),
      result: sourced('Shortened the rule rollout path', ['claim-risk-perf'], ['ev-narr-perf']),
    },
  };
  const candidateIds = [];
  for (const language of languages) {
    const parserId = `candidate-rule-parser-${language}`, configId = `candidate-rule-config-${language}`;
    candidateIds.push({ parserId, configId, language });
    records.push(record('candidate', parserId, {
      language, text: parserTexts[language], compression_method: 'action-method-result', clauses: parserClauses[language],
      interview_questions: ['热加载与解析器分别由谁完成？'], interview_qa: parserQa[language], risk_flags: ['user-provided-number'],
    }, { story_ids: ['story-rule-engine'], claim_ids: ['claim-risk-parser', 'claim-risk-migrate', 'claim-risk-perf'], evidence_ids: ['ev-prop-parser', 'ev-old-resume', 'ev-narr-role', 'ev-narr-perf', 'ev-narr-number'], metric_ids: ['metric-risk-peak'] }));
    records.push(record('candidate', configId, {
      language, text: configTexts[language], compression_method: 'action-method-result', clauses: configClauses[language],
      interview_questions: ['规则配置化改造的范围是什么？'], risk_flags: [],
    }, { story_ids: ['story-rule-engine'], claim_ids: ['claim-risk-migrate', 'claim-risk-parser', 'claim-risk-perf'], evidence_ids: ['ev-old-resume', 'ev-narr-role', 'ev-prop-parser', 'ev-narr-perf'], metric_ids: [] }));
  }
  records.push(record('candidate-group', 'group-rule-parser', { title: 'rule parser option', selection_omission_reason: null }, { story_ids: ['story-rule-engine'], candidate_ids: candidateIds.map((item) => item.parserId) }));
  records.push(record('candidate-group', 'group-rule-config', { title: 'rule configuration option', selection_omission_reason: '与目标岗位相关性较低，保留在备选项中。' }, { story_ids: ['story-rule-engine'], candidate_ids: candidateIds.map((item) => item.configId) }));
  const overviewTexts = {
    'zh-CN': '内部风控规则引擎项目：本人负责规则解析模块，基于 ANTLR 实现表达式解析与文件热加载，并参与将硬编码规则迁移为可配置描述。',
    en: 'An internal risk-control rule engine where the user worked on the rule-parsing module, built the expression parser with ANTLR, and helped migrate hard-coded rules to configurable definitions.',
  };
  const overviewQa = {
    'zh-CN': [{ question: '整个引擎都是你做的吗？', answer: '不是；我只负责解析模块，接入层由同事负责，表述按此口径。' }],
    en: [{ question: 'Did you build the whole engine?', answer: 'No; I owned the parsing module while a teammate covered the integration layer.' }],
  };
  const overviewSources = { claim_ids: ['claim-risk-project', 'claim-risk-role', 'claim-risk-parser', 'claim-risk-migrate'], evidence_ids: ['ev-narr-context', 'ev-narr-role', 'ev-narr-owner', 'ev-prop-parser', 'ev-old-resume'] };
  for (const language of languages) records.push(record('overview', `overview:${language}`, {
    language, ...sourced(overviewTexts[language], overviewSources.claim_ids, overviewSources.evidence_ids), interview_qa: overviewQa[language],
  }, { ...overviewSources, metric_ids: [] }));
  records.push(record('selection', 'selection:current', {
    target_role: '资深后端开发工程师', job_description: '', focus: '规则引擎与解析器实现', languages,
  }, { selected_group_ids: ['group-rule-parser'] }));
  records.push(record('open-question', 'q-qps-source', { question: '峰值 2000 QPS 是否有监控截图或答辩材料可以核对？', status: 'open' }, {}));
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
