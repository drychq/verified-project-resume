# Verified Project Resume

[English](README.md) | [简体中文](README.zh-CN.md)

`verified-project-resume` is one portable Agent Skill that turns a person's account of their project work — narrated from memory, with or without code — into a grounded story library, a set of checked bullet options, and a concise role-specific resume entry.

The workflow stays ordered inside one installed skill:

```text
recorded sources → claims and numbers → detailed stories → bullet options → job-specific selection
```

Wording may be polished; it may not claim more than its sources support. Technical details, approach, and responsibility phrasing can be proposed by the skill and must be confirmed item by item. Numbers come only from the user or from a measurement — the skill never invents one.

- Version: `0.3.0`
- License: MIT
- Runtime: Node.js 20+ standard library; narrated work needs no network and no Git

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

The repository exposes exactly one skill under `skills/verified-project-resume/`. Copy that complete directory for manual or offline installation; do not copy only `SKILL.md`.

## Use

From a spoken account (no code required):

```text
Use $verified-project-resume to build my resume workspace at /absolute/path/to/output.
I cannot share my company's code; I will describe what I did.
Target role: backend engineer. Language: both.
```

With code available (optional):

```text
Use $verified-project-resume to analyze /absolute/path/to/my-project and write the workspace to /absolute/path/to/output.
My Git identities are Name <name@example.com>. The starter tag is starter-v1. Ask before running any test or benchmark.
Target role: C++ systems engineer. Language: both.
```

Retarget later:

```text
Use $verified-project-resume with /absolute/path/to/output and tailor it to this new job description: ...
```

## Workspace interface

Users work with a directory and four Markdown files:

- `stories.md`: every defensible contribution as a complete story with its sources;
- `bullet-options.md`: every checked bullet option, per language;
- `resume.md`: a sourced project overview plus one to four bullets per selected language, chosen after reading the target role or job description;
- `review.md`: workflow acceptance, gaps, warnings, interview prep, questions, and exclusions.

Machine state lives in `.verified-resume/records.jsonl`. It is private implementation data; keep it out of shared version control because it records local absolute paths and identity details.

## How it stays grounded

- Read-only inventory and Git collection never execute target project code.
- GitHub lookup is optional, read-only, and only when a repository exists.
- Tests and benchmarks require exact-command approval.
- Every admissible contribution must be covered by a story or explicitly omitted with a reason.
- Every bullet traces through its story to recorded sources; project overviews cite their sources like any bullet.
- Numbers come only from the user or from measurements; user-provided numbers are listed in `review.md` with their source.
- The checks reject unsupported ownership verbs, dependency escalation, and numbers that appear in no source. Wording that rests only on the user's account (performance, scale, production, causality) becomes a review warning with interview prep instead of a silent claim.
- One supported story may produce one final bullet; the workflow never duplicates content to reach a minimum count.

## Validate

Run the offline test suite and a read-only check of the bundled demos:

```bash
npm test
node skills/verified-project-resume/scripts/workspace.mjs validate --records examples/narration-demo/.verified-resume/records.jsonl --stage resume
```

`npm run demo` regenerates `examples/synthetic-demo/` and `examples/narration-demo/` deterministically after fixture or renderer changes; the `render` subcommand writes the four Markdown files into a workspace, so prefer `validate` for inspection. Both scripts answer `--help` and `--version`.

The test suite uses only Node.js built-ins, creates temporary Git repositories, and runs offline. It does not install packages or execute external project code.

See [setup](docs/setup.md) for portability requirements. The narrated [story library](examples/narration-demo/stories.md), [bullet options](examples/narration-demo/bullet-options.md), [final resume](examples/narration-demo/resume.md), and [review with interview prep](examples/narration-demo/review.md) show a confidential project described from memory; the [synthetic demo](examples/synthetic-demo/resume.md) shows the code-assisted path. Neither represents a real person or project.

## Methodology sources

The implementation is original; it borrows workflow ideas, not third-party code or example metrics:

- `hubvue/skills` `resume-project-analyzer`: confidence classification, reflective ownership questions, and interview-defensible output orientation. MIT license. <https://github.com/hubvue/skills/tree/main/project/resume-project-analyzer>
- `andrewstellman/quality-playbook`: traceability from repository artifacts to requirements, tests, and verified findings. Apache-2.0 license. <https://github.com/andrewstellman/quality-playbook>
- `hackforla/ai-skills-assessor`: contributor-aware use of Issue and PR activity with human review. GPL-2.0 repository. <https://github.com/hackforla/ai-skills-assessor>
- Agent Skills specification: portable `SKILL.md`, scripts, references, and assets layout. <https://agentskills.io/specification>

No promotional claims, example performance numbers, Staff-level framing, or automatic architecture mappings from these projects are included.
