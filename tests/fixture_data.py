from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
from typing import Any


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def evidence(evidence_id: str, evidence_type: str, title: str, excerpt: str) -> dict[str, Any]:
    item = {
        "id": evidence_id,
        "type": evidence_type,
        "availability": "collected",
        "title": title,
        "locator": {"path": title},
        "digest_basis": "user-confirmation-text" if evidence_type == "user-confirmation" else "canonical-record",
        "sha256": None,
        "excerpt": excerpt,
        "collected_at": "2026-07-20T00:00:00Z",
    }
    if evidence_type == "user-confirmation":
        item["sha256"] = hashlib.sha256(excerpt.encode("utf-8")).hexdigest()
    else:
        payload = {key: item[key] for key in ("type", "title", "locator", "excerpt")}
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        item["sha256"] = hashlib.sha256(encoded).hexdigest()
    return item


def claim(
    claim_id: str,
    text: str,
    scope: str,
    status: str,
    ownership: str,
    action_kind: str,
    evidence_ids: list[str],
    eligible: bool,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "id": claim_id,
        "text": text,
        "scope": scope,
        "status": status,
        "ownership_level": ownership,
        "action_kind": action_kind,
        "tags": tags or [],
        "evidence_ids": evidence_ids,
        "confidence": "high" if status == "verified" else "medium",
        "confidence_reason": "Synthetic fixture evidence explicitly supports this narrow claim.",
        "resume_eligible": eligible,
    }


def star_item(
    item_id: str,
    text: str,
    claim_ids: list[str],
    evidence_ids: list[str],
    metric_ids: list[str] | None = None,
    status: str = "verified",
    eligible: bool = True,
) -> dict[str, Any]:
    return {
        "id": item_id,
        "text": text,
        "claim_ids": claim_ids,
        "evidence_ids": evidence_ids,
        "metric_ids": metric_ids or [],
        "status": status,
        "resume_eligible": eligible,
    }


