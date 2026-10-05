# Setup

The portable core is the single self-contained `skills/verified-project-resume/` directory.

A compatible platform must load `SKILL.md`, read and write approved local workspace files, and run Node.js 20+ commands. Git is needed only when the user wants local history analysis; narrated work needs no Git, no network, and no repository.

Install the complete directory. Its `agents/openai.yaml` is optional UI metadata and disables implicit invocation for platforms that honor the setting. Keep invocation explicit: the workflow may be long, and resume writing must stay grounded in recorded sources.

The user interface is a workspace directory containing Markdown. `.verified-resume/records.jsonl` is private machine state used by the same installed skill; platforms should preserve it when a user retargets an existing workspace but need not expose it for manual editing.

GitHub evidence is an optional read-only enhancement, used only when a repository is in scope. When a platform lacks GitHub, network, tests, benchmarks, or even `.git`, record that source as unavailable or not requested rather than interpreting it as absent.
