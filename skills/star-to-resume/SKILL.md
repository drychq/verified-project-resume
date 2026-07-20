---
name: star-to-resume
description: Compress a validated schema_version 1.0.0 star-project.json dossier into a one-line technical project summary and two to four evidence-linked resume bullets in Chinese, English, or both. Use only after repository-to-star has produced a verified archive. Preserve facts, ownership, and metric status while tailoring emphasis to a target role. Reject raw descriptions, ordinary resumes, free-text STAR stories, unsupported numbers, and unverified claims.
---

# STAR to Resume

Treat `star-project.json` as the only fact source. Produce concise candidates without adding facts that make the project sound larger, more successful, or more personally owned.

## Input gate

Accept only a JSON archive with `schema_version: "1.0.0"`. Reject free text, an existing resume, a repository path, or an older schema and direct the user to `$repository-to-star`.

Resolve this skill directory from the loaded `SKILL.md` path and run:

```text
python3 <skill-dir>/scripts/resume_guard.py validate-input --archive <star-project.json>
```

Stop if validation fails. Read [compression-policy.md](references/compression-policy.md) and [guard-policy.md](references/guard-policy.md) before drafting.

## Collect presentation choices

Use these defaults unless the user overrides them:

- target role: general technical role;
- language: current conversation language (`zh-CN` or `en`), with `both` supported;
- semantic bullet groups: 3, allowed range 2-4;
- focus: choose the best-supported technical evidence, not the most fashionable technology.

Changing the target role may reorder or omit facts. It must not change facts, ownership, causality, scale, or result strength.

## Admit facts

- Allow qualitative claims with status `verified` or `user-confirmed` and `resume_eligible: true`.
- Allow numbers only from metrics marked `verified-measured` or `verified-count` and `resume_eligible: true`, or exact numeric text already present in an admissible claim.
- Exclude `inferred`, `unknown`, `contradicted`, planned, target, theoretical, documented-unverified, and user-confirmed metrics.
- Action clauses require at least one admissible `user-sole` or `user-partial` claim.
- Project or team claims may supply context or a result only when they do not imply personal ownership.

Record excluded claims and reasons in the output.

## Draft structured candidates

Use [resume-candidates.schema.json](assets/resume-candidates.schema.json) and begin from [resume-candidates.template.json](assets/resume-candidates.template.json).

For each semantic bullet group, create:

- one candidate for the requested language, or paired `zh-CN` and `en` candidates for `both`;
- `action`, `method`, and `result` clauses, each with claim/evidence/metric IDs;
- `action-method-result` when a verified result exists;
- `action-method-verified-capability` when no admissible measurement exists;
- interview follow-ups and risk flags;
- a `submittable` flag that remains false until the deterministic guard passes.

Generate one project summary per requested language with its own source references. The summary may describe verified project-level capability, but it must not assign that capability to the user.

For bilingual output, paired candidates must have the same `semantic_group_id`, compression method, claim IDs, evidence IDs, and metric IDs.

Read [language-guide.md](references/language-guide.md) for concise Chinese and English patterns. Do not translate strong verbs literally when the evidence supports only integration or partial contribution.

## Validate before delivery

Write the draft JSON, then run:

```text
python3 <skill-dir>/scripts/resume_guard.py validate-output --archive <star-project.json> --candidates <resume-candidates.json>
```

The guard checks references, claim admission, ownership, metric literals, approximation language, dependency escalation, strong verbs, performance comparisons, production/reliability language, bilingual parity, and the source archive SHA-256.

If the guard fails:

- keep the draft;
- set `guard.status` to `fail` and `submittable` to false;
- report every error;
- revise only by weakening or removing unsupported language, never by inventing evidence.

When the guard passes, set `guard.status` to `pass`, set eligible candidates to `submittable: true`, validate again, and render:

```text
python3 <skill-dir>/scripts/resume_guard.py render --archive <star-project.json> --candidates <resume-candidates.json> --out <resume-candidates.md>
```

## Required delivery

Return:

- one-line project summary;
- 2-4 semantic bullet groups;
- compression method per bullet;
- STAR claim and evidence sources;
- interview follow-ups;
- risk flags and excluded claims;
- candidate JSON/Markdown paths and source archive hash.

Never claim the resume is safe merely because it sounds plausible. Safety means the guard passes and every clause remains defensible from the referenced archive.

See [methodology-sources.md](references/methodology-sources.md) for conceptual provenance.
