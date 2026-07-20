import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
CORE_SKILLS = (
    ROOT / "skills" / "repository-to-star",
    ROOT / "skills" / "star-to-resume",
)


class PortabilityTests(unittest.TestCase):
    def test_core_runtime_has_no_vendor_sdk_imports(self):
        forbidden = (
            "import openai",
            "from openai",
            "import anthropic",
            "from anthropic",
            "import codex",
            "from codex",
        )
        for skill_dir in CORE_SKILLS:
            for script in (skill_dir / "scripts").glob("*.py"):
                text = script.read_text(encoding="utf-8").lower()
                for marker in forbidden:
                    self.assertNotIn(marker, text, f"{script} imports a host SDK")

    def test_portable_skill_instructions_are_not_vendor_bound(self):
        forbidden = ("codex", "openai", "claude code")
        for skill_dir in CORE_SKILLS:
            skill_text = (skill_dir / "SKILL.md").read_text(encoding="utf-8").lower()
            for marker in forbidden:
                self.assertNotIn(marker, skill_text, f"{skill_dir.name} binds its core workflow to {marker}")

    def test_each_skill_is_self_contained(self):
        required = ("SKILL.md", "scripts", "assets", "references")
        for skill_dir in CORE_SKILLS:
            for relative in required:
                self.assertTrue((skill_dir / relative).exists(), f"{skill_dir.name} misses {relative}")

    def test_codex_metadata_is_adapter_only(self):
        self.assertTrue((ROOT / ".codex-plugin" / "plugin.json").is_file())
        for skill_dir in CORE_SKILLS:
            self.assertTrue((skill_dir / "agents" / "openai.yaml").is_file())

    def test_handoff_schema_copies_are_identical(self):
        stage_one = ROOT / "skills" / "repository-to-star" / "assets" / "star-project.schema.json"
        stage_two = ROOT / "skills" / "star-to-resume" / "assets" / "star-project.schema.json"
        self.assertEqual(stage_one.read_bytes(), stage_two.read_bytes())

    def test_checked_in_demo_has_no_maintainer_absolute_path(self):
        candidates_path = ROOT / "examples" / "synthetic-demo" / "resume-candidates.json"
        candidates = json.loads(candidates_path.read_text(encoding="utf-8"))
        self.assertFalse(pathlib.Path(candidates["source_archive"]["path"]).is_absolute())


if __name__ == "__main__":
    unittest.main()
