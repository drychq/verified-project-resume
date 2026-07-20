# Resume guard policy

## Contents

- Reference integrity
- Ownership verbs
- Numbers and estimates
- Performance and production language
- Dependency escalation
- Bilingual parity

## Reference integrity

Every summary and clause must cite existing admissible claims and evidence. Metric IDs must exist and be eligible. A source archive hash mismatch is a hard failure.

## Ownership verbs

English `led`, `owned`, `architected`, and `spearheaded`, and Chinese `主导`, `牵头`, `独立负责`, and `负责整体架构`, require a user-scoped claim with ownership `sole` or `lead`.

English `designed` and Chinese `设计` require user scope and ownership `sole`, `lead`, or `shared`.

English `implemented`, `developed`, or `built`, and Chinese `实现`, `开发`, or `构建`, require a user-scoped claim whose action kind supports implementation. They are forbidden when the cited action is only `integrated`, `configured`, or `called`.

## Numbers and estimates

Every numeric token must be present in an admissible source claim or eligible metric. Approximation markers such as `~`, `approximately`, `about`, `roughly`, `around`, `up to`, `约`, `大约`, `近`, and `最高` fail unless the exact phrase is itself in an admissible claim; the deterministic guard uses the safer default and rejects them.

## Performance, production, scale, and causality language

Performance comparisons require a verified performance-tagged result and an eligible measured metric containing baseline, result, method, and evidence.

`production` wording requires `production-evidence`; reliability or availability wording requires `reliability-evidence`; scale wording requires `scale-evidence`; and direct cause-and-effect wording requires `causal-evidence`. A Dockerfile, retry loop, health check, test pass, design capacity, or chronological sequence is insufficient.

## Dependency escalation

When the action claim is tagged `dependency-integration` or its action kind is `integrated`, `configured`, or `called`, forbid design/implementation verbs for the dependency. Describe the user's integration, configuration, boundary validation, adaptation, or orchestration instead.

## Bilingual parity

When language mode is `both`, each semantic group must contain exactly one `zh-CN` and one `en` bullet with identical compression method and source ID sets. Translation quality never justifies adding or removing a fact.

The deterministic check proves source-set parity, not semantic translation equivalence. Read both texts against their shared clauses before delivery; treat this review as mandatory and do not describe it as mechanically proven.
