# Evidence and claim policy

## Source types

Code and documents (when shared): source files, docs, tests, benchmark definitions, dependency manifests, generated files, commits, and inspected diffs.

User sources:

- `user-statement`: the user's verbatim account of their work;
- `user-confirmation`: the user's verbatim answer to a focused question;
- `user-material`: an excerpt the user provides from an old resume, notes, or document;
- `user-approved-proposal`: a skill proposal plus the user's verbatim confirmation, recorded together.

User sources prove what the user says or attests. They never prove project facts on their own. Material proves the user previously wrote something, not that it is true. An approved proposal proves the proposal was confirmed, not that it was independently verified.

## Evidence availability

Use `collected` only when the referenced artifact was actually read or produced. Use `unavailable` when a source or tool cannot be accessed, `not-requested` when it was outside the agreed scope, and `failed` when collection was attempted but errored.

Absence rules:

- `unavailable` is not evidence that a contribution, test, or benchmark does not exist.
- A missing test is not evidence that the feature is incorrect.
- A passing test is evidence only for the tested condition and environment.
- A file digest proves which artifact was inspected, not that every statement in the file is true.

## Digest basis

Every evidence item declares how its SHA-256 is recomputed:

- `file-bytes`: hash the bytes at `locator.artifact_path` or `locator.path`; relative repository paths resolve from `project.repo_root`;
- `canonical-record`: hash UTF-8 canonical JSON containing `type`, `title`, `locator`, and `excerpt`, with sorted keys and compact separators;
- `user-confirmation-text`: hash the exact UTF-8 `excerpt` for user statements, confirmations, and materials;
- `proposal-confirmation-text`: hash the canonical record containing `proposal_excerpt` and `confirmation_excerpt`;
- `not-applicable`: use only for evidence whose availability is not `collected`, with `sha256: null`.

Do not use `canonical-record` to imply that an external source was independently verified. It binds the normalized record against later mutation; retain URLs, commit SHAs, and raw artifact paths in the locator.

## Claim status

| Status | Meaning | Resume admission |
|---|---|---|
| `verified` | Directly supported by cited code or document evidence | Allowed when scope and sources are suitable; requires at least one non-testimony source |
| `user-confirmed` | The user's own words (statement, confirmation, or material) | Allowed for qualitative content |
| `user-approved` | A bounded, non-numeric proposal the user confirmed item by item | Allowed; introduces no number the user did not provide |
| `inferred` | Reasonable interpretation without direct support | Never allowed |
| `unknown` | Insufficient or missing sources | Never allowed |
| `contradicted` | Sources conflict with the statement | Never allowed |

Do not convert confidence into status. A highly plausible inference remains `inferred`.

## Scope and ownership

Use exactly one scope:

- `project`: capability or context of the project as a whole;
- `user-sole`: user implemented or decided the scoped work alone;
- `user-partial`: user implemented a specifically bounded part;
- `team`: team result with no defensible personal split;
- `starter`: supplied course/template/upstream behavior;
- `third-party`: framework, library, service, or external component capability;
- `generated`: generated/vendor/minified/copied artifact;
- `unknown`: authorship cannot be established.

Use ownership level `sole`, `lead`, `shared`, `contributor`, `none`, or `unknown`. `lead` requires an explicit user statement or a confirmed proposal of decision authority; commit volume is insufficient.

Use action kind to preserve verb strength: `designed`, `implemented`, `integrated`, `configured`, `called`, `tested`, `debugged`, `optimized`, `documented`, `reviewed`, or `none`.

## Resume admission

A claim may set `resume_eligible: true` only when:

- status is `verified`, `user-confirmed`, or `user-approved`;
- it has at least one collected source;
- user-confirmed claims cite collected user text;
- user-approved claims cite a collected proposal record and introduce no number the user did not provide;
- it is not contradicted by another collected source.

Action STAR items additionally require at least one `user-sole` or `user-partial` claim. Project facts can support Situation. Team facts can provide context but cannot be phrased as personal action.

## Prohibited upgrades

- Project contains feature → user built feature.
- User called library → user designed library or algorithm.
- User edited a file → user owned the subsystem.
- Many commits → architectural leadership.
- Unit test passed → production reliability.
- Retry exists → self-healing system.
- Health check exists → zero-downtime deployment.
- Design capacity or SLA target → achieved scale.
- README performance claim without raw measurement → verified result.
- TODO, issue proposal, or planned PR → completed work.
- Old-resume bullet → verified fact.
- Skill proposal → user initiative.
- Remembered number → measured number.
