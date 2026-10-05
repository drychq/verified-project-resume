---
name: verified-project-resume
description: Build a grounded story library, bullet options, and a tailored resume project entry from a narrated account of the user's work, with optional code or document sources when they can be shared. Use when the user cannot share source code or internal documents (for example confidential employer projects), when they describe their work from memory, when they provide an old resume or notes as material, when a repository or code snippets are available for optional read-only review, or when retargeting an existing workspace to a new job description. Keep every claim traceable to a recorded source, never let wording claim more than its sources support, and never invent numbers.
---

# Verified Project Resume

Work in one workspace. Show the user Markdown; keep machine records under `.verified-resume/`. The user never edits JSONL or negotiates a schema.

## What "grounded" means here

- Every sentence that reaches the resume traces to a recorded source: shared code or documents, the user's own words, or a proposal the user confirmed item by item.
- Wording and narrative may be polished. They may not claim more than the cited sources support.
- Numbers come only from the user or from a measurement. When a number is missing, ask a guiding question; never propose a value.

## Boundaries

- One project per workspace.
- Record sources before claims, claims before stories, stories before bullet options, and a target role or job description before final selection.
- Never infer ownership from repository presence, file location, contributor count, or complexity.
- Never turn starter code, dependency capabilities, generated code, team work, plans, or tests into stronger personal outcomes.
- Never invent numbers, scale, causality, production wording, or results.
- Never record a proposal as a fact without the user's item-by-item confirmation.
- Preserve missing facts as focused questions. Do not manufacture extra stories or duplicate bullets to meet a count.

Each stage below names the reference files it depends on; read them just before performing that stage instead of all at once.

## Entry paths

### New workspace

Collect or confirm:

- the project name and context, and what the user personally did;
- how the user will provide sources: spoken account, old resume or notes, code or documents, or a mix;
- optional target role, job description, languages, and focus;
- for code-assisted work: the absolute repository path, Git identities, and command execution policy.

Interview in phases; every answer becomes a recorded source:

1. Project context: what the project is, the user's team and role, and constraints that shaped the work.
2. Personal contributions: "What did you personally do?" Capture answers verbatim.
3. Gap questions: for each contribution theme, ask about task, method, decisions, and outcomes that are still missing.
4. Number gaps: ask guiding questions only — rough magnitude, peak versus typical, compared with what, over what period. Never suggest a value.
5. Proposal round: for missing technical details, approach, or responsibility phrasing, propose bounded items one at a time and record only after explicit confirmation (see the proposal rules below).
6. Confidentiality check: mark anything the user cannot discuss publicly and keep it out of the resume.

If the user provides no target role or job description, finish the story library and bullet options but do not select final bullets.

### Proposal rules

- One item at a time; never bundle several details into one confirmation.
- Allowed: technology and approach naming, technical detail phrasing, responsibility phrasing.
- Forbidden: any number; any result, metric, or outcome; scale, causality, production or reliability framing; ownership stronger than the user's account.
- Prefer open questions for responsibility wording so the user speaks first.
- Record each confirmation as `user-approved-proposal` evidence with both the proposal text and the confirmation text; never reuse one confirmation for another item.
- Record rejected proposals as open questions when they matter.

### Code-assisted sources (optional)

When the user provides a repository or code snippets, treat them as additional sources and inspect them directly. The deterministic collectors stay available for read-only inventory and Git history; run them only when the user wants that analysis. Requirement documents and commit messages are never required inputs; commits only help locate changes.

```text
node <skill-dir>/scripts/collect_evidence.mjs inventory --repo <repo> --out <workspace>/.verified-resume/raw/inventory.json
node <skill-dir>/scripts/collect_evidence.mjs git --repo <repo> --identity <identity.json> --out <workspace>/.verified-resume/raw/git-evidence.json
```

### Retarget an existing workspace

Open `<workspace>/.verified-resume/records.jsonl`, validate the star stage, read the new target role or job description, replace candidate/group/selection/overview records only, validate the resume stage, and rerender all four Markdown files. Do not rewrite established sources.

## Stage 1: record sources

Resolve this skill directory from the loaded `SKILL.md` path. Store raw collection files, when code is available, under `<workspace>/.verified-resume/raw/`.

Record each verbatim answer as `user-statement` evidence, focused-question answers as `user-confirmation`, materials as `user-material`, and confirmed proposals as `user-approved-proposal`. After adding or changing evidence records, fill their digests deterministically:

```text
node <skill-dir>/scripts/workspace.mjs seal --records <workspace>/.verified-resume/records.jsonl
```

Before any project command beyond read-only Git inspection, read [test-benchmark-policy.md](references/test-benchmark-policy.md), show the exact command and working directory, explain duration, network use, and writes, and obtain command-specific approval.

