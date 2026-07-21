# GitHub evidence contract

## Contents

- Collection policy
- Normalized record
- Interpretation limits

## Collection policy

Use host-provided read-only GitHub integrations when available. Fall back to authenticated `gh` read-only commands. Never create, edit, comment, label, close, merge, or otherwise mutate remote state during dossier construction.

Collect only the repository and identity in scope. Store source URLs so a reviewer can reopen every record.

When collection is outside scope, use `not-requested` in both the availability record and execution log. Reserve `unavailable` for a requested source or tool that cannot be accessed.

## Normalized record

Save optional GitHub evidence as JSON with:

- `availability`: `collected`, `unavailable`, `not-requested`, or `failed`;
- `repository`: owner/name and URL;
- `identity`: handle used for filtering;
- `issues[]`: number, title, author, assignees, state, timestamps, URL, linked PRs;
- `pull_requests[]`: number, title, author, state, merged state, merge SHA, changed paths, commit SHAs, checks, URL;
- `reviews[]`: PR number, reviewer, state, submitted timestamp, URL;
- `checks[]`: name, conclusion, commit SHA, URL;
- `collection_errors[]`.

Convert relevant records into individual evidence ledger entries rather than citing the entire export for every claim.

## Interpretation limits

- Issue authorship proves issue authorship, not implementation.
- Assignment proves assignment, not completion.
- PR authorship is strong orientation evidence but does not prove sole authorship of every changed line.
- Review comments can support design/debugging/review contributions when the content is specific.
- A green check proves only the named check at the recorded SHA.
- An unmerged PR cannot support a claim that the project shipped the change.
- Missing search results may reflect access, pagination, renamed identities, or deleted data.
