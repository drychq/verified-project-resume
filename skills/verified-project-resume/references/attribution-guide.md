# Contribution attribution guide

## Contents

- Identity matching
- Diff-based attribution
- Starter and upstream code
- Team and Git edge cases
- Dependencies and generated code

## Identity matching

Match Git authors against all user-confirmed names and emails. Keep author and committer separate. Parse `Co-authored-by` trailers but do not infer the split of work between coauthors.

If identity is incomplete or no commit matches, do not infer sole ownership from repository ownership, remote URL, local filesystem owner, or contributor counts.

## Diff-based attribution

Use commits only to locate candidate work. Inspect changed paths and relevant hunks before creating a claim. Then inspect surrounding code to understand the bounded change.

Prefer narrow statements:

- “added timeout handling in `Client::send`” over “built the networking layer”;
- “integrated Qt signal handling in the settings dialog” over “designed the Qt UI framework”;
- “implemented one buffer eviction policy” over “architected the database buffer manager.”

Merge commits, formatting-only commits, generated changes, vendored updates, and bulk renames require special caution.

## Starter and upstream code

When a starter/upstream ref is available:

1. identify files and behavior present at the baseline;
2. compare baseline to the analyzed state;
3. assign unchanged behavior to `starter` or `project`;
4. analyze only the user-attributable delta for Action claims.

When the baseline is unavailable, record an open question. Do not assume the first visible commit is authored from scratch; imported histories and repository recreation are common.

## Team and Git edge cases

- Squash merge: link the PR and changed files; commit author alone may not represent all contributors.
- Pair programming: use `user-confirmed` or PR/review evidence for the collaboration, not line ownership estimates.
- Shared account: attribution is `unknown` until the user supplies corroboration.
- Rebase/cherry-pick: duplicate patches do not prove duplicate work.
- Review-only contribution: classify as `reviewed`, not implemented.
- Issue author/assignee: proves planning or assignment, not code completion.
- PR author: strong orientation evidence, but inspect the diff and merge/check status.

## Dependencies and generated code

Dependency manifests, imports, API calls, framework annotations, build flags, generated headers, Qt `.ui` output, protobuf output, minified bundles, and vendor trees must not become implementation claims for the underlying component.

Use `integrated`, `configured`, or `called` unless diffs directly show original implementation. Preserve project-level capability separately from user action.