def make_archive(repo_root: str = "/synthetic/course-index") -> dict[str, Any]:
    archive = {
        "schema_version": "1.0.0",
        "project": {
            "id": "course-index",
            "name": "Course Index",
            "repo_root": repo_root,
            "revision": "1234567890abcdef",
            "repository_kind": "course",
            "remote_url": None,
        },
        "analysis_scope": {
            "start_date": None,
            "end_date": None,
            "starter_ref": "starter",
            "upstream_ref": None,
            "github_availability": "unavailable",
            "execution_policy": "ask-before-execute",
            "collected_at": "2026-07-20T00:00:00Z",
        },
        "identity": {
            "names": ["Student Dev"],
            "emails": ["student@example.test", "student+school@example.test"],
            "github_handle": None,
            "status": "confirmed",
        },
        "evidence": [
            evidence("ev-starter", "upstream", "starter/src/core.cpp", "Parser and lookup existed in starter."),
            evidence("ev-parser-diff", "diff", "src/parser.cpp", "Student added bounded token parsing."),
            evidence("ev-dependency", "dependency", "src/storage.cpp", "Student called SQLite through a wrapper."),
            evidence("ev-test", "test", "tests/test_index.cpp", "12 deterministic tests passed."),
            evidence("ev-benchmark", "benchmark", "benchmarks/raw.json", "Baseline 20 ms; result 10 ms."),
            evidence("ev-fix-diff", "diff", "src/cache.cpp", "Student fixed an invalidation bug in teammate-owned cache code."),
            evidence("ev-confirm", "user-confirmation", "user confirmation 1", "I was responsible for parser boundary validation."),
            evidence("ev-readme", "file", "README.md", "A future target says 10x faster, without raw measurement."),
        ],
        "claims": [
            claim("c-project", "The course project provides parsing, indexed lookup, and persistent storage.", "project", "verified", "none", "none", ["ev-starter", "ev-dependency"], True),
            claim("c-starter", "Parsing and lookup existed in the supplied starter.", "starter", "verified", "none", "none", ["ev-starter"], False),
            claim("c-parser", "The user implemented bounded token parsing in the assigned parser module.", "user-partial", "verified", "shared", "implemented", ["ev-parser-diff"], True),
            claim("c-integration", "The user integrated SQLite through the project storage wrapper.", "user-partial", "verified", "contributor", "integrated", ["ev-dependency"], True, ["dependency-integration"]),
            claim("c-tests", "The user added and ran deterministic correctness tests for parser and storage boundaries.", "user-partial", "verified", "contributor", "tested", ["ev-test"], True),
            claim("c-fix", "The user debugged and fixed cache invalidation in a module originally implemented by a teammate.", "user-partial", "verified", "contributor", "debugged", ["ev-fix-diff", "ev-test"], True),
            claim("c-team-architecture", "The team used a parser, index, storage, and cache architecture.", "team", "verified", "shared", "none", ["ev-starter", "ev-dependency"], True),
            claim("c-confirmed-role", "The user was responsible for parser boundary validation.", "user-partial", "user-confirmed", "contributor", "tested", ["ev-confirm"], True),
            claim("c-planned", "A 10x speedup was documented as a future target.", "project", "inferred", "none", "none", ["ev-readme"], False),
            claim("c-production", "The project may be production reliable.", "unknown", "unknown", "unknown", "none", [], False),
        ],
        "contributions": [
            {
                "id": "con-parser",
                "summary": "Bounded parser implementation and validation",
                "claim_ids": ["c-parser", "c-confirmed-role"],
                "evidence_ids": ["ev-parser-diff", "ev-confirm"],
                "paths": ["src/parser.cpp"],
                "symbols": ["Parser::parseToken"],
                "commit_ids": ["commit-user-parser"],
            },
            {
                "id": "con-storage",
                "summary": "SQLite wrapper integration and correctness tests",
                "claim_ids": ["c-integration", "c-tests"],
                "evidence_ids": ["ev-dependency", "ev-test"],
                "paths": ["src/storage.cpp", "tests/test_index.cpp"],
                "symbols": ["Storage::put"],
                "commit_ids": ["commit-user-storage"],
            },
            {
                "id": "con-cache-fix",
                "summary": "Targeted cache invalidation bug fix",
                "claim_ids": ["c-fix"],
                "evidence_ids": ["ev-fix-diff", "ev-test"],
                "paths": ["src/cache.cpp"],
                "symbols": ["Cache::invalidate"],
                "commit_ids": ["commit-user-fix"],
            },
        ],
        "metrics": [
            {
                "id": "m-latency",
                "name": "parser fixture latency",
                "kind": "performance",
                "status": "verified-measured",
                "value": 10,
                "unit": "ms",
                "baseline": 20,
                "result": 10,
                "measurement_method": "Median of the fixed synthetic input using the recorded benchmark command.",
                "evidence_ids": ["ev-benchmark"],
                "resume_eligible": True,
            },
            {
                "id": "m-tests",
                "name": "deterministic correctness tests",
                "kind": "count",
                "status": "verified-count",
                "value": 12,
                "unit": "tests",
                "baseline": None,
                "result": None,
                "measurement_method": "Counted from recorded test output.",
                "evidence_ids": ["ev-test"],
                "resume_eligible": True,
            },
            {
                "id": "m-readme-target",
                "name": "README future speedup target",
                "kind": "performance",
                "status": "documented-unverified",
                "value": "10x",
                "unit": None,
                "baseline": None,
                "result": None,
                "measurement_method": None,
                "evidence_ids": ["ev-readme"],
                "resume_eligible": False,
            },
            {
                "id": "m-user-number",
                "name": "remembered throughput",
                "kind": "performance",
                "status": "user-confirmed",
                "value": 1000,
                "unit": "ops/s",
                "baseline": None,
                "result": None,
                "measurement_method": None,
                "evidence_ids": ["ev-confirm"],
                "resume_eligible": False,
            },
        ],
        "star": {
            "situation": [
                star_item("s-1", "The starter supplied the core parser and lookup path, so project capability was separated from student work.", ["c-starter", "c-project"], ["ev-starter"], eligible=False)
            ],
            "task": [
                star_item("t-1", "The user was responsible for parser boundary validation.", ["c-confirmed-role"], ["ev-confirm"], status="user-confirmed")
            ],
            "action": [
                star_item("a-1", "Implemented bounded token parsing in the assigned module.", ["c-parser"], ["ev-parser-diff"]),
                star_item("a-2", "Integrated SQLite through the existing storage wrapper and tested boundary behavior.", ["c-integration", "c-tests"], ["ev-dependency", "ev-test"]),
                star_item("a-3", "Debugged and fixed cache invalidation without claiming the teammate-owned module architecture.", ["c-fix"], ["ev-fix-diff", "ev-test"]),
            ],
            "result": [
                star_item("r-1", "Measured parser fixture latency changed from 20 ms to 10 ms under the recorded method.", ["c-parser"], ["ev-parser-diff", "ev-benchmark"], ["m-latency"]),
                star_item("r-2", "The parser and storage boundaries passed 12 deterministic tests.", ["c-tests"], ["ev-test"], ["m-tests"]),
                star_item("r-3", "The confirmed cache invalidation defect was eliminated in the tested fixture.", ["c-fix"], ["ev-fix-diff", "ev-test"]),
            ],
        },
        "open_questions": [
            {"id": "q-1", "question": "Was the parser design assigned or proposed by the user?", "affects_claim_ids": ["c-parser"], "status": "open"}
        ],
        "interview_topics": [
            {"id": "i-1", "topic": "Parser boundary handling", "claim_ids": ["c-parser", "c-confirmed-role"], "questions": ["Which malformed inputs were rejected?", "Why was the parser change bounded to one module?"]},
            {"id": "i-2", "topic": "Benchmark limits", "claim_ids": ["c-parser"], "questions": ["How was the fixture held constant?", "Why is this not a production performance claim?"]},
        ],
        "execution_log": [
            {
                "id": "run-1",
                "kind": "benchmark",
                "command": "./bench_parser --fixture fixed.txt",
                "cwd": repo_root,
                "approval": "approved",
                "status": "completed",
                "exit_code": 0,
                "stdout_path": "benchmarks/raw.json",
                "stderr_path": None,
                "timestamp": "2026-07-20T00:00:00Z",
            }
        ],
    }
    return archive


