"""Pipeline coordination models. Domain records remain defined by contracts."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True, slots=True)
class PipelineContext:
    source_dir: Path
    workspace_dir: Path
    output_dir: Path
    publication_id: str
    options: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class StageReport:
    stage_id: str
    produced: int = 0
    warnings: tuple[str, ...] = ()
    artifacts: tuple[Path, ...] = ()


@dataclass(frozen=True, slots=True)
class PipelineReport:
    publication_id: str
    stages: tuple[StageReport, ...]

    @property
    def warning_count(self) -> int:
        return sum(len(stage.warnings) for stage in self.stages)
