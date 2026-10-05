# Contribution attribution guide

## When code is shared

Identity matching:

- Match Git authors against all user-confirmed names and emails. Keep author and committer separate. Parse `Co-authored-by` trailers but do not infer the split of work between coauthors.
- If identity is incomplete or no commit matches, do not infer sole ownership from repository ownership, remote URL, local filesystem owner, or contributor counts.

Diff-based attribution:

- Use commits only to locate candidate work. Inspect changed paths and relevant hunks before creating a claim. Then inspect surrounding code to understand the bounded change.
- Prefer narrow statements: "added timeout handling in `Client::send`" over "built the networking layer".
- Merge commits, formatting-only commits, generated changes, vendored updates, and bulk renames require special caution.

Starter and upstream code:

- When a starter/upstream ref is available: identify baseline behavior, compare it with the analyzed state, assign unchanged behavior to `starter` or `project`, and analyze only the user-attributable delta.
- When the baseline is unavailable, record an open question. Imported histories and repository recreation are common.

Team and Git edge cases:

- Squash merge: link the PR and changed files; commit author alone may not represent all contributors.
- Pair programming: use user confirmation or PR/review sources for the collaboration, not line ownership estimates.
- Shared account: attribution is `unknown` until the user supplies corroboration.
- Rebase/cherry-pick: duplicate patches do not prove duplicate work.
- Review-only contribution: classify as `reviewed`, not implemented.
- Issue author/assignee: proves planning or assignment, not code completion.
- PR author: strong orientation evidence, but inspect the diff and merge/check status.

Dependencies and generated code:

- Dependency manifests, imports, API calls, framework annotations, build flags, generated headers, protobuf output, minified bundles, and vendor trees must not become implementation claims for the underlying component.
- Use `integrated`, `configured`, or `called` unless diffs directly show original implementation. Preserve project-level capability separately from user action.

## When there is no code (narrated attribution)

- Identity and ownership come from the user's account: what they say they did, bounded by focused questions.
- Old resumes and notes are material, not proof. They prove the user previously wrote something, not that it is true.
- A confirmed proposal never creates ownership by itself; ownership wording must stay within what the user stated or confirmed item by item.
- Team splits come from the user's statements (for example, "a teammate covered the integration layer"), recorded verbatim.
- When the account is ambiguous about who did what, ask a focused question instead of assuming.
