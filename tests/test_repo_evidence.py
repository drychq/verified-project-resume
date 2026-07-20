from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from tests.fixture_data import create_git_fixture, write_json


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "skills/repository-to-star/scripts/repo_evidence.py"
NO_GIT_FIXTURE = ROOT / "tests/fixtures/no-git-repository"


def run_script(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(SCRIPT), *args], text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


class InventoryTests(unittest.TestCase):
    def test_inventory_classifies_without_executing_project(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "inventory.json"
            completed = run_script("inventory", "--repo", str(NO_GIT_FIXTURE), "--out", str(output))
            self.assertEqual(completed.returncode, 0, completed.stderr)
            payload = json.loads(output.read_text(encoding="utf-8"))
            categories = {item["path"]: item["category"] for item in payload["files"]}
            self.assertEqual(categories["README.md"], "documentation")
            self.assertEqual(categories["src/index.cpp"], "source")
            self.assertEqual(categories["tests/test_index.cpp"], "test")
            self.assertEqual(categories["benchmarks/README.md"], "benchmark")
            self.assertEqual(categories["vendor/tinydb.h"], "vendor")
            self.assertEqual(payload["collection_policy"], "read-only-no-project-execution")

    def test_git_collection_degrades_when_git_is_absent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            identity = Path(directory) / "identity.json"
            output = Path(directory) / "git.json"
            write_json(identity, {"names": ["Student Dev"], "emails": [], "github_handle": None, "status": "partial"})
            completed = run_script("git", "--repo", str(NO_GIT_FIXTURE), "--identity", str(identity), "--out", str(output))
            self.assertEqual(completed.returncode, 0, completed.stderr)
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(payload["availability"], "unavailable")
            self.assertEqual(payload["reason"], "path is not the root of a standalone Git work tree")
            self.assertEqual(payload["identity_commits"], [])

    def test_git_collection_degrades_when_git_executable_is_unavailable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            identity = Path(directory) / "identity.json"
            output = Path(directory) / "git.json"
            write_json(identity, {"names": ["Student Dev"], "emails": [], "github_handle": None, "status": "partial"})
            environment = os.environ.copy()
            environment["PATH"] = ""
            completed = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "git",
                    "--repo",
                    str(NO_GIT_FIXTURE),
                    "--identity",
                    str(identity),
                    "--out",
                    str(output),
                ],
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=environment,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(payload["availability"], "unavailable")
            self.assertEqual(payload["reason"], "git executable is unavailable")


class GitEvidenceTests(unittest.TestCase):
    def test_multiple_emails_coauthors_and_starter_diff_are_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory) / "repo"
            commits = create_git_fixture(repo)
            identity = Path(directory) / "identity.json"
            output = Path(directory) / "git.json"
            write_json(identity, {
                "names": ["Student Dev"],
                "emails": ["student@example.test", "student+school@example.test"],
                "github_handle": None,
                "status": "confirmed",
            })
            completed = run_script(
                "git", "--repo", str(repo), "--identity", str(identity), "--starter-ref", "starter", "--out", str(output)
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(payload["identity_commit_count"], 3)
            self.assertEqual(
                {item["sha"] for item in payload["identity_commits"]},
                {commits["first_user"], commits["second_user"], commits["coauthor_only"]},
            )
            self.assertNotIn(commits["teammate"], {item["sha"] for item in payload["identity_commits"]})
            second = next(item for item in payload["identity_commits"] if item["sha"] == commits["second_user"])
            self.assertEqual(second["coauthors"], [{"name": "Team Mate", "email": "teammate@example.test"}])
            coauthor_only = next(item for item in payload["identity_commits"] if item["sha"] == commits["coauthor_only"])
            self.assertIn("coauthor-email", coauthor_only["identity_match_reasons"])
            baseline = payload["baselines"][0]
            self.assertEqual(baseline["availability"], "collected")
            self.assertEqual(baseline["resolved_sha"], commits["starter"])
            changed = {item["path"] for item in baseline["changed_files"]}
            self.assertEqual(changed, {"src/parser.cpp", "src/cache.cpp", "src/shared.cpp"})
            self.assertTrue(any("does not prove sole authorship" in item for item in payload["limitations"]))
            self.assertTrue(any("Squash" in item for item in payload["limitations"]))

    def test_missing_identity_does_not_claim_commits(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory) / "repo"
            create_git_fixture(repo)
            identity = Path(directory) / "identity.json"
            output = Path(directory) / "git.json"
            write_json(identity, {"names": [], "emails": [], "github_handle": None, "status": "missing"})
            completed = run_script("git", "--repo", str(repo), "--identity", str(identity), "--out", str(output))
            self.assertEqual(completed.returncode, 0, completed.stderr)
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(payload["identity_commit_count"], 0)
            self.assertGreater(payload["commit_count"], 0)


if __name__ == "__main__":
    unittest.main()
