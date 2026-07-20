from __future__ import annotations

import hashlib
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

from tests.fixture_data import make_archive, write_json


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "skills/repository-to-star/scripts/repo_evidence.py"
SPEC = importlib.util.spec_from_file_location("repo_evidence", SCRIPT)
assert SPEC and SPEC.loader
repo_evidence = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = repo_evidence
SPEC.loader.exec_module(repo_evidence)


class StarArchiveValidationTests(unittest.TestCase):
    def test_complete_synthetic_archive_is_valid(self) -> None:
        self.assertEqual(repo_evidence.validate_archive(make_archive()), [])

    def test_schema_rejects_unknown_fields(self) -> None:
        archive = make_archive()
        archive["project"]["plausible_but_unsupported"] = True
        errors = repo_evidence.validate_archive(archive)
        self.assertTrue(any("additional property" in error for error in errors))

    def test_evidence_digest_is_recomputed_not_format_checked(self) -> None:
        archive = make_archive()
        archive["evidence"][0]["excerpt"] = "Tampered after collection."
        errors = repo_evidence.validate_archive(archive)
        self.assertTrue(any("canonical-record digest mismatch" in error for error in errors))

    def test_file_byte_digest_is_checked_against_locator(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / "starter.txt"
            artifact.write_text("starter bytes\n", encoding="utf-8")
            archive = make_archive(directory)
            item = archive["evidence"][0]
            item["locator"] = {"path": "starter.txt"}
            item["digest_basis"] = "file-bytes"
            item["sha256"] = hashlib.sha256(artifact.read_bytes()).hexdigest()
            self.assertEqual(repo_evidence.validate_archive(archive), [])
            artifact.write_text("changed bytes\n", encoding="utf-8")
            errors = repo_evidence.validate_archive(archive)
            self.assertTrue(any("file-bytes digest mismatch" in error for error in errors))

    def test_starter_feature_cannot_become_user_contribution(self) -> None:
        archive = make_archive()
        archive["contributions"][0]["claim_ids"].append("c-starter")
        errors = repo_evidence.validate_archive(archive)
        self.assertTrue(any("only user-scoped" in error for error in errors))

    def test_dependency_capability_cannot_be_claimed_as_implementation(self) -> None:
        archive = make_archive()
        target = next(item for item in archive["claims"] if item["id"] == "c-integration")
        target["scope"] = "third-party"
        target["action_kind"] = "implemented"
        errors = repo_evidence.validate_archive(archive)
        self.assertTrue(any("third-party capability" in error for error in errors))

    def test_teammate_module_cannot_be_upgraded_to_user_architecture(self) -> None:
        archive = make_archive()
        archive["contributions"][2]["claim_ids"].append("c-team-architecture")
        errors = repo_evidence.validate_archive(archive)
        self.assertTrue(any("only user-scoped" in error for error in errors))

    def test_todo_or_target_cannot_enter_result(self) -> None:
        archive = make_archive()
        archive["star"]["result"][0]["text"] = "Planned target: 10x faster"
        errors = repo_evidence.validate_archive(archive)
        self.assertTrue(any("planned, target, or theoretical" in error for error in errors))

    def test_function_test_does_not_support_production_reliability(self) -> None:
        archive = make_archive()
        archive["star"]["result"][1]["text"] = "The system achieved production reliability by passing 12 tests."
        errors = repo_evidence.validate_archive(archive)
        self.assertTrue(any("production wording" in error for error in errors))
        self.assertTrue(any("reliability wording" in error for error in errors))

    def test_readme_theoretical_number_is_not_resume_eligible(self) -> None:
        archive = make_archive()
        metric = next(item for item in archive["metrics"] if item["id"] == "m-readme-target")
        metric["resume_eligible"] = True
        errors = repo_evidence.validate_archive(archive)
        self.assertTrue(any("only verified-measured or verified-count" in error for error in errors))

    def test_user_confirmed_number_is_not_resume_eligible(self) -> None:
        archive = make_archive()
        metric = next(item for item in archive["metrics"] if item["id"] == "m-user-number")
        metric["resume_eligible"] = True
        errors = repo_evidence.validate_archive(archive)
        self.assertTrue(any("only verified-measured or verified-count" in error for error in errors))

    def test_measured_performance_requires_baseline_method_and_raw_evidence(self) -> None:
        archive = make_archive()
        metric = next(item for item in archive["metrics"] if item["id"] == "m-latency")
        metric["baseline"] = None
        metric["measurement_method"] = None
        errors = repo_evidence.validate_archive(archive)
        self.assertTrue(any("verified measurement requires" in error for error in errors))
        self.assertTrue(any("requires a baseline" in error for error in errors))

    def test_qualitative_user_confirmation_is_admissible(self) -> None:
        archive = make_archive()
        claim = next(item for item in archive["claims"] if item["id"] == "c-confirmed-role")
        self.assertTrue(claim["resume_eligible"])
        self.assertEqual(repo_evidence.validate_archive(archive), [])

    def test_empty_no_git_archive_degrades_without_fabricating_claims(self) -> None:
        archive = make_archive("/synthetic/no-git")
        archive["project"]["revision"] = ""
        archive["identity"] = {"names": [], "emails": [], "github_handle": None, "status": "missing"}
        archive["evidence"] = []
        archive["claims"] = []
        archive["contributions"] = []
        archive["metrics"] = []
        archive["star"] = {"situation": [], "task": [], "action": [], "result": []}
        archive["open_questions"] = []
        archive["interview_topics"] = []
        archive["execution_log"] = []
        self.assertEqual(repo_evidence.validate_archive(archive), [])

    def test_github_not_requested_has_an_exact_execution_status(self) -> None:
        archive = make_archive()
        archive["execution_log"].append({
            "id": "run-github",
            "kind": "github",
            "command": None,
            "cwd": None,
            "approval": "not-requested",
            "status": "not-requested",
            "exit_code": None,
            "stdout_path": None,
            "stderr_path": None,
            "timestamp": "2026-07-20T00:00:00Z",
        })
        self.assertEqual(repo_evidence.validate_archive(archive), [])

    def test_renderer_refuses_invalid_archive(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive = make_archive()
            archive["schema_version"] = "0.9.0"
            source = Path(directory) / "star-project.json"
            output = Path(directory) / "star-project.md"
            write_json(source, archive)
            args = type("Args", (), {"archive": str(source), "out": str(output)})()
            self.assertEqual(repo_evidence.command_render(args), 1)
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
