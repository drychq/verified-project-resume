#!/usr/bin/env python3
"""Offline repository evidence collection, STAR validation, and rendering."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Any, Iterable


SCHEMA_VERSION = "1.0.0"
CLAIM_STATUSES = {"verified", "user-confirmed", "inferred", "unknown", "contradicted"}
CLAIM_SCOPES = {
    "project", "user-sole", "user-partial", "team", "starter", "third-party", "generated", "unknown"
}
USER_SCOPES = {"user-sole", "user-partial"}
METRIC_ELIGIBLE_STATUSES = {"verified-measured", "verified-count"}
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")

DOC_NAMES = {"readme", "license", "changelog", "contributing", "authors", "design", "architecture"}
BUILD_NAMES = {
    "cmakelists.txt", "makefile", "meson.build", "build.gradle", "pom.xml", "package.json",
    "pyproject.toml", "setup.py", "cargo.toml", "go.mod", "build.zig", "justfile"
}
DEPENDENCY_NAMES = {
    "requirements.txt", "poetry.lock", "pdm.lock", "package-lock.json", "pnpm-lock.yaml",
    "yarn.lock", "cargo.lock", "go.sum", "vcpkg.json", "conanfile.txt", "conanfile.py"
}
SOURCE_EXTENSIONS = {
    ".c", ".cc", ".cpp", ".cxx", ".h", ".hh", ".hpp", ".hxx", ".m", ".mm", ".py",
    ".rs", ".go", ".java", ".kt", ".kts", ".cs", ".js", ".jsx", ".ts", ".tsx", ".vue",
    ".swift", ".scala", ".sql", ".proto", ".glsl", ".vert", ".frag", ".comp", ".qml"
}


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=False)
        handle.write("\n")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def classify_file(relative: str) -> tuple[str, str]:
    lower = relative.lower()
    path = Path(lower)
    parts = path.parts
    name = path.name
    stem = path.stem

    if any(part in {"vendor", "vendors", "third_party", "third-party", "external", "extern"} for part in parts):
        return "vendor", "path identifies bundled third-party code"
    if any(part in {"generated", "gen", "autogen"} for part in parts) or name.endswith((".generated.h", ".generated.cpp")):
        return "generated", "path or filename identifies generated code"
    if name in DEPENDENCY_NAMES or "lock" in name and name.endswith((".json", ".yaml", ".yml", ".lock")):
        return "dependency", "dependency manifest or lock file"
    if name in BUILD_NAMES or any(part in {"cmake", "build", "scripts"} for part in parts[:-1]):
        return "build", "build or automation configuration"
    if any(part in {"benchmark", "benchmarks", "bench", "benches"} for part in parts) or "benchmark" in name:
        return "benchmark", "benchmark path or filename"
    if any(part in {"test", "tests", "testing", "spec", "specs"} for part in parts) or name.startswith("test_") or name.endswith(("_test.py", "_test.cpp", ".spec.ts", ".test.js")):
        return "test", "test path or filename"
    if path.suffix in {".md", ".rst", ".adoc", ".txt"} and (stem in DOC_NAMES or any(part in {"doc", "docs"} for part in parts)):
        return "documentation", "documentation path or recognized document"
    if path.suffix in SOURCE_EXTENSIONS:
        return "source", "recognized source-code extension"
    return "other", "no deterministic category matched"


def command_inventory(args: argparse.Namespace) -> int:
    repo = Path(args.repo).expanduser().resolve()
    if not repo.is_dir():
        print(f"error: repository path is not a directory: {repo}", file=sys.stderr)
        return 2

    records: list[dict[str, Any]] = []
    skipped: list[dict[str, str]] = []
    for root, dirs, files in os.walk(repo, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d != ".git")
        for filename in sorted(files):
            path = Path(root) / filename
            relative = path.relative_to(repo).as_posix()
            try:
                if path.is_symlink():
                    records.append({
                        "path": relative,
                        "category": "other",
                        "classification_reason": "symbolic link; target was not followed",
                        "size": None,
                        "sha256": None,
                        "symlink_target": os.readlink(path),
                    })
                    continue
                category, reason = classify_file(relative)
                records.append({
                    "path": relative,
                    "category": category,
                    "classification_reason": reason,
                    "size": path.stat().st_size,
                    "sha256": sha256_file(path),
                    "symlink_target": None,
                })
            except (OSError, PermissionError) as exc:
                skipped.append({"path": relative, "reason": str(exc)})

    counts: dict[str, int] = {}
    for record in records:
        counts[record["category"]] = counts.get(record["category"], 0) + 1
    payload = {
        "format_version": "1.0.0",
        "repo_root": str(repo),
        "collected_at": utc_now(),
        "collection_policy": "read-only-no-project-execution",
        "files": records,
        "category_counts": dict(sorted(counts.items())),
        "skipped": skipped,
    }
    write_json(Path(args.out).expanduser().resolve(), payload)
    return 0


def run_git(repo: Path, parameters: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(repo), *parameters],
        check=check,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def parse_identity(path: Path) -> dict[str, Any]:
    raw = load_json(path)
    if not isinstance(raw, dict):
        raise ValueError("identity JSON must be an object")
    names = raw.get("names", [])
    emails = raw.get("emails", [])
    if not isinstance(names, list) or not all(isinstance(value, str) for value in names):
        raise ValueError("identity.names must be a string array")
    if not isinstance(emails, list) or not all(isinstance(value, str) for value in emails):
        raise ValueError("identity.emails must be a string array")
    return {
        "names": sorted({value.strip() for value in names if value.strip()}, key=str.casefold),
        "emails": sorted({value.strip() for value in emails if value.strip()}, key=str.casefold),
        "github_handle": raw.get("github_handle"),
        "status": raw.get("status", "missing" if not names and not emails else "partial"),
    }


def identity_matches(name: str, email: str, identity: dict[str, Any]) -> list[str]:
    reasons: list[str] = []
    normalized_name = name.strip().casefold()
    normalized_email = email.strip().casefold()
    if normalized_name and normalized_name in {v.casefold() for v in identity["names"]}:
        reasons.append("author-name")
    if normalized_email and normalized_email in {v.casefold() for v in identity["emails"]}:
        reasons.append("author-email")
    return reasons


def parse_numstat(text: str) -> list[dict[str, Any]]:
    changed: list[dict[str, Any]] = []
    for line in text.splitlines():
        parts = line.split("\t", 2)
        if len(parts) != 3:
            continue
        added, deleted, path = parts
        changed.append({
            "path": path,
            "added_lines": None if added == "-" else int(added),
            "deleted_lines": None if deleted == "-" else int(deleted),
        })
    return changed


def commit_details(repo: Path, sha: str) -> dict[str, Any]:
    metadata = run_git(repo, ["show", "-s", "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%cn%x1f%ce%x1f%cI%x1f%s%x1f%b", sha]).stdout
    fields = metadata.rstrip("\n").split("\x1f", 9)
    if len(fields) != 10:
        raise ValueError(f"could not parse commit metadata for {sha}")
    body = fields[9]
    coauthors = []
    for match in re.finditer(r"(?im)^Co-authored-by:\s*(.*?)\s*<([^>]+)>\s*$", body):
        coauthors.append({"name": match.group(1).strip(), "email": match.group(2).strip()})
    numstat = run_git(repo, ["show", "--format=", "--numstat", "--find-renames", sha]).stdout
    hunk_text = run_git(repo, ["show", "--format=", "--unified=0", "--find-renames", sha]).stdout
    hunk_headers = [line for line in hunk_text.splitlines() if line.startswith("@@")]
    return {
        "sha": fields[0],
        "parents": fields[1].split() if fields[1] else [],
        "author": {"name": fields[2], "email": fields[3], "date": fields[4]},
        "committer": {"name": fields[5], "email": fields[6], "date": fields[7]},
        "subject": fields[8],
        "body": body.rstrip(),
        "coauthors": coauthors,
        "is_merge": len(fields[1].split()) > 1,
        "changed_files": parse_numstat(numstat),
        "hunk_headers": hunk_headers,
    }


def ref_diff(repo: Path, ref: str, head: str) -> dict[str, Any]:
    resolved = run_git(repo, ["rev-parse", "--verify", ref], check=False)
    if resolved.returncode != 0:
        return {"ref": ref, "availability": "failed", "reason": resolved.stderr.strip(), "changed_files": []}
    diff = run_git(repo, ["diff", "--numstat", "--find-renames", f"{ref}...{head}"], check=False)
    if diff.returncode != 0:
        return {"ref": ref, "availability": "failed", "reason": diff.stderr.strip(), "changed_files": []}
    return {
        "ref": ref,
        "resolved_sha": resolved.stdout.strip(),
        "availability": "collected",
        "reason": None,
        "changed_files": parse_numstat(diff.stdout),
    }


def command_git(args: argparse.Namespace) -> int:
    repo = Path(args.repo).expanduser().resolve()
    out = Path(args.out).expanduser().resolve()
    try:
        identity = parse_identity(Path(args.identity).expanduser().resolve())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: invalid identity file: {exc}", file=sys.stderr)
        return 2

    probe = run_git(repo, ["rev-parse", "--show-toplevel"], check=False) if repo.is_dir() else None
    is_target_root = (
        probe is not None
        and probe.returncode == 0
        and Path(probe.stdout.strip()).resolve() == repo
    )
    if not is_target_root:
        write_json(out, {
            "format_version": "1.0.0",
            "repo_root": str(repo),
            "collected_at": utc_now(),
            "availability": "unavailable",
            "reason": "path is not the root of a standalone Git work tree",
            "identity": identity,
            "revision": None,
            "remotes": [],
            "initial_commits": [],
            "commit_count": None,
            "identity_commits": [],
            "identity_commit_count": 0,
            "baselines": [],
        })
        return 0

    head = run_git(repo, ["rev-parse", "HEAD"]).stdout.strip()
    remotes_raw = run_git(repo, ["remote", "-v"], check=False).stdout
    remotes = []
    for line in remotes_raw.splitlines():
        fields = line.split()
        if len(fields) >= 3:
            remotes.append({"name": fields[0], "url": fields[1], "kind": fields[2].strip("()")})
    roots = run_git(repo, ["rev-list", "--max-parents=0", "--all"], check=False).stdout.splitlines()
    log_args = ["log", "--all", "--format=%H%x1f%an%x1f%ae%x1f%aI%x1f%b%x1e"]
    if args.start_date:
        log_args.append(f"--since={args.start_date}")
    if args.end_date:
        log_args.append(f"--until={args.end_date}")
    records = run_git(repo, log_args).stdout.split("\x1e")
    matched: list[dict[str, Any]] = []
    for record in records:
        fields = record.strip("\n").split("\x1f", 4)
        if len(fields) != 5:
            continue
        reasons = identity_matches(fields[1], fields[2], identity)
        for match in re.finditer(r"(?im)^Co-authored-by:\s*(.*?)\s*<([^>]+)>\s*$", fields[4]):
            for reason in identity_matches(match.group(1), match.group(2), identity):
                coauthor_reason = reason.replace("author-", "coauthor-")
                if coauthor_reason not in reasons:
                    reasons.append(coauthor_reason)
        if reasons:
            details = commit_details(repo, fields[0])
            details["identity_match_reasons"] = reasons
            matched.append(details)
    count_text = run_git(repo, ["rev-list", "--count", "--all"]).stdout.strip()
    baselines = []
    for kind, ref in (("starter", args.starter_ref), ("upstream", args.upstream_ref)):
        if ref:
            result = ref_diff(repo, ref, head)
            result["kind"] = kind
            baselines.append(result)
    write_json(out, {
        "format_version": "1.0.0",
        "repo_root": str(repo),
        "collected_at": utc_now(),
        "availability": "collected",
        "reason": None,
        "identity": identity,
        "revision": head,
        "remotes": remotes,
        "initial_commits": roots,
        "commit_count": int(count_text),
        "identity_commits": matched,
        "identity_commit_count": len(matched),
        "baselines": baselines,
        "limitations": [
            "An identity match locates candidate commits; it does not prove sole authorship or technical ownership.",
            "Squash, rebases, shared accounts, co-authorship, and missing identities require separate interpretation.",
        ],
    })
    return 0


def duplicate_ids(items: Iterable[dict[str, Any]]) -> set[str]:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for item in items:
        value = item.get("id")
        if isinstance(value, str):
            if value in seen:
                duplicates.add(value)
            seen.add(value)
    return duplicates


def require_keys(value: Any, keys: Iterable[str], path: str, errors: list[str]) -> bool:
    if not isinstance(value, dict):
        errors.append(f"{path}: expected object")
        return False
    for key in keys:
        if key not in value:
            errors.append(f"{path}: missing required key {key!r}")
    return True


def schema_errors(instance: Any, schema: dict[str, Any], root: dict[str, Any], path: str = "$") -> list[str]:
    """Validate the JSON Schema features used by this plugin without third-party packages."""
    errors: list[str] = []
    if "$ref" in schema:
        reference = schema["$ref"]
        if not isinstance(reference, str) or not reference.startswith("#/"):
            return [f"{path}: unsupported schema reference {reference!r}"]
        target: Any = root
        for token in reference[2:].split("/"):
            token = token.replace("~1", "/").replace("~0", "~")
            target = target[token]
        return schema_errors(instance, target, root, path)
    if "const" in schema and instance != schema["const"]:
        errors.append(f"{path}: expected constant {schema['const']!r}")
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{path}: value {instance!r} is not in the allowed enum")

    expected = schema.get("type")
    expected_types = expected if isinstance(expected, list) else [expected] if expected else []
    type_checks = {
        "object": lambda value: isinstance(value, dict),
        "array": lambda value: isinstance(value, list),
        "string": lambda value: isinstance(value, str),
        "integer": lambda value: isinstance(value, int) and not isinstance(value, bool),
        "number": lambda value: isinstance(value, (int, float)) and not isinstance(value, bool),
        "boolean": lambda value: isinstance(value, bool),
        "null": lambda value: value is None,
    }
    if expected_types and not any(type_checks[name](instance) for name in expected_types):
        return [f"{path}: expected type {' or '.join(expected_types)}"]

    if isinstance(instance, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in instance:
                errors.append(f"{path}: missing required key {key!r}")
        properties = schema.get("properties", {})
        for key, value in instance.items():
            child_path = f"{path}.{key}"
            if key in properties:
                errors.extend(schema_errors(value, properties[key], root, child_path))
            elif schema.get("additionalProperties") is False:
                errors.append(f"{child_path}: additional property is not allowed")
    elif isinstance(instance, list):
        if "minItems" in schema and len(instance) < schema["minItems"]:
            errors.append(f"{path}: expected at least {schema['minItems']} item(s)")
        if "maxItems" in schema and len(instance) > schema["maxItems"]:
            errors.append(f"{path}: expected at most {schema['maxItems']} item(s)")
        if schema.get("uniqueItems"):
            serialized = [json.dumps(value, ensure_ascii=False, sort_keys=True) for value in instance]
            if len(serialized) != len(set(serialized)):
                errors.append(f"{path}: array items must be unique")
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, value in enumerate(instance):
                errors.extend(schema_errors(value, item_schema, root, f"{path}[{index}]"))
    elif isinstance(instance, str):
        if "minLength" in schema and len(instance) < schema["minLength"]:
            errors.append(f"{path}: string is shorter than {schema['minLength']}")
        if "pattern" in schema and re.search(schema["pattern"], instance) is None:
            errors.append(f"{path}: string does not match required pattern")
    elif isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if "minimum" in schema and instance < schema["minimum"]:
            errors.append(f"{path}: value is less than {schema['minimum']}")
        if "maximum" in schema and instance > schema["maximum"]:
            errors.append(f"{path}: value is greater than {schema['maximum']}")
    return errors


def load_archive_schema() -> dict[str, Any]:
    return load_json(Path(__file__).resolve().parents[1] / "assets/star-project.schema.json")


def canonical_evidence_sha(item: dict[str, Any]) -> str:
    payload = {key: item.get(key) for key in ("type", "title", "locator", "excerpt")}
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def validate_archive(data: Any, archive_dir: Path | None = None) -> list[str]:
    archive_schema = load_archive_schema()
    errors: list[str] = schema_errors(data, archive_schema, archive_schema)
    if errors:
        return errors
    top_keys = [
        "schema_version", "project", "analysis_scope", "identity", "evidence", "claims",
        "contributions", "metrics", "star", "open_questions", "interview_topics", "execution_log"
    ]
    if not require_keys(data, top_keys, "$", errors):
        return errors
    if data.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"$.schema_version: expected {SCHEMA_VERSION!r}")
    for key in ("evidence", "claims", "contributions", "metrics", "open_questions", "interview_topics", "execution_log"):
        if not isinstance(data.get(key), list):
            errors.append(f"$.{key}: expected array")
    star = data.get("star")
    if require_keys(star, ("situation", "task", "action", "result"), "$.star", errors):
        for section in ("situation", "task", "action", "result"):
            if not isinstance(star.get(section), list):
                errors.append(f"$.star.{section}: expected array")
    if errors:
        return errors

    evidence = data["evidence"]
    claims = data["claims"]
    metrics = data["metrics"]
    contributions = data["contributions"]
    star_items = [item for section in ("situation", "task", "action", "result") for item in star[section]]
    for collection_name, collection in (
        ("evidence", evidence), ("claims", claims), ("contributions", contributions),
        ("metrics", metrics), ("star items", star_items), ("open_questions", data["open_questions"]),
        ("interview_topics", data["interview_topics"]), ("execution_log", data["execution_log"]),
    ):
        if not all(isinstance(item, dict) for item in collection):
            errors.append(f"$.{collection_name}: every item must be an object")
        for duplicate in sorted(duplicate_ids(item for item in collection if isinstance(item, dict))):
            errors.append(f"$.{collection_name}: duplicate id {duplicate!r}")

    evidence_by_id = {item.get("id"): item for item in evidence if isinstance(item, dict)}
    claims_by_id = {item.get("id"): item for item in claims if isinstance(item, dict)}
    metrics_by_id = {item.get("id"): item for item in metrics if isinstance(item, dict)}

    for index, item in enumerate(evidence):
        path = f"$.evidence[{index}]"
        require_keys(item, ("id", "type", "availability", "title", "locator", "digest_basis", "sha256", "excerpt", "collected_at"), path, errors)
        digest = item.get("sha256")
        if digest is not None and (not isinstance(digest, str) or not SHA256_RE.fullmatch(digest)):
            errors.append(f"{path}.sha256: expected lowercase SHA-256 or null")
        basis = item.get("digest_basis")
        if item.get("availability") == "collected":
            if basis == "not-applicable" or digest is None:
                errors.append(f"{path}: collected evidence requires a recomputable digest")
            elif basis == "canonical-record" and digest != canonical_evidence_sha(item):
                errors.append(f"{path}.sha256: canonical-record digest mismatch")
            elif basis == "user-confirmation-text":
                if item.get("type") != "user-confirmation" or not isinstance(item.get("excerpt"), str):
                    errors.append(f"{path}: user-confirmation-text requires confirmation evidence and exact excerpt")
                elif digest != hashlib.sha256(item["excerpt"].encode("utf-8")).hexdigest():
                    errors.append(f"{path}.sha256: user-confirmation-text digest mismatch")
            elif basis == "file-bytes":
                locator = item.get("locator", {})
                raw_path = locator.get("artifact_path") or locator.get("path")
                if not isinstance(raw_path, str) or not raw_path:
                    errors.append(f"{path}: file-bytes requires locator.artifact_path or locator.path")
                else:
                    candidate = Path(raw_path).expanduser()
                    if not candidate.is_absolute():
                        if locator.get("artifact_path") and archive_dir is not None:
                            candidate = archive_dir / candidate
                        else:
                            candidate = Path(data["project"]["repo_root"]) / candidate
                    if not candidate.is_file():
                        errors.append(f"{path}: digest source file does not exist: {candidate}")
                    elif digest != sha256_file(candidate):
                        errors.append(f"{path}.sha256: file-bytes digest mismatch for {candidate}")
        elif basis != "not-applicable" or digest is not None:
            errors.append(f"{path}: non-collected evidence requires digest_basis not-applicable and sha256 null")

    for index, claim in enumerate(claims):
        path = f"$.claims[{index}]"
        require_keys(claim, ("id", "text", "scope", "status", "ownership_level", "action_kind", "tags", "evidence_ids", "confidence", "confidence_reason", "resume_eligible"), path, errors)
        if claim.get("scope") not in CLAIM_SCOPES:
            errors.append(f"{path}.scope: invalid value")
        if claim.get("status") not in CLAIM_STATUSES:
            errors.append(f"{path}.status: invalid value")
        refs = claim.get("evidence_ids")
        if not isinstance(refs, list):
            errors.append(f"{path}.evidence_ids: expected array")
            refs = []
        for ref in refs:
            if ref not in evidence_by_id:
                errors.append(f"{path}.evidence_ids: unknown evidence {ref!r}")
        if claim.get("status") in {"verified", "user-confirmed"} and not refs:
            errors.append(f"{path}: admitted claim requires evidence")
        if claim.get("status") == "user-confirmed" and not any(evidence_by_id.get(ref, {}).get("type") == "user-confirmation" for ref in refs):
            errors.append(f"{path}: user-confirmed claim requires user-confirmation evidence")
        if claim.get("status") == "verified" and not any(evidence_by_id.get(ref, {}).get("availability") == "collected" for ref in refs):
            errors.append(f"{path}: verified claim requires collected evidence")
        if claim.get("resume_eligible"):
            if claim.get("status") not in {"verified", "user-confirmed"}:
                errors.append(f"{path}: resume-eligible claim has inadmissible status")
            if claim.get("scope") in {"starter", "third-party", "generated", "unknown"}:
                errors.append(f"{path}: resume-eligible claim has inadmissible scope")
        if claim.get("scope") in USER_SCOPES and claim.get("action_kind") == "none":
            errors.append(f"{path}: user-scoped claim requires a precise action_kind")
        if claim.get("scope") == "third-party" and claim.get("action_kind") in {"designed", "implemented", "optimized"}:
            errors.append(f"{path}: third-party capability cannot be claimed as designed/implemented/optimized")

    for index, metric in enumerate(metrics):
        path = f"$.metrics[{index}]"
        require_keys(metric, ("id", "name", "kind", "status", "value", "unit", "baseline", "result", "measurement_method", "evidence_ids", "resume_eligible"), path, errors)
        refs = metric.get("evidence_ids") if isinstance(metric.get("evidence_ids"), list) else []
        for ref in refs:
            if ref not in evidence_by_id:
                errors.append(f"{path}.evidence_ids: unknown evidence {ref!r}")
        if metric.get("resume_eligible") and metric.get("status") not in METRIC_ELIGIBLE_STATUSES:
            errors.append(f"{path}: only verified-measured or verified-count metrics are resume eligible")
        if metric.get("status") == "verified-measured":
            if metric.get("result") is None or not metric.get("measurement_method") or not refs:
                errors.append(f"{path}: verified measurement requires result, method, and evidence")
            if metric.get("kind") == "performance" and metric.get("baseline") is None:
                errors.append(f"{path}: verified performance metric requires a baseline")
            if not any(evidence_by_id.get(ref, {}).get("type") in {"benchmark", "test", "ci"} for ref in refs):
                errors.append(f"{path}: verified measurement requires benchmark, test, or CI evidence")
        if metric.get("status") == "verified-count" and metric.get("value") is None:
            errors.append(f"{path}: verified count requires value")

    for index, contribution in enumerate(contributions):
        path = f"$.contributions[{index}]"
        require_keys(contribution, ("id", "summary", "claim_ids", "evidence_ids", "paths", "symbols", "commit_ids"), path, errors)
        for ref in contribution.get("claim_ids", []):
            claim = claims_by_id.get(ref)
            if claim is None:
                errors.append(f"{path}.claim_ids: unknown claim {ref!r}")
            elif claim.get("scope") not in USER_SCOPES:
                errors.append(f"{path}: contribution may reference only user-scoped claims ({ref!r})")
        for ref in contribution.get("evidence_ids", []):
            if ref not in evidence_by_id:
                errors.append(f"{path}.evidence_ids: unknown evidence {ref!r}")

    for section in ("situation", "task", "action", "result"):
        for index, item in enumerate(star[section]):
            path = f"$.star.{section}[{index}]"
            require_keys(item, ("id", "text", "claim_ids", "evidence_ids", "metric_ids", "status", "resume_eligible"), path, errors)
            if not item.get("claim_ids"):
                errors.append(f"{path}: at least one claim reference is required")
            if not item.get("evidence_ids"):
                errors.append(f"{path}: at least one evidence reference is required")
            for ref in item.get("claim_ids", []):
                if ref not in claims_by_id:
                    errors.append(f"{path}.claim_ids: unknown claim {ref!r}")
            for ref in item.get("evidence_ids", []):
                if ref not in evidence_by_id:
                    errors.append(f"{path}.evidence_ids: unknown evidence {ref!r}")
            for ref in item.get("metric_ids", []):
                if ref not in metrics_by_id:
                    errors.append(f"{path}.metric_ids: unknown metric {ref!r}")
            if item.get("resume_eligible"):
                for ref in item.get("claim_ids", []):
                    if not claims_by_id.get(ref, {}).get("resume_eligible"):
                        errors.append(f"{path}: eligible STAR item references ineligible claim {ref!r}")
                for ref in item.get("metric_ids", []):
                    if not metrics_by_id.get(ref, {}).get("resume_eligible"):
                        errors.append(f"{path}: eligible STAR item references ineligible metric {ref!r}")
            if section == "action" and item.get("resume_eligible") and not any(claims_by_id.get(ref, {}).get("scope") in USER_SCOPES for ref in item.get("claim_ids", [])):
                errors.append(f"{path}: eligible Action requires user-scoped evidence")
            if section == "result":
                for ref in item.get("metric_ids", []):
                    if metrics_by_id.get(ref, {}).get("status") not in METRIC_ELIGIBLE_STATUSES and item.get("resume_eligible"):
                        errors.append(f"{path}: eligible Result references non-verified metric {ref!r}")
                if re.search(r"(?i)\b(todo|planned?|target|theoretical)\b|计划|目标值|理论", str(item.get("text", ""))) and item.get("resume_eligible"):
                    errors.append(f"{path}: planned, target, or theoretical text cannot be resume eligible")
                result_tags = {
                    tag
                    for ref in item.get("claim_ids", [])
                    for tag in claims_by_id.get(ref, {}).get("tags", [])
                }
                text = str(item.get("text", ""))
                if re.search(r"(?i)\bproduction(?:-grade| ready)?\b|生产级|生产环境|线上", text) and "production-evidence" not in result_tags:
                    errors.append(f"{path}: production wording lacks a production-evidence claim")
                if re.search(r"(?i)\breliab(?:le|ility)\b|高可用|可靠性|稳定性", text) and "reliability-evidence" not in result_tags:
                    errors.append(f"{path}: reliability wording lacks a reliability-evidence claim")

    for index, question in enumerate(data["open_questions"]):
        for ref in question.get("affects_claim_ids", []):
            if ref not in claims_by_id:
                errors.append(f"$.open_questions[{index}]: unknown claim {ref!r}")
    for index, topic in enumerate(data["interview_topics"]):
        for ref in topic.get("claim_ids", []):
            if ref not in claims_by_id:
                errors.append(f"$.interview_topics[{index}]: unknown claim {ref!r}")

    for index, entry in enumerate(data["execution_log"]):
        path = f"$.execution_log[{index}]"
        if entry.get("status") == "not-requested":
            if entry.get("approval") != "not-requested" or entry.get("command") is not None or entry.get("exit_code") is not None:
                errors.append(f"{path}: not-requested requires no command/exit code and approval not-requested")
        if entry.get("status") == "declined" and entry.get("approval") != "declined":
            errors.append(f"{path}: declined status requires declined approval")

    return errors


def command_validate(args: argparse.Namespace) -> int:
    try:
        data = load_json(Path(args.archive).expanduser().resolve())
    except (OSError, json.JSONDecodeError) as exc:
        print(f"error: could not read archive: {exc}", file=sys.stderr)
        return 2
    errors = validate_archive(data, Path(args.archive).expanduser().resolve().parent)
    if errors:
        for error in errors:
            print(f"ERROR {error}", file=sys.stderr)
        print(f"validation failed with {len(errors)} error(s)", file=sys.stderr)
        return 1
    print("star-project.json is valid")
    return 0


def format_refs(label: str, values: list[str]) -> str:
    return f"{label}: {', '.join(f'`{value}`' for value in values) if values else 'none'}"


def render_archive(data: dict[str, Any]) -> str:
    project = data["project"]
    lines = [
        f"# {project['name']} — Verified STAR Project Archive",
        "",
        f"- Schema: `{data['schema_version']}`",
        f"- Revision: `{project['revision'] or 'unavailable'}`",
        f"- Repository: `{project['repo_root']}`",
        f"- Collected: `{data['analysis_scope']['collected_at']}`",
        "",
        "## Analysis scope",
        "",
        f"- Repository kind: `{project['repository_kind']}`",
        f"- Identity status: `{data['identity']['status']}`",
        f"- GitHub evidence: `{data['analysis_scope']['github_availability']}`",
        f"- Starter ref: `{data['analysis_scope']['starter_ref'] or 'none'}`",
        f"- Upstream ref: `{data['analysis_scope']['upstream_ref'] or 'none'}`",
        "",
        "## STAR",
    ]
    labels = {"situation": "Situation", "task": "Task", "action": "Action", "result": "Result"}
    for key in ("situation", "task", "action", "result"):
        lines.extend(["", f"### {labels[key]}", ""])
        items = data["star"][key]
        if not items:
            lines.append("_No supported item recorded._")
        for item in items:
            lines.extend([
                f"- **{item['id']}** [{item['status']}; resume_eligible={str(item['resume_eligible']).lower()}] {item['text']}",
                f"  - {format_refs('Claims', item['claim_ids'])}",
                f"  - {format_refs('Evidence', item['evidence_ids'])}",
                f"  - {format_refs('Metrics', item['metric_ids'])}",
            ])
    lines.extend(["", "## Contributions", ""])
    if not data["contributions"]:
        lines.append("_No user-attributed contribution passed the evidence threshold._")
    for item in data["contributions"]:
        lines.extend([
            f"- **{item['id']}** {item['summary']}",
            f"  - {format_refs('Claims', item['claim_ids'])}",
            f"  - {format_refs('Evidence', item['evidence_ids'])}",
            f"  - Paths: {', '.join(f'`{value}`' for value in item['paths']) if item['paths'] else 'none'}",
            f"  - Symbols: {', '.join(f'`{value}`' for value in item['symbols']) if item['symbols'] else 'none'}",
            f"  - Commits: {', '.join(f'`{value}`' for value in item['commit_ids']) if item['commit_ids'] else 'none'}",
        ])
    lines.extend(["", "## Claim ledger", ""])
    for claim in data["claims"]:
        lines.extend([
            f"### {claim['id']}", "",
            claim["text"], "",
            f"- Scope: `{claim['scope']}`",
            f"- Status: `{claim['status']}`",
            f"- Ownership: `{claim['ownership_level']}`",
            f"- Action kind: `{claim['action_kind']}`",
            f"- Confidence: `{claim['confidence']}` — {claim['confidence_reason']}",
            f"- Resume eligible: `{str(claim['resume_eligible']).lower()}`",
            f"- {format_refs('Evidence', claim['evidence_ids'])}", "",
        ])
    lines.extend(["## Metrics", ""])
    if not data["metrics"]:
        lines.append("_No metrics recorded._")
    for metric in data["metrics"]:
        unit_suffix = f" {metric['unit']}" if metric["unit"] else ""
        lines.extend([
            f"- **{metric['id']}** {metric['name']}: `{metric['value']}`{unit_suffix}",
            f"  - Status: `{metric['status']}`; resume_eligible=`{str(metric['resume_eligible']).lower()}`",
            f"  - Baseline/result: `{metric['baseline']}` → `{metric['result']}`",
            f"  - Method: {metric['measurement_method'] or 'not recorded'}",
            f"  - {format_refs('Evidence', metric['evidence_ids'])}",
        ])
    lines.extend(["", "## Evidence ledger", ""])
    for item in data["evidence"]:
        lines.extend([
            f"- **{item['id']}** `{item['type']}` / `{item['availability']}` — {item['title']}",
            f"  - Locator: `{json.dumps(item['locator'], ensure_ascii=False, sort_keys=True)}`",
            f"  - Digest basis: `{item['digest_basis']}`",
            f"  - SHA-256: `{item['sha256'] or 'not-applicable'}`",
            f"  - Excerpt: {item['excerpt'] or 'not recorded'}",
        ])
    lines.extend(["", "## Open questions", ""])
    if not data["open_questions"]:
        lines.append("_None._")
    for item in data["open_questions"]:
        lines.append(f"- **{item['id']}** [{item['status']}] {item['question']} ({format_refs('claims', item['affects_claim_ids'])})")
    lines.extend(["", "## Interview topics", ""])
    if not data["interview_topics"]:
        lines.append("_None._")
    for item in data["interview_topics"]:
        lines.append(f"- **{item['topic']}** — {'; '.join(item['questions'])}")
    lines.extend(["", "## Execution log", ""])
    if not data["execution_log"]:
        lines.append("_No project command was executed._")
    for item in data["execution_log"]:
        lines.extend([
            f"- **{item['id']}** `{item['kind']}` / `{item['status']}` / approval `{item['approval']}` — `{item['command'] or 'none'}`",
            f"  - CWD: `{item['cwd'] or 'none'}`; exit code: `{item['exit_code'] if item['exit_code'] is not None else 'none'}`; timestamp: `{item['timestamp']}`",
            f"  - stdout: `{item['stdout_path'] or 'none'}`; stderr: `{item['stderr_path'] or 'none'}`",
        ])
    return "\n".join(lines).rstrip() + "\n"


def command_render(args: argparse.Namespace) -> int:
    archive_path = Path(args.archive).expanduser().resolve()
    try:
        data = load_json(archive_path)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"error: could not read archive: {exc}", file=sys.stderr)
        return 2
    errors = validate_archive(data, archive_path.parent)
    if errors:
        for error in errors:
            print(f"ERROR {error}", file=sys.stderr)
        print("refusing to render invalid archive", file=sys.stderr)
        return 1
    out = Path(args.out).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(render_archive(data))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    inventory = subparsers.add_parser("inventory", help="inventory and classify repository files")
    inventory.add_argument("--repo", required=True)
    inventory.add_argument("--out", required=True)
    inventory.set_defaults(func=command_inventory)

    git_parser = subparsers.add_parser("git", help="collect local Git evidence without network access")
    git_parser.add_argument("--repo", required=True)
    git_parser.add_argument("--identity", required=True)
    git_parser.add_argument("--out", required=True)
    git_parser.add_argument("--start-date")
    git_parser.add_argument("--end-date")
    git_parser.add_argument("--starter-ref")
    git_parser.add_argument("--upstream-ref")
    git_parser.set_defaults(func=command_git)

    validate = subparsers.add_parser("validate", help="validate a STAR archive")
    validate.add_argument("--archive", required=True)
    validate.set_defaults(func=command_validate)

    render = subparsers.add_parser("render", help="render a validated STAR archive as Markdown")
    render.add_argument("--archive", required=True)
    render.add_argument("--out", required=True)
    render.set_defaults(func=command_render)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
