from dataclasses import FrozenInstanceError
from pathlib import Path
import subprocess
import sys
import unittest

from scripts.validate_task_graph import (
    ValidationResult,
    expand_dependencies,
    validate_task_graph,
)


FIXTURES = Path(__file__).parent / "fixtures"
REPOSITORY_ROOT = Path(__file__).parents[2]


class TaskGraphTests(unittest.TestCase):
    def test_valid_graph(self):
        result = validate_task_graph(FIXTURES / "valid.md")

        self.assertEqual(result.task_count, 2)
        self.assertEqual(result.errors, [])

    def test_result_is_frozen(self):
        result = ValidationResult(task_count=1, errors=[])

        with self.assertRaises(FrozenInstanceError):
            result.task_count = 2

    def test_duplicate_id(self):
        self.assertEqual(
            validate_task_graph(FIXTURES / "duplicate-id.md").errors,
            ["DUPLICATE_TASK_ID:T001", "ORPHAN_DEPENDENCIES:9"],
        )

    def test_unknown_dependency(self):
        self.assertEqual(
            validate_task_graph(FIXTURES / "unknown-dependency.md").errors,
            ["UNKNOWN_DEPENDENCY:T999"],
        )

    def test_cycle_has_deterministic_visiting_stack_path(self):
        self.assertEqual(
            validate_task_graph(FIXTURES / "cycle.md").errors,
            ["DEPENDENCY_CYCLE:T001->T002->T001"],
        )

    def test_later_phase_dependency(self):
        self.assertEqual(
            validate_task_graph(FIXTURES / "later-phase-dependency.md").errors,
            ["LATER_PHASE_DEPENDENCY:T001->T018"],
        )

    def test_phase_heading_prevents_orphan_dependencies_from_erasing_an_invalid_edge(self):
        self.assertEqual(
            validate_task_graph(FIXTURES / "orphan-dependencies-after-phase.md").errors,
            ["ORPHAN_DEPENDENCIES:9", "UNKNOWN_DEPENDENCY:T999"],
        )

    def test_duplicate_dependencies_preserve_the_first_invalid_edge(self):
        self.assertEqual(
            validate_task_graph(FIXTURES / "duplicate-dependencies.md").errors,
            ["DUPLICATE_DEPENDENCIES:T001", "UNKNOWN_DEPENDENCY:T999"],
        )

    def test_non_task_level_two_heading_ends_task_context(self):
        self.assertEqual(
            validate_task_graph(FIXTURES / "orphan-dependencies-after-heading.md").errors,
            ["ORPHAN_DEPENDENCIES:9"],
        )

    def test_task_body_level_three_heading_does_not_end_task_context(self):
        self.assertEqual(
            validate_task_graph(FIXTURES / "dependencies-after-task-body-heading.md").errors,
            [],
        )

    def test_expands_inclusive_en_dash_range(self):
        self.assertEqual(expand_dependencies("T018–T020"), {"T018", "T019", "T020"})

    def test_expands_inclusive_hyphen_range(self):
        self.assertEqual(expand_dependencies("T030-T032"), {"T030", "T031", "T032"})

    def test_rejects_reversed_range(self):
        with self.assertRaisesRegex(ValueError, r"Invalid dependency range: T020-T018"):
            expand_dependencies("T020-T018")

    def test_cli_accepts_an_optional_path_and_prints_machine_diagnostics(self):
        completed = subprocess.run(
            [
                sys.executable,
                str(REPOSITORY_ROOT / "scripts" / "validate_task_graph.py"),
                str(FIXTURES / "later-phase-dependency.md"),
            ],
            cwd=REPOSITORY_ROOT,
            check=False,
            capture_output=True,
            text=True,
        )

        self.assertEqual(completed.returncode, 1)
        self.assertEqual(
            completed.stdout.splitlines(),
            ["LATER_PHASE_DEPENDENCY:T001->T018"],
        )


if __name__ == "__main__":
    unittest.main()
