# Verified Project Resume

[English](README.md) | [简体中文](README.zh-CN.md)

`verified-project-resume` is one portable Agent Skill for turning a real software repository into a complete, evidence-backed STAR story library, a guarded resume candidate pool, and a concise role-specific project entry.

The workflow stays ordered inside one installed skill:

```text
repository evidence → personal claims → detailed STAR stories → guarded candidate pool → job-specific selection
```

This prevents project capabilities, starter code, dependencies, generated code, team work, plans, and unverified metrics from becoming personal achievements. It also prevents resume writing from bypassing STAR.

- Version: `0.1.0`
- License: MIT
- Runtime: Node.js 20+ standard library and Git

## Install

```bash
npx skills add drychq/verified-project-resume
```

Useful variants:

```bash
npx skills add drychq/verified-project-resume --list
npx skills add drychq/verified-project-resume --skill verified-project-resume
npx skills add drychq/verified-project-resume --agent codex
npx skills add drychq/verified-project-resume --global
npx skills add .
```

The repository exposes exactly one skill under `skills/verified-project-resume/`. Copy that complete directory when using a host-native or offline installation; do not copy only `SKILL.md`.

## Use

Full workflow:

```text
Use $verified-project-resume to analyze /absolute/path/to/my-project and write the workspace to /absolute/path/to/output.
My Git identities are Name <name@example.com> and Name <school@example.edu>.
The starter tag is starter-v1. Ask before running any test or benchmark.
Target role: C++ systems engineer. Language: both.
```

Retarget verified material later:

```text
Use $verified-project-resume with /absolute/path/to/output and tailor it to this new job description: ...
```

Import an archive produced by the retired two-skill workflow:

```text
Use $verified-project-resume to import /absolute/path/to/star-project.json into /absolute/path/to/output, review the regenerated STAR stories, and then tailor them to this role: ...
```

## Workspace interface

Users work with a directory and four Markdown files:

- `star.md`: every defensible contribution as a complete, detailed STAR story;
- `resume-candidate-pool.md`: every candidate that passes the fact guard;
- `resume.md`: one to four bullets selected after reading the target role or job description;
- `review.md`: workflow acceptance, evidence gaps, warnings, questions, and exclusions.

Machine state lives in `.verified-resume/ledger.jsonl`. It is private implementation data, not a user-managed cross-skill schema. New narrative sections and ranking metadata can evolve without an artifact version bump. The single skill reads and writes the ledger together and tolerates unknown optional fields.

## Safety guarantees

- Read-only inventory and Git collection never execute target project code.
- GitHub lookup is optional and read-only.
- Tests and benchmarks require exact-command approval and remain separate approvals.
- Every admissible contribution must be covered by STAR or explicitly omitted with a reason.
- Every candidate must trace through STAR to admissible claims, metrics, and evidence.
- Only measured or deterministic verified metrics may appear as resume numbers.
- Guards reject unsupported ownership verbs, dependency escalation, performance comparisons, production/reliability/scale/causal wording, source tampering, and bilingual source drift.
- One supported story may produce one final bullet; the workflow never duplicates content to reach a minimum count.

## Validate

```text
npm test
node skills/verified-project-resume/scripts/workspace.mjs validate --ledger examples/synthetic-demo/.verified-resume/ledger.jsonl --stage resume
node skills/verified-project-resume/scripts/workspace.mjs render --ledger examples/synthetic-demo/.verified-resume/ledger.jsonl --workspace examples/synthetic-demo --stage resume
```

The test suite uses only Node.js built-ins, creates temporary Git repositories, and runs offline. It does not install packages or execute external project code.

See [host integration](docs/host-integration.md) for portability requirements. The synthetic [STAR library](examples/synthetic-demo/star.md), [candidate pool](examples/synthetic-demo/resume-candidate-pool.md), [final resume](examples/synthetic-demo/resume.md), and [workflow review](examples/synthetic-demo/review.md) demonstrate the complete flow and do not represent a real person or project.
