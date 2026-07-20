# Host integration and portability contract

The canonical product is the pair of self-contained directories under `skills/`. A host may install one or both skills without understanding `.codex-plugin/` or `agents/openai.yaml`.

## Minimum host capabilities

A compatible host must be able to:

- load a standard `SKILL.md` and resolve files relative to its directory;
- read the target repository and write user-approved output files;
- run local `python3` commands and, when Git history is available, local `git` commands;
- keep test and benchmark execution behind explicit approval of the exact command, working directory, and expected writes;
- pass `star-project.json` unchanged from the first skill to the second.

Network access, a GitHub connector, MCP, a marketplace, and a vendor SDK are not required. Optional GitHub evidence collection must be read-only. Missing integrations are represented as `unavailable`, not as evidence that no Issue, PR, review, or CI record exists.

Version 1.0 of the archive names its optional remote-forge fields after GitHub because the original evidence scope is Issue/PR/review/CI collection from GitHub. That is a data-source limitation, not an AI-host dependency: local repository and Git analysis works on any compatible host, and hosts without GitHub degrade cleanly. Supporting other forges under neutral field names requires a future schema version with an explicit compatibility migration.

## Core versus adapters

| Path | Role | Required by the core |
| --- | --- | --- |
| `skills/*/SKILL.md` | Portable workflow instructions | Yes |
| `skills/*/scripts/` | Deterministic collection, validation, guard, and rendering | Yes |
| `skills/*/assets/` | JSON schemas and templates | Yes |
| `skills/*/references/` | Evidence, attribution, and language policies | Yes |
| `.codex-plugin/plugin.json` | Optional Codex packaging metadata | No |
| `skills/*/agents/openai.yaml` | Optional OpenAI/Codex discovery and invocation policy | No |

Adapter metadata may select display names, explicit-invocation behavior, and installation UX. It must not change evidence admission, ownership attribution, metric eligibility, schemas, or guard behavior.

## Generic installation

Use the host's documented Agent Skills installation mechanism and install these directories unchanged:

```text
skills/repository-to-star/
skills/star-to-resume/
```

Do not copy only `SKILL.md`: each skill relies on its sibling `scripts/`, `assets/`, and `references/`. A host may use a different invocation syntax from `$repository-to-star`; the skill name in frontmatter remains `repository-to-star`.

## Generic invocation

Ask the host to invoke the skill explicitly by its frontmatter name. The semantic requests are:

```text
Invoke the repository-to-star skill on /absolute/path/to/project and write the validated archive to /absolute/path/to/output. Do not run project tests or benchmarks without separate approval.

Invoke the star-to-resume skill with /absolute/path/to/output/star-project.json. Target role: C++ systems engineer. Language: both. Generate 3 semantic bullet groups.
```

The first skill must produce a schema-valid archive before the second starts. A host that cannot enforce explicit invocation should still require the user to name the skill and must not route free-form resume text directly into stage two.
