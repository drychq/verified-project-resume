#!/usr/bin/env python3
"""Deterministic input validation, resume fact guard, and Markdown renderer."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import sys
from typing import Any, Iterable


SCHEMA_VERSION = "1.0.0"
ADMISSIBLE_CLAIM_STATUSES = {"verified", "user-confirmed"}
ADMISSIBLE_METRIC_STATUSES = {"verified-measured", "verified-count"}
USER_SCOPES = {"user-sole", "user-partial"}
ACTION_KINDS = {"designed", "implemented", "integrated", "configured", "called", "tested", "debugged", "optimized", "documented", "reviewed"}
LOW_OWNERSHIP_ACTIONS = {"integrated", "configured", "called"}
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
NUMBER_RE = re.compile(r"(?<![\w.+-])\d+(?:[.,]\d+)*(?:\s?(?:%|x|×|ns|us|µs|ms|s|KB|MB|GB|TB|k|K|M|万|亿))?")
APPROX_RE = re.compile(
    r"(?i)(?:~|≈|about|around|approximately|roughly|up to|more than|over\s+\d|less than|"
    r"\d\s*(?:-|–|—|～|to|至)\s*\d|约|大约|近\s*\d|超过|少于|最高)"
)
STRONG_PATTERNS = {
    "architected": re.compile(r"(?i)\barchitect(?:ed|ure)?\b|架构(?:了|设计)|总体架构|整体架构"),
    "led": re.compile(r"(?i)\b(?:led|headed|spearheaded)\b|主导|牵头"),
    "owned": re.compile(r"(?i)\bowned\b|\bowner\b|全权负责|独立负责"),
}
IMPLEMENT_PATTERN = re.compile(r"(?i)\b(?:implement(?:ed|ing)?|develop(?:ed|ing)?|built|build)\b|实现(?:了)?|开发(?:了)?|构建(?:了)?")
DESIGN_PATTERN = re.compile(r"(?i)\bdesign(?:ed|ing)?\b|设计(?:了)?")
PRODUCTION_PATTERN = re.compile(r"(?i)\bproduction(?:-grade| ready)?\b|生产级|生产环境|线上")
RELIABILITY_PATTERN = re.compile(r"(?i)\breliab(?:le|ility)\b|\bhigh availability\b|\bzero downtime\b|高可用|零停机|可靠性|稳定性")
SCALE_PATTERN = re.compile(r"(?i)\bat scale\b|\blarge[- ]scale\b|\bhigh concurrency\b|大规模|高并发|业务规模")
CAUSAL_PATTERN = re.compile(r"(?i)\b(?:caused|resulted in|thereby enabled|directly enabled)\b|从而带来|直接促成|因此实现")
PERFORMANCE_CAUSAL_PATTERN = re.compile(
    r"(?i)\b(?:improv(?:ed|ing)|reduc(?:ed|ing)|increas(?:ed|ing)|accelerat(?:ed|ing)|speed(?:ed)? up|optimized?)\b|"
    r"提升|降低|减少|加速|优化(?:了)?"
)


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


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
        for key in schema.get("required", []):
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


def load_schema(filename: str) -> dict[str, Any]:
    return load_json(Path(__file__).resolve().parents[1] / "assets" / filename)


def canonical_evidence_sha(item: dict[str, Any]) -> str:
    payload = {key: item.get(key) for key in ("type", "title", "locator", "excerpt")}
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def validate_archive(data: Any, archive_dir: Path | None = None) -> list[str]:
    """Validate the archive interface and the admission-critical invariants."""
    archive_schema = load_schema("star-project.schema.json")
    errors: list[str] = schema_errors(data, archive_schema, archive_schema)
    if errors:
        return errors
    required = [
        "schema_version", "project", "analysis_scope", "identity", "evidence", "claims",
        "contributions", "metrics", "star", "open_questions", "interview_topics", "execution_log"
    ]
    if not require_keys(data, required, "$", errors):
        return errors
    if data.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"$.schema_version: expected {SCHEMA_VERSION!r}")
    for key in ("evidence", "claims", "contributions", "metrics", "open_questions", "interview_topics", "execution_log"):
        if not isinstance(data.get(key), list):
            errors.append(f"$.{key}: expected array")
    star = data.get("star")
    if require_keys(star, ("situation", "task", "action", "result"), "$.star", errors):
        for key in ("situation", "task", "action", "result"):
            if not isinstance(star.get(key), list):
                errors.append(f"$.star.{key}: expected array")
    if errors:
        return errors

    id_sets: dict[str, set[str]] = {}
    for key in ("evidence", "claims", "contributions", "metrics"):
        ids: list[str] = []
        for index, item in enumerate(data[key]):
            if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item.get("id"):
                errors.append(f"$.{key}[{index}].id: non-empty string required")
            else:
                ids.append(item["id"])
        if len(ids) != len(set(ids)):
            errors.append(f"$.{key}: IDs must be unique")
        id_sets[key] = set(ids)

    evidence_by_id = {item["id"]: item for item in data["evidence"] if isinstance(item, dict) and "id" in item}
    for index, item in enumerate(data["evidence"]):
        if not isinstance(item, dict):
            continue
        path = f"$.evidence[{index}]"
        digest = item.get("sha256")
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
    for index, claim in enumerate(data["claims"]):
        if not isinstance(claim, dict):
            continue
        path = f"$.claims[{index}]"
        require_keys(claim, ("id", "text", "scope", "status", "ownership_level", "action_kind", "evidence_ids", "resume_eligible"), path, errors)
        refs = claim.get("evidence_ids", [])
        if not isinstance(refs, list):
            errors.append(f"{path}.evidence_ids: expected array")
            refs = []
        for ref in refs:
            if ref not in id_sets["evidence"]:
                errors.append(f"{path}: unknown evidence {ref!r}")
        if claim.get("resume_eligible"):
            if claim.get("status") not in ADMISSIBLE_CLAIM_STATUSES:
                errors.append(f"{path}: resume-eligible claim has inadmissible status")
            if not refs:
                errors.append(f"{path}: resume-eligible claim requires evidence")
            if claim.get("scope") in {"starter", "third-party", "generated", "unknown"}:
                errors.append(f"{path}: resume-eligible claim has inadmissible scope")
        if claim.get("status") == "user-confirmed" and not any(evidence_by_id.get(ref, {}).get("type") == "user-confirmation" for ref in refs):
            errors.append(f"{path}: user-confirmed claim requires user-confirmation evidence")

    for index, metric in enumerate(data["metrics"]):
        if not isinstance(metric, dict):
            continue
        path = f"$.metrics[{index}]"
        require_keys(metric, ("id", "name", "kind", "status", "value", "unit", "baseline", "result", "measurement_method", "evidence_ids", "resume_eligible"), path, errors)
        refs = metric.get("evidence_ids", [])
        if not isinstance(refs, list):
            errors.append(f"{path}.evidence_ids: expected array")
            refs = []
        for ref in refs:
            if ref not in id_sets["evidence"]:
                errors.append(f"{path}: unknown evidence {ref!r}")
        if metric.get("resume_eligible") and metric.get("status") not in ADMISSIBLE_METRIC_STATUSES:
            errors.append(f"{path}: metric status is not admissible")
        if metric.get("status") == "verified-measured":
            if metric.get("result") is None or not metric.get("measurement_method") or not refs:
                errors.append(f"{path}: verified measurement requires result, method, and evidence")
            if metric.get("kind") == "performance" and metric.get("baseline") is None:
                errors.append(f"{path}: performance measurement requires baseline")
        if metric.get("status") == "verified-count" and metric.get("value") is None:
            errors.append(f"{path}: verified count requires value")

    for section in ("situation", "task", "action", "result"):
        for index, item in enumerate(star[section]):
            path = f"$.star.{section}[{index}]"
            if not isinstance(item, dict):
                errors.append(f"{path}: expected object")
                continue
            require_keys(item, ("id", "text", "claim_ids", "evidence_ids", "metric_ids", "status", "resume_eligible"), path, errors)
            for ref in item.get("claim_ids", []):
                if ref not in id_sets["claims"]:
                    errors.append(f"{path}: unknown claim {ref!r}")
            for ref in item.get("evidence_ids", []):
                if ref not in id_sets["evidence"]:
                    errors.append(f"{path}: unknown evidence {ref!r}")
            for ref in item.get("metric_ids", []):
                if ref not in id_sets["metrics"]:
                    errors.append(f"{path}: unknown metric {ref!r}")
    return errors


def command_validate_input(args: argparse.Namespace) -> int:
    path = Path(args.archive).expanduser().resolve()
    try:
        data = load_json(path)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"error: input is not a readable JSON archive: {exc}", file=sys.stderr)
        return 2
    errors = validate_archive(data, path.parent)
    if errors:
        for error in errors:
            print(f"ERROR {error}", file=sys.stderr)
        print(f"input validation failed with {len(errors)} error(s); use $repository-to-star", file=sys.stderr)
        return 1
    print(f"star-project.json is valid; sha256={sha256_file(path)}")
    return 0


def flatten_clause_refs(candidate: dict[str, Any], field: str) -> set[str]:
    values: set[str] = set()
    for clause in candidate.get("clauses", {}).values():
        if isinstance(clause, dict):
            raw = clause.get(field, [])
            if isinstance(raw, list):
                values.update(value for value in raw if isinstance(value, str))
    return values


def numeric_tokens(text: str) -> set[str]:
    return {match.group(0).replace(" ", "") for match in NUMBER_RE.finditer(text)}


def source_numeric_tokens(claims: Iterable[dict[str, Any]], metrics: Iterable[dict[str, Any]]) -> set[str]:
    tokens: set[str] = set()
    for claim in claims:
        tokens.update(numeric_tokens(str(claim.get("text", ""))))
    for metric in metrics:
        unit = str(metric.get("unit") or "")
        for field in ("value", "baseline", "result"):
            value = metric.get(field)
            if value is not None:
                tokens.add(str(value).replace(" ", ""))
                tokens.add((str(value) + unit).replace(" ", ""))
                tokens.update(numeric_tokens(str(value)))
    return tokens


def refs_supported_by_sources(refs: set[str], claims: Iterable[dict[str, Any]], metrics: Iterable[dict[str, Any]]) -> set[str]:
    supported: set[str] = set()
    for item in list(claims) + list(metrics):
        supported.update(item.get("evidence_ids", []))
    return refs - supported


def guard_text(
    path: str,
    text: str,
    cited_claims: list[dict[str, Any]],
    cited_metrics: list[dict[str, Any]],
    errors: list[str],
    action_context: bool,
) -> None:
    text_numbers = numeric_tokens(text)
    allowed_numbers = source_numeric_tokens(cited_claims, cited_metrics)
    for token in sorted(text_numbers - allowed_numbers):
        errors.append(f"{path}: numeric token {token!r} is not present in cited admissible evidence")
    if text_numbers and APPROX_RE.search(text):
        errors.append(f"{path}: approximate or range language is not allowed for numeric claims")

    if action_context:
        ownership = {claim.get("ownership_level") for claim in cited_claims}
        action_kinds = {claim.get("action_kind") for claim in cited_claims}
        for label, pattern in STRONG_PATTERNS.items():
            if pattern.search(text) and not ({"lead", "sole"} & ownership):
                errors.append(f"{path}: strong verb {label!r} lacks lead/sole ownership evidence")
        if STRONG_PATTERNS["architected"].search(text) and "designed" not in action_kinds:
            errors.append(f"{path}: architecture wording lacks a designed claim")
        if IMPLEMENT_PATTERN.search(text) and not ({"implemented", "debugged", "optimized"} & action_kinds):
            errors.append(f"{path}: implementation wording exceeds cited action kinds")
        if DESIGN_PATTERN.search(text) and "designed" not in action_kinds:
            errors.append(f"{path}: design wording exceeds cited action kinds")
        if DESIGN_PATTERN.search(text) and not ({"sole", "lead", "shared"} & ownership):
            errors.append(f"{path}: design wording lacks sole/lead/shared ownership evidence")
        if action_kinds and action_kinds <= LOW_OWNERSHIP_ACTIONS and (IMPLEMENT_PATTERN.search(text) or DESIGN_PATTERN.search(text)):
            errors.append(f"{path}: integration/configuration/call evidence was escalated to design or implementation")

    tags = {tag for claim in cited_claims for tag in claim.get("tags", [])}
    if PRODUCTION_PATTERN.search(text) and "production-evidence" not in tags:
        errors.append(f"{path}: production wording lacks a production-evidence claim")
    if RELIABILITY_PATTERN.search(text) and "reliability-evidence" not in tags:
        errors.append(f"{path}: reliability wording lacks a reliability-evidence claim")
    if SCALE_PATTERN.search(text) and "scale-evidence" not in tags:
        errors.append(f"{path}: scale wording lacks a scale-evidence claim")
    if CAUSAL_PATTERN.search(text) and "causal-evidence" not in tags:
        errors.append(f"{path}: causal wording lacks a causal-evidence claim")
    if PERFORMANCE_CAUSAL_PATTERN.search(text):
        performance_metrics = [
            metric for metric in cited_metrics
            if metric.get("kind") == "performance"
            and metric.get("status") == "verified-measured"
            and metric.get("baseline") is not None
            and metric.get("result") is not None
            and metric.get("measurement_method")
        ]
        if not performance_metrics:
            errors.append(f"{path}: causal performance wording lacks verified baseline, result, and method")


def validate_candidates(archive_path: Path, archive: dict[str, Any], candidates: Any) -> list[str]:
    errors = validate_archive(archive, archive_path.parent)
    if errors:
        return [f"source archive: {error}" for error in errors]
    candidates_schema = load_schema("resume-candidates.schema.json")
    errors = schema_errors(candidates, candidates_schema, candidates_schema)
    if errors:
        return errors
    required = [
        "schema_version", "source_archive", "settings", "project_summaries", "candidate_groups",
        "excluded_claims", "warnings", "guard"
    ]
    if not require_keys(candidates, required, "$", errors):
        return errors
    if candidates.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"$.schema_version: expected {SCHEMA_VERSION!r}")
    if not require_keys(candidates.get("source_archive"), ("path", "sha256"), "$.source_archive", errors):
        return errors
    expected_hash = sha256_file(archive_path)
    actual_hash = candidates["source_archive"].get("sha256")
    if actual_hash != expected_hash:
        errors.append(f"$.source_archive.sha256: expected {expected_hash}, got {actual_hash!r}")
    if not isinstance(actual_hash, str) or not SHA256_RE.fullmatch(actual_hash):
        errors.append("$.source_archive.sha256: invalid SHA-256")

    settings = candidates.get("settings")
    if not require_keys(settings, ("target_role", "languages", "bullet_count", "focus"), "$.settings", errors):
        return errors
    languages = settings.get("languages")
    if not isinstance(languages, list) or not languages or len(languages) > 2 or set(languages) - {"zh-CN", "en"}:
        errors.append("$.settings.languages: expected one or both of zh-CN/en")
        languages = []
    bullet_count = settings.get("bullet_count")
    if not isinstance(bullet_count, int) or isinstance(bullet_count, bool) or not 2 <= bullet_count <= 4:
        errors.append("$.settings.bullet_count: expected integer from 2 to 4")

    evidence_by_id = {item["id"]: item for item in archive["evidence"]}
    claims_by_id = {item["id"]: item for item in archive["claims"]}
    metrics_by_id = {item["id"]: item for item in archive["metrics"]}
    groups = candidates.get("candidate_groups")
    if not isinstance(groups, list):
        errors.append("$.candidate_groups: expected array")
        groups = []
    if isinstance(bullet_count, int) and len(groups) != bullet_count:
        errors.append(f"$.candidate_groups: expected {bullet_count} groups, got {len(groups)}")
    group_ids: set[str] = set()

    summaries = candidates.get("project_summaries")
    if not isinstance(summaries, list):
        errors.append("$.project_summaries: expected array")
        summaries = []
    summary_languages = [item.get("language") for item in summaries if isinstance(item, dict)]
    if set(summary_languages) != set(languages) or len(summary_languages) != len(languages):
        errors.append("$.project_summaries: exactly one summary per requested language is required")
    for index, item in enumerate(summaries):
        validate_sourced_text(
            f"$.project_summaries[{index}]", item, claims_by_id, metrics_by_id, evidence_by_id,
            errors, action_context=False, require_user=False
        )

    referenced_claim_ids = {
        claim_id
        for item in summaries if isinstance(item, dict)
        for claim_id in item.get("claim_ids", []) if isinstance(claim_id, str)
    }

    for group_index, group in enumerate(groups):
        group_path = f"$.candidate_groups[{group_index}]"
        if not require_keys(group, ("semantic_group_id", "compression_method", "variants"), group_path, errors):
            continue
        group_id = group.get("semantic_group_id")
        if not isinstance(group_id, str) or not group_id:
            errors.append(f"{group_path}.semantic_group_id: non-empty string required")
        elif group_id in group_ids:
            errors.append(f"{group_path}.semantic_group_id: duplicate {group_id!r}")
        else:
            group_ids.add(group_id)
        if group.get("compression_method") not in {"action-method-result", "action-method-verified-capability"}:
            errors.append(f"{group_path}.compression_method: invalid value")
        variants = group.get("variants")
        if not isinstance(variants, list):
            errors.append(f"{group_path}.variants: expected array")
            continue
        variant_languages = [variant.get("language") for variant in variants if isinstance(variant, dict)]
        if set(variant_languages) != set(languages) or len(variant_languages) != len(languages):
            errors.append(f"{group_path}.variants: exactly one candidate per requested language is required")
        parity: list[tuple[set[str], set[str], set[str]]] = []
        for variant_index, variant in enumerate(variants):
            path = f"{group_path}.variants[{variant_index}]"
            if not require_keys(variant, ("id", "language", "text", "clauses", "interview_questions", "risk_flags", "submittable"), path, errors):
                continue
            clauses = variant.get("clauses")
            if not require_keys(clauses, ("action", "method", "result"), f"{path}.clauses", errors):
                continue
            for clause_name in ("action", "method", "result"):
                validate_sourced_text(
                    f"{path}.clauses.{clause_name}", clauses[clause_name], claims_by_id, metrics_by_id,
                    evidence_by_id, errors, action_context=clause_name in {"action", "method"},
                    require_user=clause_name == "action"
                )
            all_claim_ids = flatten_clause_refs(variant, "claim_ids")
            all_metric_ids = flatten_clause_refs(variant, "metric_ids")
            cited_claims = [claims_by_id[value] for value in all_claim_ids if value in claims_by_id]
            cited_metrics = [metrics_by_id[value] for value in all_metric_ids if value in metrics_by_id]
            guard_text(path + ".text", str(variant.get("text", "")), cited_claims, cited_metrics, errors, action_context=True)
            parity.append((all_claim_ids, flatten_clause_refs(variant, "evidence_ids"), all_metric_ids))
            referenced_claim_ids.update(all_claim_ids)
        if len(parity) == 2 and parity[0] != parity[1]:
            errors.append(f"{group_path}: bilingual variants must reference identical claim/evidence/metric sets")

    excluded = candidates.get("excluded_claims")
    if not isinstance(excluded, list):
        errors.append("$.excluded_claims: expected array")
    else:
        excluded_ids: list[str] = []
        for index, item in enumerate(excluded):
            if not require_keys(item, ("claim_id", "reason"), f"$.excluded_claims[{index}]", errors):
                continue
            if item.get("claim_id") not in claims_by_id:
                errors.append(f"$.excluded_claims[{index}]: unknown claim {item.get('claim_id')!r}")
            elif isinstance(item.get("claim_id"), str):
                excluded_ids.append(item["claim_id"])
        if len(excluded_ids) != len(set(excluded_ids)):
            errors.append("$.excluded_claims: claim IDs must be unique")
        overlap = referenced_claim_ids & set(excluded_ids)
        for claim_id in sorted(overlap):
            errors.append(f"$.excluded_claims: referenced claim {claim_id!r} cannot also be excluded")
        missing = set(claims_by_id) - referenced_claim_ids - set(excluded_ids)
        for claim_id in sorted(missing):
            errors.append(f"$.excluded_claims: omitted unselected claim {claim_id!r}")

    guard = candidates.get("guard")
    if require_keys(guard, ("version", "status", "errors", "checked_at"), "$.guard", errors):
        if guard.get("version") != "1.0.0":
            errors.append("$.guard.version: expected '1.0.0'")
        status = guard.get("status")
        submitted = [
            bool(variant.get("submittable"))
            for group in groups if isinstance(group, dict)
            for variant in group.get("variants", []) if isinstance(variant, dict)
        ]
        if status == "pass" and guard.get("errors"):
            errors.append("$.guard: pass status cannot contain errors")
        if status == "pass" and not all(submitted):
            errors.append("$.guard: every candidate must be submittable when status is pass")
        if status in {"draft", "fail"} and any(submitted):
            errors.append("$.guard: draft/fail candidates cannot be submittable")
        if status not in {"draft", "pass", "fail"}:
            errors.append("$.guard.status: expected draft, pass, or fail")
    return errors


def validate_sourced_text(
    path: str,
    item: Any,
    claims_by_id: dict[str, dict[str, Any]],
    metrics_by_id: dict[str, dict[str, Any]],
    evidence_by_id: dict[str, dict[str, Any]],
    errors: list[str],
    action_context: bool,
    require_user: bool,
) -> None:
    if not require_keys(item, ("text", "claim_ids", "evidence_ids", "metric_ids"), path, errors):
        return
    text = item.get("text")
    if not isinstance(text, str) or not text.strip():
        errors.append(f"{path}.text: non-empty string required")
        text = ""
    claim_ids = item.get("claim_ids")
    evidence_ids = item.get("evidence_ids")
    metric_ids = item.get("metric_ids")
    for label, refs in (("claim_ids", claim_ids), ("evidence_ids", evidence_ids), ("metric_ids", metric_ids)):
        if not isinstance(refs, list) or len(refs) != len(set(refs)):
            errors.append(f"{path}.{label}: expected unique string array")
    if not isinstance(claim_ids, list) or not isinstance(evidence_ids, list) or not isinstance(metric_ids, list):
        return
    cited_claims: list[dict[str, Any]] = []
    cited_metrics: list[dict[str, Any]] = []
    for ref in claim_ids:
        claim = claims_by_id.get(ref)
        if claim is None:
            errors.append(f"{path}.claim_ids: unknown claim {ref!r}")
        else:
            cited_claims.append(claim)
            if not claim.get("resume_eligible") or claim.get("status") not in ADMISSIBLE_CLAIM_STATUSES:
                errors.append(f"{path}: inadmissible claim {ref!r}")
    for ref in metric_ids:
        metric = metrics_by_id.get(ref)
        if metric is None:
            errors.append(f"{path}.metric_ids: unknown metric {ref!r}")
        else:
            cited_metrics.append(metric)
            if not metric.get("resume_eligible") or metric.get("status") not in ADMISSIBLE_METRIC_STATUSES:
                errors.append(f"{path}: inadmissible metric {ref!r}")
    for ref in evidence_ids:
        if ref not in evidence_by_id:
            errors.append(f"{path}.evidence_ids: unknown evidence {ref!r}")
    unsupported = refs_supported_by_sources(set(evidence_ids), cited_claims, cited_metrics)
    for ref in sorted(unsupported):
        errors.append(f"{path}: evidence {ref!r} is not attached to a cited claim or metric")
    if require_user and not any(claim.get("scope") in USER_SCOPES for claim in cited_claims):
        errors.append(f"{path}: action clause requires a user-sole or user-partial claim")
    if action_context:
        for claim in cited_claims:
            if claim.get("scope") in USER_SCOPES and claim.get("action_kind") not in ACTION_KINDS:
                errors.append(f"{path}: user action claim {claim.get('id')!r} lacks a precise action kind")
    guard_text(path + ".text", text, cited_claims, cited_metrics, errors, action_context)


def report_path_for(candidates_path: Path, requested: str | None) -> Path:
    if requested:
        return Path(requested).expanduser().resolve()
    if candidates_path.suffix:
        return candidates_path.with_name(candidates_path.stem + ".guard-report.json")
    return candidates_path.with_name(candidates_path.name + ".guard-report.json")


def command_validate_output(args: argparse.Namespace) -> int:
    archive_path = Path(args.archive).expanduser().resolve()
    candidates_path = Path(args.candidates).expanduser().resolve()
    try:
        archive = load_json(archive_path)
        candidates = load_json(candidates_path)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"error: could not read validation input: {exc}", file=sys.stderr)
        return 2
    errors = validate_candidates(archive_path, archive, candidates)
    report_path = report_path_for(candidates_path, args.report)
    report = {
        "guard_version": "1.0.0",
        "status": "fail" if errors else "pass",
        "source_archive_sha256": sha256_file(archive_path),
        "candidates_sha256": sha256_file(candidates_path),
        "checked_at": utc_now(),
        "errors": errors,
    }
    write_json(report_path, report)
    if errors:
        for error in errors:
            print(f"ERROR {error}", file=sys.stderr)
        print(f"guard failed with {len(errors)} error(s); report: {report_path}", file=sys.stderr)
        return 1
    print(f"resume candidates pass deterministic guard; report: {report_path}")
    return 0


def render_candidates(archive: dict[str, Any], candidates: dict[str, Any]) -> str:
    lines = [
        f"# {archive['project']['name']} — Verified Resume Candidates",
        "",
        f"- Source archive SHA-256: `{candidates['source_archive']['sha256']}`",
        f"- Guard: `{candidates['guard']['status']}`",
        f"- Target role: `{candidates['settings']['target_role'] or 'general technical role'}`",
        f"- Focus: `{candidates['settings']['focus'] or 'best-supported evidence'}`",
        "",
        "## One-line project summary",
        "",
    ]
    for summary in candidates["project_summaries"]:
        lines.extend([
            f"- **{summary['language']}**: {summary['text']}",
            f"  - Claims: {', '.join(f'`{value}`' for value in summary['claim_ids']) or 'none'}",
            f"  - Evidence: {', '.join(f'`{value}`' for value in summary['evidence_ids']) or 'none'}",
        ])
    lines.extend(["", "## Candidate bullets", ""])
    for number, group in enumerate(candidates["candidate_groups"], start=1):
        lines.extend([f"### {number}. {group['semantic_group_id']}", "", f"Compression: `{group['compression_method']}`", ""])
        for variant in group["variants"]:
            lines.extend([
                f"- **{variant['language']}**: {variant['text']}",
                f"  - Status: `{'submittable' if variant['submittable'] else 'draft-only'}`",
                f"  - Action sources: {', '.join(f'`{value}`' for value in variant['clauses']['action']['claim_ids'])}",
                f"  - Action evidence: {', '.join(f'`{value}`' for value in variant['clauses']['action']['evidence_ids'])}",
                f"  - Method sources: {', '.join(f'`{value}`' for value in variant['clauses']['method']['claim_ids'])}",
                f"  - Method evidence: {', '.join(f'`{value}`' for value in variant['clauses']['method']['evidence_ids'])}",
                f"  - Result sources: {', '.join(f'`{value}`' for value in variant['clauses']['result']['claim_ids'])}",
                f"  - Result evidence: {', '.join(f'`{value}`' for value in variant['clauses']['result']['evidence_ids'])}",
                f"  - Metrics: {', '.join(f'`{value}`' for value in sorted(flatten_clause_refs(variant, 'metric_ids'))) or 'none'}",
                f"  - Interview follow-up: {'; '.join(variant['interview_questions']) or 'none'}",
                f"  - Risk flags: {'; '.join(variant['risk_flags']) or 'none'}",
            ])
        lines.append("")
    lines.extend(["## Excluded claims", ""])
    if not candidates["excluded_claims"]:
        lines.append("_None._")
    for item in candidates["excluded_claims"]:
        lines.append(f"- `{item['claim_id']}` — {item['reason']}")
    lines.extend(["", "## Warnings", ""])
    if not candidates["warnings"]:
        lines.append("_None._")
    else:
        lines.extend(f"- {warning}" for warning in candidates["warnings"])
    return "\n".join(lines).rstrip() + "\n"


def command_render(args: argparse.Namespace) -> int:
    archive_path = Path(args.archive).expanduser().resolve()
    candidates_path = Path(args.candidates).expanduser().resolve()
    try:
        archive = load_json(archive_path)
        candidates = load_json(candidates_path)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"error: could not read render input: {exc}", file=sys.stderr)
        return 2
    errors = validate_candidates(archive_path, archive, candidates)
    if errors:
        for error in errors:
            print(f"ERROR {error}", file=sys.stderr)
        print("refusing to render candidates that fail the guard", file=sys.stderr)
        return 1
    if candidates.get("guard", {}).get("status") != "pass":
        print("error: guard.status must be 'pass' before rendering", file=sys.stderr)
        return 1
    out = Path(args.out).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(render_candidates(archive, candidates))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_input = subparsers.add_parser("validate-input", help="validate a STAR archive for stage two")
    validate_input.add_argument("--archive", required=True)
    validate_input.set_defaults(func=command_validate_input)

    validate_output = subparsers.add_parser("validate-output", help="guard candidate resume output")
    validate_output.add_argument("--archive", required=True)
    validate_output.add_argument("--candidates", required=True)
    validate_output.add_argument("--report")
    validate_output.set_defaults(func=command_validate_output)

    render = subparsers.add_parser("render", help="render guarded candidates as Markdown")
    render.add_argument("--archive", required=True)
    render.add_argument("--candidates", required=True)
    render.add_argument("--out", required=True)
    render.set_defaults(func=command_render)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
