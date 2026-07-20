# Verified Project Resume

[English](README.md) | [简体中文](README.zh-CN.md)

`verified-project-resume` is a vendor-neutral, local-first Agent Skills package. Its two deliberately separate skills form the portable core:

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
skills/
  repository-to-star/
    SKILL.md
    assets/
    references/
    scripts/repo_evidence.py
    agents/openai.yaml       # optional Codex/OpenAI metadata
  star-to-resume/
    SKILL.md
    assets/
    references/
    scripts/resume_guard.py
    agents/openai.yaml       # optional Codex/OpenAI metadata
.codex-plugin/plugin.json    # optional Codex adapter
tests/
docs/
examples/synthetic-demo/
```

The optional Codex adapter disables implicit invocation for both skills. Other hosts should configure explicit-only invocation when they support it. Repository auditing can be expensive, and an ordinary resume-writing request must not bypass the evidence stage.

The files under `.codex-plugin/` and each `agents/openai.yaml` are an optional Codex adapter. They add discovery and UI metadata only; neither skill, schema, deterministic script, nor test depends on Codex or an OpenAI SDK.

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

## Host-neutral core and optional adapters

The two directories under `skills/` are self-contained standard Agent Skills and are the canonical implementation. Copy either directory to any Agent Skills-compatible host, or point the host at this repository's `skills/` directory. Invocation syntax and installation paths are host concerns; `$repository-to-star` and `$star-to-resume` are the names used by hosts that support `$skill-name` invocation.

The core requires only local file/shell access, Python 3.10+, and Git for local history collection. It imports no host SDK, requires no MCP server, and treats optional read-only GitHub integration as an enhancement. A host without GitHub integration, network access, tests, benchmarks, or even `.git` remains a supported degraded mode and must record those sources as unavailable rather than absent.

See [Host integration](docs/host-integration.md) for the portability contract and adapter boundaries.

This repository is source-only: it does not install an adapter, modify a marketplace, bind an MCP server, or write to a user-level Skills directory.

## Demonstration

[`examples/synthetic-demo/star-project.md`](examples/synthetic-demo/star-project.md) and [`examples/synthetic-demo/resume-candidates.md`](examples/synthetic-demo/resume-candidates.md) show the complete handoff. The fixture deliberately contains starter functionality, a dependency integration, a teammate-owned module, an unverified README target, a verified benchmark, a test count, and a qualitative user confirmation so the exclusions are visible.

The demo is synthetic and is not evidence about a real person or production system.
