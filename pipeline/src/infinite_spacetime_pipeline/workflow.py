"""Composable workflow: sources and processors plug into one ordered pipeline."""

from collections.abc import Iterable
from typing import Protocol

from .models import PipelineContext, PipelineReport, StageReport


class PipelineStage(Protocol):
    """A bounded transformation with no knowledge of the public UI."""

    @property
    def stage_id(self) -> str: ...

    def run(self, context: PipelineContext) -> StageReport: ...


class Pipeline:
    """Runs import → normalize → segment → enrich → review → publish stages."""

    def __init__(self, stages: Iterable[PipelineStage]) -> None:
        self._stages = tuple(stages)
        stage_ids = [stage.stage_id for stage in self._stages]
        if len(stage_ids) != len(set(stage_ids)):
            raise ValueError("Pipeline stage ids must be unique")

    def run(self, context: PipelineContext) -> PipelineReport:
        reports = tuple(stage.run(context) for stage in self._stages)
        return PipelineReport(
            publication_id=context.publication_id,
            stages=reports,
        )
