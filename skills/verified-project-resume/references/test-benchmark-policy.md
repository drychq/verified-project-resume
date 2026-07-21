# Test and benchmark evidence policy

## Contents

- Execution approval
- Test evidence
- Benchmark evidence
- Metric classes
- Result wording

## Execution approval

Repository commands are opt-in. Before execution, show the exact command, working directory, expected duration, likely caches/build artifacts, and whether network access is needed. Approval is command-specific.

Never run installation, migration, deployment, destructive cleanup, fuzzing, load tests, or external-service tests under a generic “run tests” approval.

## Test evidence

Capture:

- exact command and working directory;
- relevant tool/runtime versions when available;
- exit code;
- named test/suite and assertions when observable;
- stdout/stderr artifact paths;
- repository revision;
- timestamp.

A passing test supports only the tested contract. It does not prove absence of defects, production reliability, security, scalability, or real-user success.

## Benchmark evidence

A performance comparison is `verified-measured` only when evidence contains:

- baseline and result;
- unit and metric definition;
- workload/input size;
- command or harness;
- relevant environment;
- raw result artifact;
- clear association with the user's change.

If any required part is missing, classify as `documented-unverified`, `theoretical`, `target`, `planned`, or `unknown` as appropriate.

## Metric classes

| Class | Meaning | Resume allowed |
|---|---|---|
| `verified-measured` | Reproducible measurement or authoritative raw run | Yes |
| `verified-count` | Deterministic count recomputed from artifacts | Yes |
| `documented-unverified` | Number stated in prose without sufficient measurement evidence | No |
| `user-confirmed` | User remembers or estimates the number | No |
| `theoretical` | Expected or analytical benefit | No |
| `target` | Requirement, SLA, or designed-for capacity | No |
| `planned` | Future work | No |
| `unknown` | Insufficient context | No |

## Result wording

Without an admissible metric, prefer verified outcomes such as:

- passed named tests;
- satisfied a documented invariant;
- implemented a bounded capability;
- eliminated a reproduced defect;
- added a verified engineering safeguard.

Do not add “production-grade,” “high availability,” “zero downtime,” “at scale,” or similar language unless directly supported by admissible claims.