def sourced(language: str, text: str, claim_ids: list[str], evidence_ids: list[str], metric_ids: list[str] | None = None) -> dict[str, Any]:
    return {
        "language": language,
        "text": text,
        "claim_ids": claim_ids,
        "evidence_ids": evidence_ids,
        "metric_ids": metric_ids or [],
    }


def clause(text: str, claim_ids: list[str], evidence_ids: list[str], metric_ids: list[str] | None = None) -> dict[str, Any]:
    return {"text": text, "claim_ids": claim_ids, "evidence_ids": evidence_ids, "metric_ids": metric_ids or []}


def candidate(candidate_id: str, language: str, text: str, action: dict[str, Any], method: dict[str, Any], result: dict[str, Any], submittable: bool) -> dict[str, Any]:
    return {
        "id": candidate_id,
        "language": language,
        "text": text,
        "clauses": {"action": action, "method": method, "result": result},
        "interview_questions": ["What did the cited diff change?", "What are the evidence limits?"],
        "risk_flags": [],
        "submittable": submittable,
    }


def make_candidates(archive_path: Path, both: bool = True, passed: bool = True) -> dict[str, Any]:
    languages = ["zh-CN", "en"] if both else ["en"]
    summaries = []
    if "zh-CN" in languages:
        summaries.append(sourced("zh-CN", "基于课程 starter 扩展的索引项目，包含解析、持久化与缓存能力。", ["c-project"], ["ev-starter", "ev-dependency"]))
    if "en" in languages:
        summaries.append(sourced("en", "A course index extending a supplied starter with parsing, persistence, and caching capabilities.", ["c-project"], ["ev-starter", "ev-dependency"]))

    group_specs = [
        (
            "parser-latency", "action-method-result",
            {
                "zh-CN": (
                    "在分配的解析模块中实现有界 token 解析，通过固定合成输入将延迟从 20 ms 降至 10 ms。",
                    clause("实现有界 token 解析", ["c-parser"], ["ev-parser-diff"]),
                    clause("使用固定合成输入验证解析路径", ["c-parser"], ["ev-parser-diff"]),
                    clause("延迟从 20 ms 降至 10 ms", ["c-parser"], ["ev-parser-diff", "ev-benchmark"], ["m-latency"]),
                ),
                "en": (
                    "Implemented bounded token parsing in the assigned module, reducing fixed-fixture latency from 20 ms to 10 ms under the recorded benchmark method.",
                    clause("Implemented bounded token parsing", ["c-parser"], ["ev-parser-diff"]),
                    clause("Used a fixed synthetic input under the recorded method", ["c-parser"], ["ev-parser-diff"]),
                    clause("Reduced latency from 20 ms to 10 ms", ["c-parser"], ["ev-parser-diff", "ev-benchmark"], ["m-latency"]),
                ),
            },
        ),
        (
            "storage-tests", "action-method-verified-capability",
            {
                "zh-CN": (
                    "通过现有存储封装集成 SQLite，并用 12 项确定性测试验证解析与存储边界。",
                    clause("集成 SQLite", ["c-integration"], ["ev-dependency"]),
                    clause("通过现有存储封装并编写边界测试", ["c-integration", "c-tests"], ["ev-dependency", "ev-test"]),
                    clause("通过 12 项确定性测试", ["c-tests"], ["ev-test"], ["m-tests"]),
                ),
                "en": (
                    "Integrated SQLite through the existing storage wrapper and validated parser and storage boundaries with 12 deterministic tests.",
                    clause("Integrated SQLite", ["c-integration"], ["ev-dependency"]),
                    clause("Used the existing wrapper and added boundary tests", ["c-integration", "c-tests"], ["ev-dependency", "ev-test"]),
                    clause("Passed 12 deterministic tests", ["c-tests"], ["ev-test"], ["m-tests"]),
                ),
            },
        ),
        (
            "cache-fix", "action-method-verified-capability",
            {
                "zh-CN": (
                    "定位并修复队友模块中的缓存失效缺陷，通过回归测试确认目标错误路径已消除。",
                    clause("定位并修复缓存失效缺陷", ["c-fix"], ["ev-fix-diff", "ev-test"]),
                    clause("限制修改范围并执行回归测试", ["c-fix"], ["ev-fix-diff", "ev-test"]),
                    clause("确认目标错误路径已消除", ["c-fix"], ["ev-fix-diff", "ev-test"]),
                ),
                "en": (
                    "Debugged and fixed cache invalidation in a module implemented by a teammate, using regression tests to confirm the targeted failure path was eliminated.",
                    clause("Debugged and fixed cache invalidation", ["c-fix"], ["ev-fix-diff", "ev-test"]),
                    clause("Kept the change scoped and ran regression tests", ["c-fix"], ["ev-fix-diff", "ev-test"]),
                    clause("Confirmed the targeted failure path was eliminated", ["c-fix"], ["ev-fix-diff", "ev-test"]),
                ),
            },
        ),
    ]
    groups = []
    for group_id, method, variants_by_language in group_specs:
        variants = []
        for language in languages:
            text, action, method_clause, result = variants_by_language[language]
            variants.append(candidate(f"{group_id}-{language}", language, text, action, method_clause, result, passed))
        groups.append({"semantic_group_id": group_id, "compression_method": method, "variants": variants})
    return {
        "schema_version": "1.0.0",
        "source_archive": {"path": str(archive_path.resolve()), "sha256": file_sha256(archive_path)},
        "settings": {"target_role": "systems engineer", "languages": languages, "bullet_count": 3, "focus": "correctness and measured performance"},
        "project_summaries": summaries,
        "candidate_groups": groups,
        "excluded_claims": [
            {"claim_id": "c-starter", "reason": "Starter functionality is not a user contribution."},
            {"claim_id": "c-team-architecture", "reason": "Valid team context, but not selected for the concise candidate set."},
            {"claim_id": "c-confirmed-role", "reason": "Qualitative responsibility is supported but redundant with the selected parser action."},
            {"claim_id": "c-planned", "reason": "Future target is inferred and unmeasured."},
            {"claim_id": "c-production", "reason": "Production reliability is unknown."},
        ],
        "warnings": ["Measured latency applies only to the fixed synthetic fixture."],
        "guard": {"version": "1.0.0", "status": "pass" if passed else "draft", "errors": [], "checked_at": "2026-07-20T00:00:00Z" if passed else None},
    }


