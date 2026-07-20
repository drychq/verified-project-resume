# Course Index — Verified STAR Project Archive

- Schema: `1.0.0`
- Revision: `1234567890abcdef`
- Repository: `/synthetic-fixture/course-index`
- Collected: `2026-07-20T00:00:00Z`

## Analysis scope

- Repository kind: `course`
- Identity status: `confirmed`
- GitHub evidence: `unavailable`
- Starter ref: `starter`
- Upstream ref: `none`

## STAR

### Situation

- **s-1** [verified; resume_eligible=false] The starter supplied the core parser and lookup path, so project capability was separated from student work.
  - Claims: `c-starter`, `c-project`
  - Evidence: `ev-starter`
  - Metrics: none

### Task

- **t-1** [user-confirmed; resume_eligible=true] The user was responsible for parser boundary validation.
  - Claims: `c-confirmed-role`
  - Evidence: `ev-confirm`
  - Metrics: none

### Action

- **a-1** [verified; resume_eligible=true] Implemented bounded token parsing in the assigned module.
  - Claims: `c-parser`
  - Evidence: `ev-parser-diff`
  - Metrics: none
- **a-2** [verified; resume_eligible=true] Integrated SQLite through the existing storage wrapper and tested boundary behavior.
  - Claims: `c-integration`, `c-tests`
  - Evidence: `ev-dependency`, `ev-test`
  - Metrics: none
- **a-3** [verified; resume_eligible=true] Debugged and fixed cache invalidation without claiming the teammate-owned module architecture.
  - Claims: `c-fix`
  - Evidence: `ev-fix-diff`, `ev-test`
  - Metrics: none

### Result

- **r-1** [verified; resume_eligible=true] Measured parser fixture latency changed from 20 ms to 10 ms under the recorded method.
  - Claims: `c-parser`
  - Evidence: `ev-parser-diff`, `ev-benchmark`
  - Metrics: `m-latency`
- **r-2** [verified; resume_eligible=true] The parser and storage boundaries passed 12 deterministic tests.
  - Claims: `c-tests`
  - Evidence: `ev-test`
  - Metrics: `m-tests`
- **r-3** [verified; resume_eligible=true] The confirmed cache invalidation defect was eliminated in the tested fixture.
  - Claims: `c-fix`
  - Evidence: `ev-fix-diff`, `ev-test`
  - Metrics: none

## Contributions

- **con-parser** Bounded parser implementation and validation
  - Claims: `c-parser`, `c-confirmed-role`
  - Evidence: `ev-parser-diff`, `ev-confirm`
  - Paths: `src/parser.cpp`
  - Symbols: `Parser::parseToken`
  - Commits: `commit-user-parser`
- **con-storage** SQLite wrapper integration and correctness tests
  - Claims: `c-integration`, `c-tests`
  - Evidence: `ev-dependency`, `ev-test`
  - Paths: `src/storage.cpp`, `tests/test_index.cpp`
  - Symbols: `Storage::put`
  - Commits: `commit-user-storage`
- **con-cache-fix** Targeted cache invalidation bug fix
  - Claims: `c-fix`
  - Evidence: `ev-fix-diff`, `ev-test`
  - Paths: `src/cache.cpp`
  - Symbols: `Cache::invalidate`
  - Commits: `commit-user-fix`

## Claim ledger

### c-project

The course project provides parsing, indexed lookup, and persistent storage.

- Scope: `project`
- Status: `verified`
- Ownership: `none`
- Action kind: `none`
- Confidence: `high` — Synthetic fixture evidence explicitly supports this narrow claim.
- Resume eligible: `true`
- Evidence: `ev-starter`, `ev-dependency`

### c-starter

Parsing and lookup existed in the supplied starter.

- Scope: `starter`
- Status: `verified`
- Ownership: `none`
- Action kind: `none`
- Confidence: `high` — Synthetic fixture evidence explicitly supports this narrow claim.
- Resume eligible: `false`
- Evidence: `ev-starter`

### c-parser

The user implemented bounded token parsing in the assigned parser module.

- Scope: `user-partial`
- Status: `verified`
- Ownership: `shared`
- Action kind: `implemented`
- Confidence: `high` — Synthetic fixture evidence explicitly supports this narrow claim.
- Resume eligible: `true`
- Evidence: `ev-parser-diff`

### c-integration

The user integrated SQLite through the project storage wrapper.

- Scope: `user-partial`
- Status: `verified`
- Ownership: `contributor`
- Action kind: `integrated`
- Confidence: `high` — Synthetic fixture evidence explicitly supports this narrow claim.
- Resume eligible: `true`
- Evidence: `ev-dependency`

### c-tests

The user added and ran deterministic correctness tests for parser and storage boundaries.

- Scope: `user-partial`
- Status: `verified`
- Ownership: `contributor`
- Action kind: `tested`
- Confidence: `high` — Synthetic fixture evidence explicitly supports this narrow claim.
- Resume eligible: `true`
- Evidence: `ev-test`

### c-fix

The user debugged and fixed cache invalidation in a module originally implemented by a teammate.

- Scope: `user-partial`
- Status: `verified`
- Ownership: `contributor`
- Action kind: `debugged`
- Confidence: `high` — Synthetic fixture evidence explicitly supports this narrow claim.
- Resume eligible: `true`
- Evidence: `ev-fix-diff`, `ev-test`

### c-team-architecture

The team used a parser, index, storage, and cache architecture.

- Scope: `team`
- Status: `verified`
- Ownership: `shared`
- Action kind: `none`
- Confidence: `high` — Synthetic fixture evidence explicitly supports this narrow claim.
- Resume eligible: `true`
- Evidence: `ev-starter`, `ev-dependency`

