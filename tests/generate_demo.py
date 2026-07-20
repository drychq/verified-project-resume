#!/usr/bin/env python3
"""Regenerate the checked-in synthetic STAR-to-resume demonstration."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys

from tests.fixture_data import make_archive, make_candidates, write_json


ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "examples/synthetic-demo"


def load_module(name: str, path: Path):
    specification = importlib.util.spec_from_file_location(name, path)
    if specification is None or specification.loader is None:
        raise RuntimeError(f"could not load {path}")
    module = importlib.util.module_from_spec(specification)
    sys.modules[name] = module
    specification.loader.exec_module(module)
    return module


def main() -> int:
    repo_module = load_module("demo_repo_evidence", ROOT / "skills/repository-to-star/scripts/repo_evidence.py")
    resume_module = load_module("demo_resume_guard", ROOT / "skills/star-to-resume/scripts/resume_guard.py")
    DEMO.mkdir(parents=True, exist_ok=True)
    archive_path = DEMO / "star-project.json"
    archive = make_archive("/synthetic-fixture/course-index")
    write_json(archive_path, archive)
    archive_errors = repo_module.validate_archive(archive)
    if archive_errors:
        raise RuntimeError("invalid demo archive:\n" + "\n".join(archive_errors))
    (DEMO / "star-project.md").write_text(repo_module.render_archive(archive), encoding="utf-8", newline="\n")

    candidates_path = DEMO / "resume-candidates.json"
    candidates = make_candidates(archive_path, both=True, passed=True)
    # Keep checked-in demonstration artifacts independent of the maintainer's
    # workstation path. Runtime archives may still record an absolute path.
    candidates["source_archive"]["path"] = "examples/synthetic-demo/star-project.json"
    write_json(candidates_path, candidates)
    candidate_errors = resume_module.validate_candidates(archive_path, archive, candidates)
    if candidate_errors:
        raise RuntimeError("invalid demo candidates:\n" + "\n".join(candidate_errors))
    (DEMO / "resume-candidates.md").write_text(
        resume_module.render_candidates(archive, candidates), encoding="utf-8", newline="\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
