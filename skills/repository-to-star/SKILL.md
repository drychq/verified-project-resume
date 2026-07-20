---
name: repository-to-star
description: Analyze one real software repository and produce a complete, evidence-backed STAR project dossier without confusing project capabilities, starter code, dependencies, generated code, team work, or plans with the user's own contribution. Use when an agent must inspect source, README and design documents, tests, benchmarks, Git history, and optional GitHub issues or pull requests before creating interview material. Do not use to write final resume bullets; hand the validated archive to star-to-resume.
---

# Repository to STAR

Build a versioned `star-project.json` as the canonical fact source and render a traceable `star-project.md`. Fail closed: preserve missing facts as questions instead of completing a plausible story.

## Non-negotiable boundary

- Analyze one primary repository per run.
- Never infer personal ownership from project presence, file location, contributor counts, or technical complexity alone.
- Never turn a dependency call into implementation of that dependency.
- Never turn a test pass into production reliability, a target into an achieved result, or a theoretical benefit into a measurement.
- Never generate resume bullets. Finish with the validated archive path and identify `star-to-resume` as the required next skill. Show `$star-to-resume` only when the host supports that invocation syntax.

Read [evidence-policy.md](references/evidence-policy.md) before creating claims. Read [attribution-guide.md](references/attribution-guide.md) before assigning user scope. If tests or benchmarks exist, read [test-benchmark-policy.md](references/test-benchmark-policy.md). If GitHub evidence is available, read [github-evidence-contract.md](references/github-evidence-contract.md).

## Workflow

### 1. Establish scope before writing

Collect or confirm:

- absolute repository path;
- output directory outside the repository unless the user explicitly wants tracked artifacts;
- Git author names and emails plus optional GitHub handle;
- optional start/end dates;
- course starter, template, fork, or upstream repository/ref;
- whether read-only GitHub lookup is allowed;
- execution policy for tests and benchmarks.

If identity is missing, continue with project facts but keep every personal contribution `unknown` and ineligible. If no `.git` directory exists, record Git evidence as `unavailable`; do not treat that as a single-author project.

### 2. Collect deterministic local evidence

Resolve this skill directory from the loaded `SKILL.md` path. Run:

```text
python3 <skill-dir>/scripts/repo_evidence.py inventory --repo <repo> --out <output>/inventory.json
python3 <skill-dir>/scripts/repo_evidence.py git --repo <repo> --identity <identity.json> --out <output>/git-evidence.json
```

Add `--starter-ref` or `--upstream-ref` only when the ref is known. These scripts do not execute project code or contact a network.

Inspect the resulting inventory, then read the relevant source, docs, tests, benchmark definitions, dependency manifests, generated files, and diffs. Commit count is orientation data, not authorship proof.

### 3. Add optional GitHub evidence

Prefer an available host-provided read-only GitHub integration. Otherwise use authenticated `gh` read-only commands only after confirming access. Collect authored issues/PRs, changed files, reviews, merge SHA, linked commits, checks, and URLs using [github-evidence-contract.md](references/github-evidence-contract.md).

If GitHub is unavailable, create an availability record with the reason. Do not silently omit the source and do not write to GitHub.

### 4. Gate execution of tests and benchmarks

Before any repository command beyond read-only Git inspection:

1. show the exact command and working directory;
2. explain expected caches/build/output writes;
3. wait for explicit approval;
4. capture command, environment, exit code, stdout/stderr path, and timestamp;
5. classify the result under [test-benchmark-policy.md](references/test-benchmark-policy.md).

Approval for tests does not imply approval for benchmarks or arbitrary setup scripts.

### 5. Build evidence and claims

Use [star-project.schema.json](assets/star-project.schema.json). Start from [star-project.template.json](assets/star-project.template.json), then create:

- evidence records with stable IDs, source type, locator, availability, and a recomputable digest basis: `file-bytes`, `canonical-record`, `user-confirmation-text`, or `not-applicable`;
- claims with scope, status, ownership level, action kind, tags, evidence references, confidence, rationale, and eligibility;
- contributions that point only to user-scoped admissible claims;
- metrics with measurement class and evidence;
- STAR items that reference claims and evidence rather than restating unsupported prose;
- open questions and interview topics;
- an execution log including commands declined or unavailable.

Use `verified` only for conclusions directly supported by the cited evidence. Use `user-confirmed` only for explicit qualitative user statements and attach `user-confirmation` evidence. Metrics from user memory remain `user-confirmed` and ineligible.

### 6. Resolve uncertainty

Ask focused questions one at a time when the answer changes ownership or resume eligibility. Examples:

- Which diff or PR corresponds to your implementation?
- Was this component present in the starter or upstream version?
- Did you design the subsystem, implement a defined part, integrate it, or only use it?
- Is the number backed by raw benchmark/test/CI output, and what was the baseline?

Never ask the user to approve a prewritten strong claim. Capture their answer verbatim as evidence, then derive a narrowly scoped claim.

### 7. Validate and render

Run:

```text
python3 <skill-dir>/scripts/repo_evidence.py validate --archive <output>/star-project.json
python3 <skill-dir>/scripts/repo_evidence.py render --archive <output>/star-project.json --out <output>/star-project.md
```

Do not report completion unless validation exits zero. On failure, preserve the JSON and report every error. On success, report both paths and identify the next skill. When the host supports `$skill-name` invocation, say:

```text
Use $star-to-resume with <absolute-path>/star-project.json.
```

## Output quality

- Keep Situation about verified project context, not invented business stakes.
- Keep Task about the user's actual responsibility; allow qualitative `user-confirmed` scope when explicit.
- Keep Action at the level proved by diffs, symbols, tests, or PR evidence.
- Keep Result limited to verified measurements, deterministic counts, verified tests/correctness, or implemented capabilities.
- Preserve technical detail for interview follow-up even when it is too detailed for a resume.
- Label unavailable collection separately from negative evidence.

See [methodology-sources.md](references/methodology-sources.md) for conceptual provenance. The implementation is original and does not import third-party templates or metrics.
