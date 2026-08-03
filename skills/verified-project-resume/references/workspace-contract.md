# Private workspace contract

## User-facing boundary

Treat the workspace directory as the interface. Users read `star.md`, `resume-candidate-pool.md`, `resume.md`, and `review.md`. Keep machine files under `.verified-resume/`; never require a user to edit JSONL or choose a schema version.

Advise users to keep the workspace — or at least `.verified-resume/` — out of shared version control: the ledger records local absolute paths and identity details.

## JSONL record envelope

Write one JSON object per line:

```json
{"record_type":"claim","id":"claim-parser","data":{},"refs":{"evidence_ids":[]}}
```

Require only four envelope keys:

- `record_type`: semantic kind;
- `id`: workspace-unique stable identifier;
- `data`: kind-specific content;
- `refs`: named arrays of referenced record IDs.

Use the scripts to read, validate, and render the ledger. Do not hand-author Markdown independently of the ledger.

## Stable semantic records

Use these core kinds:

- `project`, `analysis`, `identity`;
- `evidence`, `claim`, `contribution`, `metric`;
- `story`, `candidate`, `candidate-group`, `selection`, `overview`;
- `open-question`, `interview-topic`, `execution`;
- `legacy-star-item` only for preserved imports.

Keep safety-critical meanings stable: evidence availability/digests, claim status/scope/ownership/action kind, metric status, eligibility, and source references. Store narrative structure in extensible arrays under `data`.

## Record examples

Use these shapes as starting points. Add optional `data` fields when useful; do not remove the safety-critical fields shown here.

```json
{"record_type":"evidence","id":"ev-parser-diff","data":{"type":"diff","availability":"collected","title":"Parser diff","locator":{"path":"src/parser.cpp"},"digest_basis":"canonical-record","sha256":"<recomputed lowercase SHA-256>","excerpt":"Bounded parser change.","collected_at":"2026-07-20T00:00:00Z"},"refs":{}}
{"record_type":"claim","id":"claim-parser","data":{"text":"The user implemented bounded token parsing.","scope":"user-partial","status":"verified","ownership_level":"shared","action_kind":"implemented","tags":[],"confidence":"high","confidence_reason":"The cited diff supports the bounded change.","resume_eligible":true},"refs":{"evidence_ids":["ev-parser-diff"]}}
{"record_type":"contribution","id":"contribution-parser","data":{"summary":"Bounded parser implementation","paths":["src/parser.cpp"],"symbols":["Parser::parse"],"commit_ids":["<sha>"],"star_omission_reason":null},"refs":{"claim_ids":["claim-parser","claim-parser-test"],"evidence_ids":["ev-parser-diff","ev-test"],"metric_ids":[]}}
{"record_type":"metric","id":"metric-parser-latency","data":{"name":"fixed-fixture latency","kind":"performance","status":"verified-measured","value":10,"unit":"ms","baseline":20,"result":10,"measurement_method":"Recorded fixed-fixture benchmark.","resume_eligible":true},"refs":{"evidence_ids":["ev-benchmark"]}}
```

Represent every STAR sentence or bullet clause as sourced text:

```json
{"text":"Implemented bounded token parsing in the assigned module.","claim_ids":["claim-parser"],"evidence_ids":["ev-parser-diff"],"metric_ids":[]}
```

A complete story uses sourced arrays and aggregate refs:

