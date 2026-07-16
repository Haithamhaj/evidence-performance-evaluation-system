#!/usr/bin/env python3
"""Validate task identifiers and phase-valid dependencies in a task plan."""

from __future__ import annotations

from dataclasses import dataclass
import re
import sys
from pathlib import Path


TASK_RE = re.compile(r"^## (T\d{3}) — (.+)$")
PHASE_RE = re.compile(r"^# Phase (\d+)")
DEPS_RE = re.compile(r"^\*\*Dependencies:\*\* (.+)$")
RANGE_RE = re.compile(r"(T\d{3})[–-](T\d{3})")
ID_RE = re.compile(r"T\d{3}")


@dataclass(frozen=True)
class ValidationResult:
    task_count: int
    errors: list[str]


def expand_dependencies(value: str) -> set[str]:
    if value.strip().lower() == "none":
        return set()

    dependencies: set[str] = set()
    for match in RANGE_RE.finditer(value):
        start = int(match.group(1)[1:])
        end = int(match.group(2)[1:])
        if end < start:
            raise ValueError(f"Invalid dependency range: {match.group(0)}")
        dependencies.update(f"T{number:03d}" for number in range(start, end + 1))

    without_ranges = RANGE_RE.sub("", value)
    dependencies.update(ID_RE.findall(without_ranges))
    return dependencies


def validate_task_graph(path: Path) -> ValidationResult:
    text = path.read_text(encoding="utf-8")
    phase = -1
    current_task: str | None = None
    phases: dict[str, int] = {}
    dependencies: dict[str, set[str]] = {}
    errors: list[str] = []

    for line_number, line in enumerate(text.splitlines(), start=1):
        phase_match = PHASE_RE.match(line)
        if phase_match:
            phase = int(phase_match.group(1))
            continue

        task_match = TASK_RE.match(line)
        if task_match:
            current_task = task_match.group(1)
            if current_task in phases:
                errors.append(f"DUPLICATE_TASK_ID:{current_task}")
                current_task = None
                continue
            phases[current_task] = phase
            dependencies.setdefault(current_task, set())
            continue

        dependency_match = DEPS_RE.match(line)
        if dependency_match and current_task:
            try:
                dependencies[current_task] = expand_dependencies(dependency_match.group(1))
            except ValueError as exc:
                errors.append(f"INVALID_DEPENDENCY_RANGE:{current_task}:{exc}")

    for task_id, task_dependencies in dependencies.items():
        for dependency in sorted(task_dependencies):
            if dependency not in phases:
                errors.append(f"UNKNOWN_DEPENDENCY:{dependency}")
                continue
            if phases[dependency] > phases[task_id]:
                errors.append(f"LATER_PHASE_DEPENDENCY:{task_id}->{dependency}")

    visited: set[str] = set()
    visiting: set[str] = set()
    stack: list[str] = []
    reported_cycles: set[tuple[str, ...]] = set()

    def visit(task_id: str) -> None:
        if task_id in visited:
            return
        if task_id in visiting:
            cycle_start = stack.index(task_id)
            cycle = tuple(stack[cycle_start:] + [task_id])
            if cycle not in reported_cycles:
                errors.append(f"DEPENDENCY_CYCLE:{'->'.join(cycle)}")
                reported_cycles.add(cycle)
            return

        visiting.add(task_id)
        stack.append(task_id)
        for dependency in sorted(dependencies.get(task_id, set())):
            if dependency in phases:
                visit(dependency)
        stack.pop()
        visiting.remove(task_id)
        visited.add(task_id)

    for task_id in phases:
        visit(task_id)

    if not phases:
        errors.append("NO_TASKS_FOUND")

    return ValidationResult(task_count=len(phases), errors=errors)


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("TASKS.md")
    result = validate_task_graph(path)
    if result.errors:
        for error in result.errors:
            print(error)
        return 1

    print(f"TASK GRAPH VALID: {result.task_count} tasks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
