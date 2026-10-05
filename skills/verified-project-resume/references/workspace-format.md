# Private workspace format

## User-facing boundary

Treat the workspace directory as the interface. Users read `stories.md`, `bullet-options.md`, `resume.md`, and `review.md`. Keep machine files under `.verified-resume/`; never require a user to edit JSONL or choose a schema version.

Advise users to keep the workspace — or at least `.verified-resume/` — out of shared version control: the records file stores local absolute paths and identity details.

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

Use the scripts to read, validate, and render the records file. Do not hand-author Markdown independently of the records.

## Record kinds

- `project`, `analysis`, `identity`;
- `evidence`, `claim`, `contribution`, `metric`;
- `story`, `candidate`, `candidate-group`, `selection`, `overview`;
- `open-question`, `interview-topic`, `execution`.

Keep safety-critical meanings stable: evidence availability/digests, claim status/scope/ownership/action kind, metric status, eligibility, and source references. Store narrative structure in extensible arrays under `data`. There is no format version; the scripts read and write the current shape together.

## Record examples

Use these shapes as starting points. Add optional `data` fields when useful; do not remove the safety-critical fields shown here.

```json
{"record_type":"evidence","id":"ev-statement","data":{"type":"user-statement","availability":"collected","title":"user statement: role","locator":{},"digest_basis":"user-confirmation-text","sha256":"<recomputed lowercase SHA-256>","excerpt":"I owned the parser module.","collected_at":"2026-07-20T00:00:00Z"},"refs":{}}
{"record_type":"evidence","id":"ev-proposal","data":{"type":"user-approved-proposal","availability":"collected","title":"confirmed proposal: parser","locator":{},"digest_basis":"proposal-confirmation-text","sha256":"<recomputed lowercase SHA-256>","proposal_excerpt":"The parser uses ANTLR for expression parsing.","confirmation_excerpt":"Yes, ANTLR is right.","collected_at":"2026-07-20T00:00:00Z"},"refs":{}}
{"record_type":"claim","id":"claim-parser","data":{"text":"The user owned the parser module and worked with the integration teammate.","scope":"user-partial","status":"user-confirmed","ownership_level":"shared","action_kind":"implemented","tags":[],"confidence":"medium","confidence_reason":"The cited statement supports the bounded role.","resume_eligible":true},"refs":{"evidence_ids":["ev-statement"]}}
{"record_type":"claim","id":"claim-parser-impl","data":{"text":"The parser uses ANTLR for expression parsing.","scope":"user-partial","status":"user-approved","ownership_level":"shared","action_kind":"implemented","tags":[],"confidence":"medium","confidence_reason":"The proposal was confirmed item by item.","resume_eligible":true},"refs":{"evidence_ids":["ev-proposal"]}}
{"record_type":"metric","id":"metric-peak","data":{"name":"peak request rate","kind":"performance","status":"user-provided","value":2000,"unit":"QPS","baseline":null,"result":null,"measurement_method":null,"source_note":"recalled peak magnitude","review_flags":["user-provided-number"],"resume_eligible":true},"refs":{"evidence_ids":["ev-statement"]}}
```

Represent every STAR sentence or bullet clause as sourced text:

```json
{"text":"Implemented expression parsing with ANTLR.","claim_ids":["claim-parser-impl"],"evidence_ids":["ev-proposal"],"metric_ids":[]}
```

A complete story uses sourced arrays and aggregate refs:

```json
{"record_type":"story","id":"story-parser","data":{"title":"Parser module","situation":[{"text":"The service needed configurable rule parsing.","claim_ids":["claim-parser"],"evidence_ids":["ev-statement"],"metric_ids":[]}],"task":[{"text":"The user owned the parser module.","claim_ids":["claim-parser"],"evidence_ids":["ev-statement"],"metric_ids":[]}],"actions":[{"text":"Implemented expression parsing with ANTLR.","claim_ids":["claim-parser-impl"],"evidence_ids":["ev-proposal"],"metric_ids":[]}],"results":[{"text":"Established the parser capability within the cited scope.","claim_ids":["claim-parser-impl"],"evidence_ids":["ev-proposal"],"metric_ids":[]}],"constraints":["Scope is limited to the cited module."],"decisions":["ANTLR was chosen for expression parsing (confirmed)."],"tradeoffs":["Preferred a bounded parser over a broader rewrite."],"result_limits":["No measured performance comparison was recorded."],"interview_questions":["Which parser cases were covered?"],"risk_flags":[],"resume_eligible":true},"refs":{"contribution_ids":["contribution-parser"],"claim_ids":["claim-parser","claim-parser-impl"],"evidence_ids":["ev-statement","ev-proposal"],"metric_ids":[],"open_question_ids":[]}}
```

Candidate records cite a story and repeat only its allowed source subset. Candidate groups bind language variants; one selection chooses final groups after reading the role. Selected candidates and overviews carry `interview_qa` entries with `question` and `answer` text.

```json
{"record_type":"candidate","id":"candidate-parser-en","data":{"language":"en","text":"Implemented expression parsing with ANTLR within the parser module.","compression_method":"action-method-capability","clauses":{"action":{"text":"Implemented expression parsing with ANTLR","claim_ids":["claim-parser-impl"],"evidence_ids":["ev-proposal"],"metric_ids":[]},"method":{"text":"Kept the change within the parser module","claim_ids":["claim-parser-impl"],"evidence_ids":["ev-proposal"],"metric_ids":[]},"result":{"text":"Established the parser capability","claim_ids":["claim-parser-impl"],"evidence_ids":["ev-proposal"],"metric_ids":[]}},"interview_questions":["Which parser cases were covered?"],"interview_qa":[{"question":"Was the ANTLR choice yours?","answer":"I proposed it and confirmed the wording item by item."}],"risk_flags":[]},"refs":{"story_ids":["story-parser"],"claim_ids":["claim-parser-impl"],"evidence_ids":["ev-proposal"],"metric_ids":[]}}
{"record_type":"candidate-group","id":"group-parser","data":{"title":"Parser module","selection_omission_reason":null},"refs":{"story_ids":["story-parser"],"candidate_ids":["candidate-parser-en"]}}
{"record_type":"selection","id":"selection:current","data":{"target_role":"backend engineer","job_description":"","focus":"parsing","languages":["en"]},"refs":{"selected_group_ids":["group-parser"]}}
```

The resume stage also requires one `overview` record per selected language: a one-to-two-sentence resume project introduction. It is sourced text under `data`, its refs mirror the cited IDs, and it passes the same deterministic checks; project/team/starter-scope claims may be cited as context, and variants across languages must cite identical source ID sets.

After writing evidence records, run `workspace.mjs seal --records <records.jsonl>` to fill user-confirmation-text, proposal-confirmation-text, canonical-record, and file-bytes digests deterministically.

## Required source chain

Maintain this chain:

```text
evidence → claim/metric → contribution → story → candidate-group → selection
evidence → claim → overview (one per selected language)
```

Candidate claim/evidence/metric IDs must be a subset of the cited story's IDs. Missing links are hard validation failures.
