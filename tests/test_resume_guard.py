from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

from tests.fixture_data import make_archive, make_candidates, write_json


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "skills/star-to-resume/scripts/resume_guard.py"
SPEC = importlib.util.spec_from_file_location("resume_guard", SCRIPT)
assert SPEC and SPEC.loader
resume_guard = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = resume_guard
SPEC.loader.exec_module(resume_guard)


class ResumeInputGateTests(unittest.TestCase):
    def test_rejects_free_text_and_old_schema(self) -> None:
        self.assertTrue(resume_guard.validate_archive("I built a database"))
        archive = make_archive()
        archive["schema_version"] = "0.9.0"
        self.assertTrue(any("schema_version" in error for error in resume_guard.validate_archive(archive)))

    def test_accepts_valid_stage_one_archive(self) -> None:
        self.assertEqual(resume_guard.validate_archive(make_archive()), [])


class ResumeGuardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary.name)
        self.archive_path = self.directory / "star-project.json"
        write_json(self.archive_path, make_archive())

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def valid_candidates(self, both: bool = True, passed: bool = True):
        return make_candidates(self.archive_path, both=both, passed=passed)

    def guard(self, candidates):
        return resume_guard.validate_candidates(self.archive_path, make_archive(), candidates)

    def test_valid_bilingual_candidates_and_verified_metrics_pass(self) -> None:
        self.assertEqual(self.guard(self.valid_candidates()), [])

    def test_output_schema_rejects_unknown_fields(self) -> None:
        candidates = self.valid_candidates()
        candidates["candidate_groups"][0]["variants"][0]["marketing_score"] = 99
        errors = self.guard(candidates)
        self.assertTrue(any("additional property" in error for error in errors))

    def test_unverified_readme_metric_is_rejected(self) -> None:
        candidates = self.valid_candidates()
        result = candidates["candidate_groups"][0]["variants"][0]["clauses"]["result"]
        result["metric_ids"] = ["m-readme-target"]
        result["text"] = "达到 10x 提升"
        errors = self.guard(candidates)
        self.assertTrue(any("inadmissible metric" in error for error in errors))

    def test_user_confirmed_number_is_rejected(self) -> None:
        candidates = self.valid_candidates(both=False)
        result = candidates["candidate_groups"][1]["variants"][0]["clauses"]["result"]
        result["metric_ids"] = ["m-user-number"]
        result["text"] = "Reached 1000 ops/s"
        errors = self.guard(candidates)
        self.assertTrue(any("inadmissible metric" in error for error in errors))

    def test_injected_number_is_rejected(self) -> None:
        candidates = self.valid_candidates(both=False)
        variant = candidates["candidate_groups"][2]["variants"][0]
        variant["text"] += " for 500 users"
        errors = self.guard(candidates)
        self.assertTrue(any("numeric token" in error and "500" in error for error in errors))

    def test_approximate_or_range_metric_wording_is_rejected(self) -> None:
        candidates = self.valid_candidates(both=False)
        variant = candidates["candidate_groups"][0]["variants"][0]
        variant["text"] = "Implemented bounded parsing with about 20 ms to 10 ms latency."
        errors = self.guard(candidates)
        self.assertTrue(any("approximate or range" in error for error in errors))

    def test_strong_ownership_verb_is_rejected_without_evidence(self) -> None:
        candidates = self.valid_candidates(both=False)
        variant = candidates["candidate_groups"][2]["variants"][0]
        variant["text"] = "Led the cache architecture and fixed invalidation."
        errors = self.guard(candidates)
        self.assertTrue(any("strong verb 'led'" in error for error in errors))
        self.assertTrue(any("architecture wording" in error for error in errors))

    def test_dependency_integration_cannot_be_escalated_to_implementation(self) -> None:
        candidates = self.valid_candidates(both=False)
        variant = candidates["candidate_groups"][1]["variants"][0]
        variant["clauses"]["action"]["text"] = "Implemented SQLite"
        variant["text"] = "Implemented SQLite and validated storage boundaries with 12 deterministic tests."
        errors = self.guard(candidates)
        self.assertTrue(any("implementation wording exceeds" in error or "escalated" in error for error in errors))

    def test_function_tests_do_not_allow_production_claim(self) -> None:
        candidates = self.valid_candidates(both=False)
        variant = candidates["candidate_groups"][1]["variants"][0]
        variant["text"] += " for production reliability"
        errors = self.guard(candidates)
        self.assertTrue(any("production wording" in error for error in errors))
        self.assertTrue(any("reliability wording" in error for error in errors))

    def test_scale_and_causal_language_require_matching_evidence(self) -> None:
        candidates = self.valid_candidates(both=False)
        variant = candidates["candidate_groups"][2]["variants"][0]
        variant["text"] += " at scale, thereby enabled business growth"
        errors = self.guard(candidates)
        self.assertTrue(any("scale wording" in error for error in errors))
        self.assertTrue(any("causal wording" in error for error in errors))

    def test_bilingual_variants_must_use_identical_sources(self) -> None:
        candidates = self.valid_candidates()
        candidates["candidate_groups"][2]["variants"][0]["clauses"]["method"]["claim_ids"].append("c-confirmed-role")
        candidates["candidate_groups"][2]["variants"][0]["clauses"]["method"]["evidence_ids"].append("ev-confirm")
        errors = self.guard(candidates)
        self.assertTrue(any("bilingual variants" in error for error in errors))

    def test_no_number_capability_bullet_is_valid(self) -> None:
        candidates = self.valid_candidates(both=False)
        candidates["candidate_groups"] = [candidates["candidate_groups"][1], candidates["candidate_groups"][2]]
        candidates["settings"]["bullet_count"] = 2
        candidates["excluded_claims"].append({"claim_id": "c-parser", "reason": "Omitted for this two-bullet variant."})
        self.assertEqual(self.guard(candidates), [])

    def test_every_unselected_claim_requires_an_exclusion_reason(self) -> None:
        candidates = self.valid_candidates(both=False)
        candidates["excluded_claims"] = [
            item for item in candidates["excluded_claims"] if item["claim_id"] != "c-production"
        ]
        errors = self.guard(candidates)
        self.assertTrue(any("omitted unselected claim 'c-production'" in error for error in errors))

    def test_draft_can_be_guarded_but_cannot_be_rendered(self) -> None:
        candidates = self.valid_candidates(both=False, passed=False)
        self.assertEqual(self.guard(candidates), [])
        candidates_path = self.directory / "resume-candidates.json"
        output_path = self.directory / "resume-candidates.md"
        write_json(candidates_path, candidates)
        args = type("Args", (), {"archive": str(self.archive_path), "candidates": str(candidates_path), "out": str(output_path)})()
        self.assertEqual(resume_guard.command_render(args), 1)
        self.assertFalse(output_path.exists())

    def test_passed_candidates_render_and_report_sources(self) -> None:
        candidates = self.valid_candidates(both=False)
        candidates_path = self.directory / "resume-candidates.json"
        output_path = self.directory / "resume-candidates.md"
        write_json(candidates_path, candidates)
        args = type("Args", (), {"archive": str(self.archive_path), "candidates": str(candidates_path), "out": str(output_path)})()
        self.assertEqual(resume_guard.command_render(args), 0)
        rendered = output_path.read_text(encoding="utf-8")
        self.assertIn("Source archive SHA-256", rendered)
        self.assertIn("c-integration", rendered)

    def test_hash_mismatch_is_rejected(self) -> None:
        candidates = self.valid_candidates(both=False)
        candidates["source_archive"]["sha256"] = "0" * 64
        errors = self.guard(candidates)
        self.assertTrue(any("source_archive.sha256" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
