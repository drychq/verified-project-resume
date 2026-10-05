# Checking policy and language rules

## Two levels

The deterministic checks report two levels:

- **Must fix (blocks the workflow)**: text without sources; inadmissible claim or metric statuses; a number that appears in no cited source; wording stronger than the cited action kinds or ownership; a proposal that introduces a number or result wording the user did not provide.
- **Review warning (does not block)**: performance, production, reliability, scale, or causal wording that rests only on the user's account; approximate wording on a number the user provided. Warnings are written into `review.md` and printed by the CLI.

## Reference integrity

Every summary and clause must cite existing admissible claims and evidence. Metric IDs must exist and be eligible.

## Ownership verbs

English `led`, `owned`, `architected`, and `spearheaded`, and Chinese `主导`, `牵头`, `独立负责`, and `负责整体架构`, require a user-scoped claim with ownership `sole` or `lead`.

English `designed` and Chinese `设计` require user scope and ownership `sole`, `lead`, or `shared`.

English `implemented`, `developed`, or `built`, and Chinese `实现`, `开发`, or `构建`, require a user-scoped claim whose action kind supports implementation. They are forbidden when the cited action is only `integrated`, `configured`, or `called`.

## Numbers

Every numeric token must appear in a cited admissible claim or metric. Numbers from `user-provided` metrics are allowed and are listed in `review.md` with their source. Approximate wording (`~`, `about`, `约`, `大约`, and similar) is allowed only when every number in the text is one the user provided; otherwise it is rejected.

The skill never proposes a number. A confirmed proposal that contains a number the user never said is a hard failure.

## Performance, production, scale, and causality language

Performance comparisons are strongest with an eligible measured metric containing baseline, result, method, and evidence. When such a metric is missing and every cited claim rests on the user's account, the wording is a review warning instead of a failure.

`production` wording requires `production-evidence`; reliability or availability wording requires `reliability-evidence`; scale wording requires `scale-evidence`; and direct cause-and-effect wording requires `causal-evidence` — unless every cited claim rests on the user's account, in which case the wording is a review warning. A Dockerfile, retry loop, health check, test pass, design capacity, or chronological sequence is insufficient.

## Dependency escalation

When the action claim is tagged `dependency-integration` or its action kind is `integrated`, `configured`, or `called`, forbid design/implementation verbs for the dependency. Describe the user's integration, configuration, boundary validation, adaptation, or orchestration instead.

## Bilingual parity

When language mode is `both`, each semantic group must contain exactly one `zh-CN` and one `en` bullet with identical compression method and source ID sets. Translation quality never justifies adding or removing a fact.

The same parity applies to the project overview: overview variants across languages must cite identical claim, evidence, and metric ID sets, and each overview record's refs must mirror its cited sources. Both rules are deterministically enforced. `interview_qa` entries are review-only and are exempt from parity.

The deterministic check proves source-set parity, not semantic translation equivalence. Read both texts against their shared clauses before delivery; treat this review as mandatory and do not describe it as mechanically proven.

## Language form

Keep a bullet to one sentence when practical. Lead with the user's bounded action, name only decision-relevant technology, and finish with the supported result or capability. Do not add adjectives such as scalable, robust, enterprise-grade, or production-ready without corresponding sources.

Chinese:

- Prefer concrete verbs: `实现`, `集成`, `配置`, `调试`, `验证`, `优化`, `修复`, `设计` when supported.
- Use `通过……实现/验证……` for method and outcome.
- Avoid `深度参与`, `赋能`, `业界领先`, `工业级`, `海量`, `高并发` unless the user said or confirmed them.
- Keep technology names in their conventional English form where clearer.

English:

- Prefer past-tense concrete verbs: `implemented`, `integrated`, `configured`, `debugged`, `validated`, `optimized`, `fixed`, `designed` when supported.
- Use `using`, `by`, or `through` for method.
- Avoid `world-class`, `enterprise-grade`, `highly scalable`, `mission-critical`, and `production-ready` without corresponding sources.

## Safe verbs by contribution type

| Action kind | Chinese | English |
|---|---|---|
| `implemented` | 实现、开发 | implemented, developed, built |
| `designed` | 设计 | designed |
| `integrated` | 集成、接入 | integrated, connected |
| `configured` | 配置、搭建配置 | configured, set up |
| `called` | 调用、使用 | used, called |
| `tested` | 测试、验证 | tested, validated |
| `debugged` | 调试、定位并修复 | debugged, diagnosed and fixed |
| `optimized` | 优化 | optimized |
| `documented` | 编写文档、记录 | documented |
| `reviewed` | 审查、评审 | reviewed |

Use the weakest accurate verb when the sources support multiple interpretations.
