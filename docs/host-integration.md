# Host integration

The portable core is the single self-contained `skills/verified-project-resume/` directory.

A compatible host must load `SKILL.md`, read and write approved local workspace files, and run Node.js 20+ commands. Git is required only for local history collection. The skill imports no host SDK and requires no MCP server.

Install the complete directory. Its `agents/openai.yaml` is optional UI metadata and disables implicit invocation for hosts that honor the setting. Repository analysis should remain explicit because it may be expensive and ordinary resume writing must not bypass evidence collection.

The user interface is a workspace directory containing Markdown. `.verified-resume/ledger.jsonl` is private machine state used by the same installed skill; hosts should preserve it when a user retargets an existing workspace but need not expose it for manual editing.

GitHub evidence is an optional read-only enhancement. When a host lacks GitHub, network, tests, benchmarks, or even `.git`, record that source as unavailable or not requested rather than interpreting it as absent.
