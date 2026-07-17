"""Losslessness and derived-layer invariants for text processing."""

from __future__ import annotations

import unittest

from infinite_spacetime_pipeline.segmentation import (
    SegmentationError,
    add_text_layer,
    segment_text,
)


class SegmentationTest(unittest.TestCase):
    def test_original_text_is_lossless_and_punctuation_is_independent(self) -> None:
        original = "古文無句讀\n\n第二段。"
        segmented = segment_text(
            publication_id="publication-a",
            source_key="volume-a",
            source_sha256="sha256:" + ("0" * 64),
            text=original,
        ).to_dict()
        reconstructed = "".join(
            segment["text"]["original"] for segment in segmented["segments"]
        )
        self.assertEqual(reconstructed, original)

        values = {
            segment["id"]: f"{segment['text']['original']}。"
            for segment in segmented["segments"]
        }
        layered = add_text_layer(segmented, layer="punctuated", values=values)
        self.assertEqual(
            [segment["text"]["original"] for segment in layered["segments"]],
            [segment["text"]["original"] for segment in segmented["segments"]],
        )

    def test_unknown_segment_layer_is_rejected(self) -> None:
        segmented = segment_text(
            publication_id="publication-a",
            source_key="volume-a",
            source_sha256="sha256:" + ("0" * 64),
            text="原文",
        ).to_dict()
        with self.assertRaisesRegex(SegmentationError, "unknown segment"):
            add_text_layer(
                segmented,
                layer="simplified",
                values={
                    segmented["segments"][0]["id"]: "原文",
                    "not-a-segment": "错误",
                },
            )


if __name__ == "__main__":
    unittest.main()
