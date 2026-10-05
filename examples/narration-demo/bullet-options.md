# Bullet Options

Every option below comes from a complete story. Final selection happens only after a target role or job description is available.

## 1. rule parser option

- Group ID: `group-rule-parser`
- Story sources: `story-rule-engine`

- **zh-CN**: 负责风控规则引擎的规则解析模块，基于 ANTLR 实现表达式解析与文件热加载，并将硬编码规则迁移为可配置定义，在峰值约 2000 QPS 场景下提升规则发布效率。
  - Option ID: `candidate-rule-parser-zh-CN`
  - Form: `action-method-result`
  - Sources: story: `story-rule-engine`; claim: `claim-risk-parser`, `claim-risk-migrate`, `claim-risk-perf`; evidence: `ev-prop-parser`, `ev-old-resume`, `ev-narr-role`, `ev-narr-perf`, `ev-narr-number`; metric: `metric-risk-peak`
  - Grounding: code-supported 0; from your account 3; numbers you provided 1
  - Interview follow-up: 热加载与解析器分别由谁完成？
  - Risk flags: user-provided-number

- **en**: Worked on the rule-parsing module of the risk-control rule engine, built the expression parser with ANTLR and file hot reload, migrated hard-coded rules to configurable definitions, and improved rule rollout efficiency under a peak load of about 2000 QPS.
  - Option ID: `candidate-rule-parser-en`
  - Form: `action-method-result`
  - Sources: story: `story-rule-engine`; claim: `claim-risk-parser`, `claim-risk-migrate`, `claim-risk-perf`; evidence: `ev-prop-parser`, `ev-old-resume`, `ev-narr-role`, `ev-narr-perf`, `ev-narr-number`; metric: `metric-risk-peak`
  - Grounding: code-supported 0; from your account 3; numbers you provided 1
  - Interview follow-up: 热加载与解析器分别由谁完成？
  - Risk flags: user-provided-number

## 2. rule configuration option

- Group ID: `group-rule-config`
- Story sources: `story-rule-engine`

- **zh-CN**: 将硬编码风控规则迁移为可配置的规则描述，并配合解析模块改造缩短规则上线流程。
  - Option ID: `candidate-rule-config-zh-CN`
  - Form: `action-method-result`
  - Sources: story: `story-rule-engine`; claim: `claim-risk-migrate`, `claim-risk-parser`, `claim-risk-perf`; evidence: `ev-old-resume`, `ev-narr-role`, `ev-prop-parser`, `ev-narr-perf`
  - Grounding: code-supported 0; from your account 3; numbers you provided 0
  - Interview follow-up: 规则配置化改造的范围是什么？
  - Risk flags: none

- **en**: Migrated hard-coded risk rules to configurable rule definitions and shortened the rule rollout path alongside the parser rework.
  - Option ID: `candidate-rule-config-en`
  - Form: `action-method-result`
  - Sources: story: `story-rule-engine`; claim: `claim-risk-migrate`, `claim-risk-parser`, `claim-risk-perf`; evidence: `ev-old-resume`, `ev-narr-role`, `ev-prop-parser`, `ev-narr-perf`
  - Grounding: code-supported 0; from your account 3; numbers you provided 0
  - Interview follow-up: 规则配置化改造的范围是什么？
  - Risk flags: none