Use a platform-provided read-only GitHub integration only when authorized and only when a repository exists; read [github-evidence.md](references/github-evidence.md) in that case. Record unavailable sources explicitly.

## Stage 2: claims, numbers, and contributions

Read [evidence-policy.md](references/evidence-policy.md) and [attribution-guide.md](references/attribution-guide.md) before creating claims, and [workspace-format.md](references/workspace-format.md) before editing the records file.

- `verified` claims cite at least one non-testimony source.
- `user-confirmed` claims cite the user's collected words.
- `user-approved` claims cite a proposal record and introduce no number the user did not provide.
- Numbers live in metrics: `verified-measured`, `verified-count`, or `user-provided`. A user-provided number is allowed with a note about where it came from.
- Keep `inferred`, `unknown`, and `contradicted` claims out of the resume.

## Stage 3: story library (stories.md)

Cluster work by defensible contribution or engineering decision. Create one complete story per independent contribution theme; combine changes only when they address the same problem through a coherent method and result, split independent problems even when they share a subsystem, and do not impose a maximum.

For every story:

- write grounded Situation context without invented business stakes;
- state the user's bounded Task, constraints, and success condition;
- record normally two to five sourced Action steps covering implementation, decisions, trade-offs, and validation;
- record grounded Results plus explicit result limits;
- attach contribution, claim, evidence, metric, and open-question IDs;
- include interview questions and risk flags;
- leave empty decision or trade-off fields as review warnings rather than inventing content.

Run a coverage pass: every admissible user contribution must appear in at least one story or carry a specific `star_omission_reason`. When a story lacks responsibility, method, or outcome, ask focused questions or propose bounded details for confirmation before omitting it.

Validate and render the star stage:

```text
node <skill-dir>/scripts/workspace.mjs validate --records <workspace>/.verified-resume/records.jsonl --stage star
node <skill-dir>/scripts/workspace.mjs render --records <workspace>/.verified-resume/records.jsonl --workspace <workspace> --stage star
```

## Stage 4: bullet options (bullet-options.md)

Read [bullet-writing-policy.md](references/bullet-writing-policy.md) and [check-policy.md](references/check-policy.md) before drafting candidates.

Create at least one `candidate-group` for every resume-eligible story. A group represents one semantic bullet and contains one candidate per requested language.

For each candidate:

- cite at least one story;
- cite only claims, evidence, and metrics already contained by that story;
- split text into sourced action, method, and result clauses;
- use `action-method-result` when a result is supported and `action-method-capability` otherwise;
- record interview follow-ups and risk flags.

Do not cap the pool. Keep distinct supported engineering angles, but merge genuine duplicates. Every candidate must pass the deterministic checks.

## Stage 5: select and prepare (resume.md, review.md)

Read the target role or job description before adding the single `selection` record. Rank candidate groups by:

1. target-role relevance;
2. source strength;
3. technical distinctness;
4. duplication penalty.

Select three groups by default, never more than four, and allow one when only one distinct supported story exists. Record an omission reason for every unselected group. Tailoring may reorder, select, shorten, and choose supported terminology; it must not change facts, ownership, causality, scale, or result strength.

Add one `overview` record per selected language: a one-to-two-sentence resume project introduction stating what the project is, its grounded capabilities or stack, and, when supported, the user's confirmed role. Cite sources like any other text; overview variants across languages must cite identical source IDs. Do not include numbers, scale, or production wording beyond the cited sources, and do not restate the selected bullets.

Write `interview_qa` for every selected candidate and every overview: the likely follow-up question and a suggested answer. The review file also lists every number the user provided and how each selected bullet is grounded.

Validate and render the complete workflow:

```text
node <skill-dir>/scripts/workspace.mjs validate --records <workspace>/.verified-resume/records.jsonl --stage resume
node <skill-dir>/scripts/workspace.mjs render --records <workspace>/.verified-resume/records.jsonl --workspace <workspace> --stage resume
```

Do not report completion unless validation exits zero.

## Required delivery

Return these user-facing paths:

- `<workspace>/stories.md` — the complete detailed story library;
- `<workspace>/bullet-options.md` — all checked bullet options;
- `<workspace>/resume.md` — a short project overview plus one to four target-selected bullets per selected language;
- `<workspace>/review.md` — workflow acceptance, gaps, warnings, interview prep, questions, and exclusions.

Explain that `.verified-resume/records.jsonl` is private machine state and does not require user maintenance, and advise keeping the workspace — or at least `.verified-resume/` — out of shared version control because it stores local paths and identity details. Grounded means every final bullet traces through its story to recorded sources — and every packaged phrase is one the user confirmed or can defend.