### c-confirmed-role

The user was responsible for parser boundary validation.

- Scope: `user-partial`
- Status: `user-confirmed`
- Ownership: `contributor`
- Action kind: `tested`
- Confidence: `medium` — Synthetic fixture evidence explicitly supports this narrow claim.
- Resume eligible: `true`
- Evidence: `ev-confirm`

### c-planned

A 10x speedup was documented as a future target.

- Scope: `project`
- Status: `inferred`
- Ownership: `none`
- Action kind: `none`
- Confidence: `medium` — Synthetic fixture evidence explicitly supports this narrow claim.
- Resume eligible: `false`
- Evidence: `ev-readme`

### c-production

The project may be production reliable.

- Scope: `unknown`
- Status: `unknown`
- Ownership: `unknown`
- Action kind: `none`
- Confidence: `medium` — Synthetic fixture evidence explicitly supports this narrow claim.
- Resume eligible: `false`
- Evidence: none

## Metrics

- **m-latency** parser fixture latency: `10` ms
  - Status: `verified-measured`; resume_eligible=`true`
  - Baseline/result: `20` → `10`
  - Method: Median of the fixed synthetic input using the recorded benchmark command.
  - Evidence: `ev-benchmark`
- **m-tests** deterministic correctness tests: `12` tests
  - Status: `verified-count`; resume_eligible=`true`
  - Baseline/result: `None` → `None`
  - Method: Counted from recorded test output.
  - Evidence: `ev-test`
- **m-readme-target** README future speedup target: `10x`
  - Status: `documented-unverified`; resume_eligible=`false`
  - Baseline/result: `None` → `None`
  - Method: not recorded
  - Evidence: `ev-readme`
- **m-user-number** remembered throughput: `1000` ops/s
  - Status: `user-confirmed`; resume_eligible=`false`
  - Baseline/result: `None` → `None`
  - Method: not recorded
  - Evidence: `ev-confirm`

## Evidence ledger

- **ev-starter** `upstream` / `collected` — starter/src/core.cpp
  - Locator: `{"path": "starter/src/core.cpp"}`
  - Digest basis: `canonical-record`
  - SHA-256: `6596519276143b25a93ba0315e0af86ac5b3a0b180ff905d35da131852050f8e`
  - Excerpt: Parser and lookup existed in starter.
- **ev-parser-diff** `diff` / `collected` — src/parser.cpp
  - Locator: `{"path": "src/parser.cpp"}`
  - Digest basis: `canonical-record`
  - SHA-256: `4e6bd84d7cb10ddc42c9726a476f2079cbc33c0432a9cb79a11181b5101ae9b1`
  - Excerpt: Student added bounded token parsing.
- **ev-dependency** `dependency` / `collected` — src/storage.cpp
  - Locator: `{"path": "src/storage.cpp"}`
  - Digest basis: `canonical-record`
  - SHA-256: `bae99a98918e758fdf650c9574729c7e2414d8f1849c1b960d65c3203cf2d5a7`
  - Excerpt: Student called SQLite through a wrapper.
- **ev-test** `test` / `collected` — tests/test_index.cpp
  - Locator: `{"path": "tests/test_index.cpp"}`
  - Digest basis: `canonical-record`
  - SHA-256: `3304eeb52c0705aa5bf612560fab1b794f0af240f2e77faaefaeb8d8792b734b`
  - Excerpt: 12 deterministic tests passed.
- **ev-benchmark** `benchmark` / `collected` — benchmarks/raw.json
  - Locator: `{"path": "benchmarks/raw.json"}`
  - Digest basis: `canonical-record`
  - SHA-256: `e8afae0125807ac288c264a3b765ccae3377af21dcb412d5958d2a511aaa7322`
  - Excerpt: Baseline 20 ms; result 10 ms.
- **ev-fix-diff** `diff` / `collected` — src/cache.cpp
  - Locator: `{"path": "src/cache.cpp"}`
  - Digest basis: `canonical-record`
  - SHA-256: `fab16c695731c2bb8d87fdbf418f8d628d1ea59febecc7600869f3fa63a68442`
  - Excerpt: Student fixed an invalidation bug in teammate-owned cache code.
- **ev-confirm** `user-confirmation` / `collected` — user confirmation 1
  - Locator: `{"path": "user confirmation 1"}`
  - Digest basis: `user-confirmation-text`
  - SHA-256: `c30b5e113b688c18d57c9e48198b8513c80a1177c45719e77f346bf946bf7a3f`
  - Excerpt: I was responsible for parser boundary validation.
- **ev-readme** `file` / `collected` — README.md
  - Locator: `{"path": "README.md"}`
  - Digest basis: `canonical-record`
  - SHA-256: `d9ba57b26abd89ca92159014bf921e13bb6af6f299de79f400ddeb7b8dce4613`
  - Excerpt: A future target says 10x faster, without raw measurement.

## Open questions

- **q-1** [open] Was the parser design assigned or proposed by the user? (claims: `c-parser`)

## Interview topics

- **Parser boundary handling** — Which malformed inputs were rejected?; Why was the parser change bounded to one module?
- **Benchmark limits** — How was the fixture held constant?; Why is this not a production performance claim?

## Execution log

- **run-1** `benchmark` / `completed` / approval `approved` — `./bench_parser --fixture fixed.txt`
  - CWD: `/synthetic-fixture/course-index`; exit code: `0`; timestamp: `2026-07-20T00:00:00Z`
  - stdout: `benchmarks/raw.json`; stderr: `none`
