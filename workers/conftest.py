"""Workspace-wide pytest plugin: the *no-skip* rule (brief §5, AC-4).

A skipped test must reference the issue that tracks its un-skipping, so skips
cannot silently rot. `pytest.mark.skip` / `pytest.mark.skipif` without a
`reason=` containing an issue ID (`#123` or `ABC-123`) fails collection.

This mirrors the ESLint `no-skip` rule applied to `it.skip` / `xit` on the
TypeScript side; the two rules must stay in sync (planning/15 §5).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import TYPE_CHECKING

import pytest
from hypothesis.configuration import set_hypothesis_home_dir

if TYPE_CHECKING:
    from collections.abc import Iterable

# Keep Hypothesis' storage (example DB + charmap cache) inside the workspace, gitignored,
# regardless of the directory pytest is launched from.
set_hypothesis_home_dir(Path(__file__).parent / ".hypothesis")

ISSUE_ID_PATTERN = re.compile(r"#\d+|[A-Z]+-\d+")
SKIP_MARKERS = ("skip", "skipif")


def _skip_reason(mark: pytest.Mark) -> str | None:
    """Return the reason of a skip/skipif mark, whether passed by keyword or position."""
    reason = mark.kwargs.get("reason")
    if isinstance(reason, str):
        return reason
    # `pytest.mark.skip("text")` accepts the reason positionally; `skipif` takes the
    # condition first, so a positional reason is only meaningful for `skip`.
    if mark.name == "skip" and mark.args and isinstance(mark.args[0], str):
        return mark.args[0]
    return None


def _violations(items: Iterable[pytest.Item]) -> list[str]:
    violations: list[str] = []
    for item in items:
        for marker_name in SKIP_MARKERS:
            for mark in item.iter_markers(name=marker_name):
                reason = _skip_reason(mark)
                if reason is None or not ISSUE_ID_PATTERN.search(reason):
                    violations.append(
                        f"{item.nodeid}: @pytest.mark.{marker_name} needs "
                        f'reason="... #<issue> or <PROJECT>-<n> ..." '
                        f"(got {reason!r})"
                    )
    return violations


def pytest_collection_modifyitems(
    session: pytest.Session, config: pytest.Config, items: list[pytest.Item]
) -> None:
    del session, config
    violations = _violations(items)
    if violations:
        joined = "\n  ".join(violations)
        raise pytest.UsageError(
            "no-skip rule (workers/conftest.py): every skip must cite a tracking issue.\n"
            f"  {joined}"
        )
