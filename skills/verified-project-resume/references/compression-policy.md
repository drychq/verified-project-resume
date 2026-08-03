# STAR compression policy

## Admission

Admit only qualitative claims with `verified` or `user-confirmed` status and `resume_eligible: true`. Admit numeric values only from `verified-measured` or `verified-count` metrics marked eligible, or exact numeric text already present in an admissible claim.

Action clauses require user-scoped claims. Project and team claims may provide context or results without converting them into personal ownership.

## Selection

Prioritize:

1. specific user action;
2. nontrivial method or engineering decision;
3. verified result, correctness property, test, or bounded capability;
4. relevance to the target role.

Do not prioritize a claim merely because it contains a fashionable technology or large project-level number.

## Compression forms

Use `Action → Method/Decision → Verified Result` when a result is directly supported.

Use `Action → Method/Decision → Verified Capability/Test/Correctness` when no admissible measurement exists.

Do not force XYZ when Y is absent. A truthful capability or named test result is preferable to an estimate.

The project overview is not a compressed bullet: it is one to two sentences of sourced text validated by the same deterministic guard, with no clause split and no compression method. Cite context-scope claims directly and mirror the cited IDs into its refs.

## Source mapping

Split every bullet into action, method, and result clauses. Attach claim IDs, evidence IDs, and metric IDs to each clause. The union becomes the bullet source set.

Source mapping must make it possible to answer:

- What exactly did the user do?
- Which technology or decision is supported?
- Which result is verified?
- Which interview question is likely to challenge the wording?

## Target-role tailoring

Tailoring may reorder, select, shorten, and choose terminology already supported by the archive. It must not:

- introduce a missing skill;
- change an integration into implementation;
- change contribution scope;
- strengthen causality;
- add scale, users, concurrency, revenue, reliability, or performance;
- hide a risk flag needed to interpret the claim.
