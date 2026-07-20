# Verified Project Resume

`verified-project-resume` is a local-first Codex plugin containing two deliberately separate Agent Skills:

- `$repository-to-star`: inspect one real repository and produce an evidence-linked STAR project archive;
- `$star-to-resume`: compress only a validated archive into guarded resume candidates.

- Version: `0.1.0`
- License: MIT
- Runtime: Python 3.10+ standard library and Git

## Why the boundary matters

Stage one determines what the project does, what the user actually changed, and what remains unknown. Stage two is not allowed to revisit or complete those facts. A supplied component, a dependency call, a teammate's module, a future target, or a remembered number therefore cannot silently become a personal achievement.

The canonical handoff is `star-project.json` with `schema_version: "1.0.0"`. Human-readable Markdown is always rendered from validated JSON.

## Repository layout

```text
.codex-plugin/plugin.json
skills/
  repository-to-star/
    SKILL.md
    agents/openai.yaml
    assets/
    references/
    scripts/repo_evidence.py
  star-to-resume/
    SKILL.md
    agents/openai.yaml
    assets/
    references/
    scripts/resume_guard.py
tests/
examples/synthetic-demo/
```

Both skills disable implicit invocation. They are intended to be called explicitly because repository auditing can be expensive and because an ordinary resume-writing request must not bypass the evidence stage.

## Example calls

Stage one:

```text
Use $repository-to-star on /absolute/path/to/my-project.
My Git identities are Name <name@example.com> and Name <school@example.edu>.
The course starter is tag starter-v1. Write the archive to /absolute/path/to/output.
Do not run tests or benchmarks unless I explicitly approve the exact command.
```

Stage two:

```text
Use $star-to-resume with /absolute/path/to/output/star-project.json.
Target role: C++ systems engineer. Language: both. Generate 3 semantic bullet groups.
```

## Safety behavior

- Local inventory and Git inspection are read-only and do not execute project code.
- GitHub evidence is optional; unavailable collection is not interpreted as absence.
- Tests and benchmarks require separate approval after the exact command, working directory, and expected writes are shown.
- User confirmation may support a narrow qualitative responsibility. It cannot make a remembered number resume-eligible.
- Evidence declares a digest basis; validators recompute file bytes, canonical records, or exact user-confirmation text instead of accepting a SHA-shaped string.
- Only `verified-measured` and `verified-count` metrics may enter candidate text.
- The resume guard rejects unsupported numbers, ownership verbs, dependency escalation, performance comparisons, production/reliability/scale/causal language, archive hash changes, and bilingual source drift.
- Failed candidates remain draft-only and receive a sibling `resume-candidates.guard-report.json`.

## Local validation

From this directory:

```text
python3 -m unittest discover -s tests -v
python3 skills/repository-to-star/scripts/repo_evidence.py validate --archive examples/synthetic-demo/star-project.json
python3 skills/star-to-resume/scripts/resume_guard.py validate-output --archive examples/synthetic-demo/star-project.json --candidates examples/synthetic-demo/resume-candidates.json
```

The test suite creates temporary Git repositories and runs entirely offline. It does not install packages or run code from an external project.

## Portability

The two directories under `skills/` are self-contained standard Agent Skills. They can be copied independently to a client-supported Skills directory. The deterministic scripts require `python3` and, for local history collection, `git`. Optional GitHub collection depends on the host client's read-only GitHub tools; absence of those tools is a supported degraded mode.

This repository is source-only: it does not install the plugin, modify a personal marketplace, bind an MCP server, or write to a user-level Skills directory.

## Demonstration

[`examples/synthetic-demo/star-project.md`](examples/synthetic-demo/star-project.md) and [`examples/synthetic-demo/resume-candidates.md`](examples/synthetic-demo/resume-candidates.md) show the complete handoff. The fixture deliberately contains starter functionality, a dependency integration, a teammate-owned module, an unverified README target, a verified benchmark, a test count, and a qualitative user confirmation so the exclusions are visible.

The demo is synthetic and is not evidence about a real person or production system.
