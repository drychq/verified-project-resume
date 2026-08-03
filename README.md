# Verified Project Resume

[English](README.md) | [简体中文](README.zh-CN.md)

`verified-project-resume` is one portable Agent Skill for turning a real software repository into a complete, evidence-backed STAR story library, a guarded resume candidate pool, and a concise role-specific project entry.

The workflow stays ordered inside one installed skill:

```text
repository evidence → personal claims → detailed STAR stories → guarded candidate pool → job-specific selection
```

This prevents project capabilities, starter code, dependencies, generated code, team work, plans, and unverified metrics from becoming personal achievements. It also prevents resume writing from bypassing STAR.

- Version: `0.2.0`
- License: MIT
- Runtime: Node.js 20+ standard library; Git is needed only for local history collection

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
- `resume.md`: a sourced project overview plus one to four bullets per selected language, chosen after reading the target role or job description;
- `review.md`: workflow acceptance, evidence gaps, warnings, questions, and exclusions.

Machine state lives in `.verified-resume/ledger.jsonl`. It is private implementation data, not a user-managed cross-skill schema; keep it out of shared version control because it records local absolute paths and identity details. New narrative sections and ranking metadata can evolve without an artifact version bump. The single skill reads and writes the ledger together and tolerates unknown optional fields.

## Safety guarantees

- Read-only inventory and Git collection never execute target project code.
- GitHub lookup is optional and read-only.
- Tests and benchmarks require exact-command approval and remain separate approvals.
- Every admissible contribution must be covered by STAR or explicitly omitted with a reason.
- Every candidate must trace through STAR to admissible claims, metrics, and evidence.
- The project overview cites ledger sources like any bullet and never introduces new numbers or scale.
- Only measured or deterministic verified metrics may appear as resume numbers.
- Guards reject unsupported ownership verbs, dependency escalation, performance comparisons, production/reliability/scale/causal wording, source tampering, and bilingual source drift in bullets and overviews alike.
- One supported story may produce one final bullet; the workflow never duplicates content to reach a minimum count.

## Validate

Run the offline test suite and a read-only check of the bundled demo:

```bash
npm test
node skills/verified-project-resume/scripts/workspace.mjs validate --ledger examples/synthetic-demo/.verified-resume/ledger.jsonl --stage resume
```

`npm run demo` regenerates `examples/synthetic-demo/` deterministically after fixture or renderer changes; the `render` subcommand writes the four Markdown files into a workspace, so prefer `validate` for inspection. Both scripts answer `--help` and `--version`.

The test suite uses only Node.js built-ins, creates temporary Git repositories, and runs offline. It does not install packages or execute external project code.

See [host integration](docs/host-integration.md) for portability requirements. The synthetic [STAR library](examples/synthetic-demo/star.md), [candidate pool](examples/synthetic-demo/resume-candidate-pool.md), [final resume](examples/synthetic-demo/resume.md), and [workflow review](examples/synthetic-demo/review.md) demonstrate the complete flow and do not represent a real person or project.

## Methodology sources

The implementation is original; it borrows workflow ideas, not third-party code or example metrics:

- `hubvue/skills` `resume-project-analyzer`: confidence classification, reflective ownership questions, and interview-defensible output orientation. MIT license. <https://github.com/hubvue/skills/tree/main/project/resume-project-analyzer>
- `andrewstellman/quality-playbook`: traceability from repository artifacts to requirements, tests, and verified findings. Apache-2.0 license. <https://github.com/andrewstellman/quality-playbook>
- `hackforla/ai-skills-assessor`: contributor-aware use of Issue and PR activity with human review. GPL-2.0 repository. <https://github.com/hackforla/ai-skills-assessor>
- Agent Skills specification: portable `SKILL.md`, scripts, references, and assets layout. <https://agentskills.io/specification>

No promotional claims, example performance numbers, Staff-level framing, or automatic architecture mappings from these projects are included.