def git(repo: Path, *args: str, name: str = "Fixture", email: str = "fixture@example.test") -> str:
    environment = {
        "GIT_AUTHOR_NAME": name,
        "GIT_AUTHOR_EMAIL": email,
        "GIT_COMMITTER_NAME": name,
        "GIT_COMMITTER_EMAIL": email,
        "GIT_AUTHOR_DATE": "2026-01-01T00:00:00Z",
        "GIT_COMMITTER_DATE": "2026-01-01T00:00:00Z",
    }
    import os
    merged_environment = os.environ.copy()
    merged_environment.update(environment)
    completed = subprocess.run(["git", "-C", str(repo), *args], check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=merged_environment)
    return completed.stdout.strip()


def create_git_fixture(repo: Path) -> dict[str, str]:
    repo.mkdir(parents=True)
    git(repo, "init", "-q")
    (repo / "src").mkdir()
    (repo / "src/core.cpp").write_text("int lookup(int key) { return key; }\n", encoding="utf-8")
    (repo / "README.md").write_text("# Starter\n\nFuture target: 10x faster.\n", encoding="utf-8")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "starter: provide core lookup", name="Course Staff", email="staff@example.test")
    starter = git(repo, "rev-parse", "HEAD")
    git(repo, "tag", "starter")

    (repo / "src/parser.cpp").write_text("int parse(int token) { return token < 0 ? 0 : token; }\n", encoding="utf-8")
    git(repo, "add", "src/parser.cpp")
    git(repo, "commit", "-qm", "implement bounded parser", name="Student Dev", email="student@example.test")
    first_user = git(repo, "rev-parse", "HEAD")

    (repo / "src/cache.cpp").write_text("int cache_get(int key) { return key; }\n", encoding="utf-8")
    git(repo, "add", "src/cache.cpp")
    git(repo, "commit", "-qm", "add cache module", name="Team Mate", email="teammate@example.test")
    teammate = git(repo, "rev-parse", "HEAD")

    (repo / "src/cache.cpp").write_text("int cache_get(int key) { return key < 0 ? -1 : key; }\n", encoding="utf-8")
    git(repo, "add", "src/cache.cpp")
    git(repo, "commit", "-qm", "fix cache invalidation\n\nCo-authored-by: Team Mate <teammate@example.test>", name="Student Dev", email="student+school@example.test")
    second_user = git(repo, "rev-parse", "HEAD")
    (repo / "src/shared.cpp").write_text("int shared_path() { return 1; }\n", encoding="utf-8")
    git(repo, "add", "src/shared.cpp")
    git(repo, "commit", "-qm", "add shared path\n\nCo-authored-by: Student Dev <student@example.test>", name="Team Mate", email="teammate@example.test")
    coauthor_only = git(repo, "rev-parse", "HEAD")
    return {
        "starter": starter,
        "first_user": first_user,
        "teammate": teammate,
        "second_user": second_user,
        "coauthor_only": coauthor_only,
    }
