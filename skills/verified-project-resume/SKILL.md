---
name: verified-project-resume
description: Audit a real software repository, build a complete evidence-backed library of detailed contribution-centered STAR stories, and tailor a guarded resume candidate pool into one to four role-specific bullets. Use for end-to-end repository-to-resume work, interview preparation, importing an earlier schema_version 1.0.0 archive, or retargeting an existing verified workspace to a new job description. Keep evidence collection, STAR construction, candidate generation, and final selection as ordered internal stages; never accept a raw resume as proof of project facts.
---

# Verified Project Resume

Use one workspace for the full workflow. Expose Markdown to the user and keep machine records under `.verified-resume/`. Do not ask the user to edit JSONL or negotiate an artifact schema version.

## Non-negotiable boundaries

- Analyze one primary repository per workspace.
- Establish evidence before personal claims, personal claims before STAR stories, STAR stories before candidates, and a target role or job description before final selection.
- Never infer ownership from repository presence, file location, contributor count, or complexity.
- Never turn starter code, dependency capabilities, generated code, team work, plans, tests, or theoretical benefits into stronger personal outcomes.
- Never bypass a STAR story when creating a resume candidate.
- Preserve missing facts as focused questions. Do not manufacture extra stories or duplicate bullets to meet a count.

Read [evidence-policy.md](references/evidence-policy.md) and [attribution-guide.md](references/attribution-guide.md) before creating claims. Read [workspace-contract.md](references/workspace-contract.md) before editing the private ledger. If execution is considered, read [test-benchmark-policy.md](references/test-benchmark-policy.md). Before drafting candidates, read [star-story-policy.md](references/star-story-policy.md), [compression-policy.md](references/compression-policy.md), [guard-policy.md](references/guard-policy.md), and [language-guide.md](references/language-guide.md). Read [github-evidence-contract.md](references/github-evidence-contract.md) only when GitHub evidence is available.

## Choose the entry path

### Full repository workflow

Collect or confirm:

- absolute repository path and an output workspace outside the repository unless tracked artifacts are explicitly requested;
- Git author names/emails and optional GitHub handle;
- optional date range and starter/upstream ref;
- whether read-only GitHub lookup is allowed;
- command-specific execution policy for tests and benchmarks;
- optional target role, job description, language, and focus.

If identity is missing, continue with project facts but keep personal ownership unknown and ineligible. If no target role or job description is available, finish the STAR library and candidate pool but do not select final bullets.

### Retarget an existing workspace

Open `<workspace>/.verified-resume/ledger.jsonl`, validate the STAR stage, read the new target role or job description, replace candidate/group/selection records only, validate the resume stage, and rerender all four Markdown files. Do not recollect or rewrite established facts unless the underlying repository evidence changed.

### Import a legacy archive

Run:

```text
node <skill-dir>/scripts/workspace.mjs import-legacy --archive <star-project.json> --workspace <workspace>
```

The importer preserves evidence, claims, contributions, metrics, questions, and old STAR fragments. It regenerates contribution-centered stories without guessing old cross-array pairings and marks them `legacy_review_required`. Review and enrich every imported story before making it resume eligible.

## Stage 1: collect repository evidence

Resolve this skill directory from the loaded `SKILL.md` path. Store raw collection files under `<workspace>/.verified-resume/raw/`.

Run the deterministic read-only collectors:

```text
node <skill-dir>/scripts/collect_evidence.mjs inventory --repo <repo> --out <workspace>/.verified-resume/raw/inventory.json
node <skill-dir>/scripts/collect_evidence.mjs git --repo <repo> --identity <identity.json> --out <workspace>/.verified-resume/raw/git-evidence.json
```

Add `--starter-ref`, `--upstream-ref`, or date options only when known. Inspect relevant source, docs, tests, benchmark definitions, dependency manifests, generated files, commits, and diffs. Treat commit matches as orientation rather than ownership proof.

Use a host-provided read-only GitHub integration when authorized. Record unavailable or unrequested sources explicitly.

Before any project command beyond read-only Git inspection:

1. Show the exact command and working directory.
2. Explain likely duration, network use, caches, builds, and output writes.
3. Obtain command-specific approval.
4. Capture command, environment, exit code, output paths, revision, and timestamp.

## Stage 2: build the private fact ledger

Create `<workspace>/.verified-resume/ledger.jsonl` using the record envelope defined in [workspace-contract.md](references/workspace-contract.md). Preserve these semantic controls:

- evidence availability and recomputable digest basis;
- claim status, scope, ownership, action kind, confidence, and resume eligibility;
- contribution-to-claim/evidence mappings;
- metric class, value/baseline/result/method, evidence, and eligibility;
- open questions, interview topics, and execution records.

Use `verified` only for conclusions directly supported by collected evidence. Use `user-confirmed` only for exact qualitative user statements with confirmation evidence. Keep remembered numbers ineligible.

After adding or changing evidence records, deterministically fill their digests:

```text
node <skill-dir>/scripts/workspace.mjs seal --ledger <workspace>/.verified-resume/ledger.jsonl
```

## Stage 3: build a complete STAR story library

Cluster work by defensible contribution or engineering decision. Create one complete `story` record per independent contribution theme; do not impose a maximum and do not split one theme merely to increase count.

For every story:

- write verified Situation context without invented business stakes;
- state the user's bounded Task, constraints, and success condition;
- record normally two to five sourced Action steps covering implementation, decisions, trade-offs, and validation when evidence supports them;
- record verified Results plus explicit result limits;
- attach contribution, claim, evidence, metric, and open-question IDs;
- include interview questions and risk flags;
- keep imported stories ineligible until their boundaries are reviewed.

Run a coverage pass. Every admissible user contribution must appear in at least one story or carry a specific `star_omission_reason`. Ask focused ownership or evidence questions before omitting useful work.

Validate and render the STAR stage:

```text
node <skill-dir>/scripts/workspace.mjs validate --ledger <workspace>/.verified-resume/ledger.jsonl --stage star
node <skill-dir>/scripts/workspace.mjs render --ledger <workspace>/.verified-resume/ledger.jsonl --workspace <workspace> --stage star
```

## Stage 4: build the guarded candidate pool

Create at least one `candidate-group` for every resume-eligible story. A group represents one semantic bullet and contains one candidate per requested language.

For each candidate:

- cite at least one STAR story;
- cite only claims, evidence, and metrics already contained by that story;
- split text into sourced action, method, and result clauses;
- use `action-method-result` for verified results and `action-method-verified-capability` otherwise;
- record interview follow-ups and risk flags.

Do not cap the candidate pool. Keep distinct supported engineering angles, but merge genuine duplicates. The deterministic guard must pass for every pool candidate.

## Stage 5: select the role-specific resume entry

Read the target role or job description before adding the single `selection` record. Rank candidate groups by:

1. target-role relevance;
2. evidence strength;
3. technical distinctness;
4. duplication penalty.

Select three groups by default, never more than four, and allow one when only one distinct supported story exists. Record an omission reason for every unselected group. Tailoring may reorder, select, shorten, and choose supported terminology; it must not change facts, ownership, causality, scale, or result strength.

Validate and render the complete workflow:

```text
node <skill-dir>/scripts/workspace.mjs validate --ledger <workspace>/.verified-resume/ledger.jsonl --stage resume
node <skill-dir>/scripts/workspace.mjs render --ledger <workspace>/.verified-resume/ledger.jsonl --workspace <workspace> --stage resume
```

Do not report completion unless validation exits zero.

## Required delivery

Return these user-facing paths:

- `<workspace>/star.md` — complete detailed STAR story library;
- `<workspace>/resume-candidate-pool.md` — all guarded candidates;
- `<workspace>/resume.md` — one to four target-selected bullets;
- `<workspace>/review.md` — workflow acceptance, evidence gaps, warnings, questions, and exclusions.

Explain that `.verified-resume/ledger.jsonl` is private machine state and does not require user maintenance. Safety means every final bullet traces through STAR to admissible claims, metrics, and evidence—not merely that the wording sounds plausible.

See [methodology-sources.md](references/methodology-sources.md) for conceptual provenance.