```json
{"record_type":"story","id":"story-parser","data":{"title":"Bounded parser implementation","situation":[{"text":"The verified parser path required bounded input handling.","claim_ids":["claim-project"],"evidence_ids":["ev-design"],"metric_ids":[]}],"task":[{"text":"The user was responsible for the scoped parser change.","claim_ids":["claim-parser"],"evidence_ids":["ev-parser-diff"],"metric_ids":[]}],"actions":[{"text":"Implemented bounded token parsing.","claim_ids":["claim-parser"],"evidence_ids":["ev-parser-diff"],"metric_ids":[]},{"text":"Validated malformed-input behavior.","claim_ids":["claim-parser-test"],"evidence_ids":["ev-test"],"metric_ids":[]}],"results":[{"text":"Passed the cited parser boundary tests.","claim_ids":["claim-parser-test"],"evidence_ids":["ev-test"],"metric_ids":[]}],"constraints":["Starter functionality is not personal work."],"decisions":["Kept parsing changes within the assigned module."],"tradeoffs":["Preferred bounded validation over broader parser redesign."],"result_limits":["The tests do not prove production reliability."],"interview_questions":["Which malformed inputs were covered?"],"risk_flags":[],"resume_eligible":true,"legacy_review_required":false},"refs":{"contribution_ids":["contribution-parser"],"claim_ids":["claim-project","claim-parser","claim-parser-test"],"evidence_ids":["ev-design","ev-parser-diff","ev-test"],"metric_ids":[],"open_question_ids":[]}}
```

Candidate records cite a story and repeat only its allowed source subset. Candidate groups bind language variants; one selection chooses final groups after reading the role.

```json
{"record_type":"candidate","id":"candidate-parser-en","data":{"language":"en","text":"Implemented bounded token parsing and validated malformed-input behavior.","compression_method":"action-method-verified-capability","clauses":{"action":{"text":"Implemented bounded token parsing","claim_ids":["claim-parser"],"evidence_ids":["ev-parser-diff"],"metric_ids":[]},"method":{"text":"Kept the change within the assigned module","claim_ids":["claim-parser"],"evidence_ids":["ev-parser-diff"],"metric_ids":[]},"result":{"text":"Validated malformed-input behavior","claim_ids":["claim-parser-test"],"evidence_ids":["ev-test"],"metric_ids":[]}},"interview_questions":["Which cases were validated?"],"risk_flags":[]},"refs":{"story_ids":["story-parser"],"claim_ids":["claim-parser","claim-parser-test"],"evidence_ids":["ev-parser-diff","ev-test"],"metric_ids":[]}}
{"record_type":"candidate-group","id":"group-parser","data":{"title":"Parser boundary handling","selection_omission_reason":null},"refs":{"story_ids":["story-parser"],"candidate_ids":["candidate-parser-en"]}}
{"record_type":"selection","id":"selection:current","data":{"target_role":"C++ systems engineer","job_description":"","focus":"correctness","languages":["en"]},"refs":{"selected_group_ids":["group-parser"]}}
```

The resume stage also requires one `overview` record per selected language: a one-to-two-sentence resume project introduction. It is sourced text under `data`, its refs mirror the cited IDs, and it passes the same deterministic guard; verified project/team/starter-scope claims may be cited as context, and variants across languages must cite identical source ID sets.

```json
{"record_type":"overview","id":"overview:en","data":{"language":"en","text":"A course index project where the user implemented bounded token parsing and validated parser boundaries.","claim_ids":["claim-project","claim-parser"],"evidence_ids":["ev-starter","ev-parser-diff"],"metric_ids":[]},"refs":{"claim_ids":["claim-project","claim-parser"],"evidence_ids":["ev-starter","ev-parser-diff"],"metric_ids":[]}}
```

After writing evidence records, run `workspace.mjs seal --ledger <ledger>` to fill canonical-record, user-confirmation-text, and file-bytes digests deterministically. Prefer an already collected raw artifact and `file-bytes` when practical.

## Extensibility and compatibility

Do not add a global schema version. Add optional `data` fields or new record kinds for ordinary evolution. Readers must ignore unknown optional fields and record kinds while continuing to enforce known safety semantics.

When a future internal change is genuinely incompatible, update the single skill's reader and writer together and normalize older records in memory or through an automatic migration. Never make users coordinate independently installed producer and consumer versions.

The legacy importer recognizes the retired `schema_version: "1.0.0"` archive only as an input format. It is not the new workspace protocol.

## Required source chain

Maintain this chain:

```text
evidence → claim/metric → contribution → story → candidate-group → selection
evidence → claim → overview (one per selected language)
```

Candidate claim/evidence/metric IDs must be a subset of the cited story's IDs. A final selection may contain only guarded candidate groups. Missing links are hard validation failures.
