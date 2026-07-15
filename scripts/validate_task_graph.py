#!/usr/bin/env python3
"""Validate TASKS.md task identifiers and dependency phase order."""

from __future__ import annotations

import collections
import re
import sys
from pathlib import Path


TASK_RE = re.compile(r"^## (T\d{3}) — (.+)$")
PHASE_RE = re.compile(r"^# Phase (\d+)")
DEPS_RE = re.compile(r"^\*\*Dependencies:\*\* (.+)$")
RANGE_RE = re.compile(r"(T\d{3})[–-](T\d{3})")
ID_RE = re.compile(r"T\d{3}")


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


def validate(path: Path) -> list[str]:
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
                errors.append(f"Line {line_number}: duplicate task ID {current_task}")
            phases[current_task] = phase
            dependencies.setdefault(current_task, set())
            continue

        dependency_match = DEPS_RE.match(line)
        if dependency_match and current_task:
            try:
                dependencies[current_task] = expand_dependencies(dependency_match.group(1))
            except ValueError as exc:
                errors.append(f"Line {line_number}: {exc}")

    for task_id, task_dependencies in dependencies.items():
        for dependency in task_dependencies:
            if dependency not in phases:
                errors.append(f"{task_id}: unknown dependency {dependency}")
                continue
            if phases[dependency] > phases[task_id]:
                errors.append(
                    f"{task_id}: depends on later-phase task {dependency} "
                    f"(phase {phases[task_id]} -> {phases[dependency]})"
                )

    indegree = {task_id: 0 for task_id in phases}
    adjacency: dict[str, list[str]] = {task_id: [] for task_id in phases}
    for task_id, task_dependencies in dependencies.items():
        for dependency in task_dependencies:
            if dependency in phases:
                adjacency[dependency].append(task_id)
                indegree[task_id] += 1

    queue = collections.deque(task for task, degree in indegree.items() if degree == 0)
    visited = 0
    while queue:
        task = queue.popleft()
        visited += 1
        for dependent in adjacency[task]:
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                queue.append(dependent)

    if visited != len(phases):
        cyclic = sorted(task for task, degree in indegree.items() if degree > 0)
        errors.append(f"Dependency cycle detected among: {', '.join(cyclic)}")

    if not phases:
        errors.append("No tasks found.")

    return errors


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("TASKS.md")
    errors = validate(path)
    if errors:
        print("TASK GRAPH INVALID")
        for error in errors:
            print(f"- {error}")
        return 1

    count = sum(1 for line in path.read_text(encoding="utf-8").splitlines() if TASK_RE.match(line))
    print(f"TASK GRAPH VALID: {count} tasks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
