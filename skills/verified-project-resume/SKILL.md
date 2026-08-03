---
name: verified-project-resume
description: Audit a real software repository, build a complete evidence-backed library of detailed contribution-centered STAR stories, and tailor a guarded candidate pool into a sourced project overview plus one to four role-specific resume bullets per selected language. Use for end-to-end repository-to-resume work, interview preparation, importing an archive from the retired two-skill workflow, or retargeting an existing verified workspace to a new job description. Keep evidence collection, STAR construction, candidate generation, and final selection as ordered internal stages; never accept a raw resume as proof of project facts.
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

Each stage below names the reference files it depends on; read them just before performing that stage instead of all at once.

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

Open `<workspace>/.verified-resume/ledger.jsonl`, validate the STAR stage, read the new target role or job description, replace candidate/group/selection/overview records only, validate the resume stage, and rerender all four Markdown files. Do not recollect or rewrite established facts unless the underlying repository evidence changed.

### Import a legacy archive

Run:

```text
node <skill-dir>/scripts/workspace.mjs import-legacy --archive <star-project.json> --workspace <workspace>
```

The importer preserves evidence, claims, contributions, metrics, questions, and old STAR fragments. It regenerates contribution-centered stories without guessing old cross-array pairings and marks them `legacy_review_required`. Review and enrich every imported story before making it resume eligible.

## Stage 1: collect repository evidence

Resolve this skill directory from the loaded `SKILL.md` path. Store raw collection files under `<workspace>/.verified-resume/raw/`. Both scripts answer `--help` and `--version`.

Run the deterministic read-only collectors:

```text
node <skill-dir>/scripts/collect_evidence.mjs inventory --repo <repo> --out <workspace>/.verified-resume/raw/inventory.json
node <skill-dir>/scripts/collect_evidence.mjs git --repo <repo> --identity <identity.json> --out <workspace>/.verified-resume/raw/git-evidence.json
```

Add `--starter-ref`, `--upstream-ref`, or `--start-date`/`--end-date` options only when known. Inspect relevant source, docs, tests, benchmark definitions, dependency manifests, generated files, commits, and diffs. Treat commit matches as orientation rather than ownership proof.

Use a host-provided read-only GitHub integration when authorized; read [github-evidence-contract.md](references/github-evidence-contract.md) only when GitHub evidence is available. Record unavailable or unrequested sources explicitly.

Before any project command beyond read-only Git inspection, read [test-benchmark-policy.md](references/test-benchmark-policy.md), then:

1. Show the exact command and working directory.
2. Explain likely duration, network use, caches, builds, and output writes.
3. Obtain command-specific approval.
4. Capture command, environment, exit code, output paths, revision, and timestamp.

## Stage 2: build the private fact ledger

Read [evidence-policy.md](references/evidence-policy.md) and [attribution-guide.md](references/attribution-guide.md) before creating claims, and [workspace-contract.md](references/workspace-contract.md) before editing the private ledger.

Create `<workspace>/.verified-resume/ledger.jsonl` using the record envelope defined in the workspace contract. Preserve these semantic controls:

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

Cluster work by defensible contribution or engineering decision. Create one complete `story` record per independent contribution theme; combine changes only when they address the same problem through a coherent method and result, split independent problems even when they share a subsystem, and do not impose a maximum or split one theme merely to increase count.

For every story:

- write verified Situation context without invented business stakes;
- state the user's bounded Task, constraints, and success condition;
- record normally two to five sourced Action steps covering implementation, decisions, trade-offs, and validation when evidence supports them;
- record verified Results plus explicit result limits;
- attach contribution, claim, evidence, metric, and open-question IDs;
- include interview questions and risk flags;
- leave empty decision or trade-off fields as review warnings rather than inventing content;
- keep imported stories ineligible until their boundaries are reviewed.

Run a coverage pass. Every admissible user contribution must appear in at least one story or carry a specific `star_omission_reason`. When a potentially useful story lacks responsibility, method, or outcome evidence, ask focused questions before omitting it: never ask the user to approve a prewritten strong claim; capture their answer verbatim as confirmation evidence, then derive the narrowest supported statement.

Validate and render the STAR stage:

```text
node <skill-dir>/scripts/workspace.mjs validate --ledger <workspace>/.verified-resume/ledger.jsonl --stage star
node <skill-dir>/scripts/workspace.mjs render --ledger <workspace>/.verified-resume/ledger.jsonl --workspace <workspace> --stage star
```

## Stage 4: build the guarded candidate pool

Read [compression-policy.md](references/compression-policy.md) and [guard-policy.md](references/guard-policy.md) before drafting candidates.

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

Add one `overview` record per selected language: a one-to-two-sentence resume project introduction stating what the project is, its verified capabilities or stack, and, when supported, the user's confirmed role. Cite claims and evidence like any other sourced text and mirror the cited IDs into the record refs; verified project/team/starter-scope claims are allowed as context. Overview variants across languages must cite identical source ID sets. Do not include numbers, scale, or production wording beyond the cited sources, and do not restate the selected bullets. Validation fails without an overview for every selected language.

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
- `<workspace>/resume.md` — a short project overview plus one to four target-selected bullets per selected language;
- `<workspace>/review.md` — workflow acceptance, evidence gaps, warnings, questions, and exclusions.

Explain that `.verified-resume/ledger.jsonl` is private machine state and does not require user maintenance, and advise keeping the workspace — or at least `.verified-resume/` — out of shared version control because the ledger stores local absolute paths and identity details. Safety means every final bullet traces through STAR to admissible claims, metrics, and evidence—not merely that the wording sounds plausible.
