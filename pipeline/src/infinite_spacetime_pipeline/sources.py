"""Auditable source extraction before segmentation or knowledge enrichment."""

from __future__ import annotations

import hashlib
import mimetypes
import posixpath
from dataclasses import asdict, dataclass, field
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from typing import Any, Protocol
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile


class SourceExtractionError(ValueError):
    """Raised when a source cannot be identified or safely extracted."""


@dataclass(frozen=True, slots=True)
class ExtractedSource:
    source_path: str
    media_type: str
    sha256: str
    text: str
    extractor_id: str
    requires_ocr: bool = False
    warnings: tuple[str, ...] = ()
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["warnings"] = list(self.warnings)
        return value


class SourceAdapter(Protocol):
    adapter_id: str
    extensions: frozenset[str]

    def extract(self, path: Path, sha256: str) -> ExtractedSource: ...


def _media_type(path: Path, fallback: str) -> str:
    return mimetypes.guess_type(path.name)[0] or fallback


def _decode_text(data: bytes) -> tuple[str, str]:
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "big5"):
        try:
            return data.decode(encoding), encoding
        except UnicodeDecodeError:
            continue
    raise SourceExtractionError("文本编码无法可靠识别；请先显式转换编码。")


class PlainTextAdapter:
    adapter_id = "plain-text"
    extensions = frozenset({".txt", ".md", ".markdown"})

    def extract(self, path: Path, sha256: str) -> ExtractedSource:
        text, encoding = _decode_text(path.read_bytes())
        return ExtractedSource(
            source_path=str(path),
            media_type=_media_type(path, "text/plain"),
            sha256=sha256,
            text=text,
            extractor_id=self.adapter_id,
            metadata={"encoding": encoding},
        )


class _VisibleTextParser(HTMLParser):
    block_tags = {
        "article",
        "br",
        "div",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "li",
        "p",
        "section",
        "tr",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag in {"script", "style"}:
            self.hidden_depth += 1
        elif tag in self.block_tags:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self.hidden_depth:
            self.hidden_depth -= 1
        elif tag in self.block_tags:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.hidden_depth:
            self.parts.append(data)

    def text(self) -> str:
        lines = (" ".join(line.split()) for line in "".join(self.parts).splitlines())
        return "\n".join(line for line in lines if line)


def _html_to_text(value: str) -> str:
    parser = _VisibleTextParser()
    parser.feed(value)
    parser.close()
    return parser.text()


class HtmlAdapter:
    adapter_id = "html"
    extensions = frozenset({".htm", ".html", ".xhtml"})

    def extract(self, path: Path, sha256: str) -> ExtractedSource:
        value, encoding = _decode_text(path.read_bytes())
        return ExtractedSource(
            source_path=str(path),
            media_type=_media_type(path, "text/html"),
            sha256=sha256,
            text=_html_to_text(value),
            extractor_id=self.adapter_id,
            metadata={"encoding": encoding},
        )


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


class DocxAdapter:
    adapter_id = "docx"
    extensions = frozenset({".docx"})

    def extract(self, path: Path, sha256: str) -> ExtractedSource:
        try:
            with ZipFile(path) as archive:
                root = ElementTree.fromstring(archive.read("word/document.xml"))
        except (BadZipFile, KeyError, ElementTree.ParseError) as error:
            raise SourceExtractionError(f"DOCX 结构损坏：{error}") from error
        parts: list[str] = []
        for element in root.iter():
            name = _local_name(element.tag)
            if name == "t" and element.text:
                parts.append(element.text)
            elif name in {"tab"}:
                parts.append("\t")
            elif name in {"br", "p"}:
                parts.append("\n")
        text = "\n".join(
            line.rstrip() for line in "".join(parts).splitlines() if line.strip()
        )
        return ExtractedSource(
            source_path=str(path),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            sha256=sha256,
            text=text,
            extractor_id=self.adapter_id,
        )


class EpubAdapter:
    adapter_id = "epub"
    extensions = frozenset({".epub"})

    def extract(self, path: Path, sha256: str) -> ExtractedSource:
        warnings: list[str] = []
        try:
            with ZipFile(path) as archive:
                names = set(archive.namelist())
                ordered_paths = self._spine_paths(archive)
                if not ordered_paths:
                    warnings.append("EPUB 未找到有效 spine，已按文件名顺序读取正文。")
                    ordered_paths = sorted(
                        name
                        for name in names
                        if PurePosixPath(name).suffix.lower() in {".html", ".htm", ".xhtml"}
                    )
                chapters: list[str] = []
                for name in ordered_paths:
                    if name not in names:
                        warnings.append(f"EPUB spine 引用缺失：{name}")
                        continue
                    value, _ = _decode_text(archive.read(name))
                    text = _html_to_text(value)
                    if text:
                        chapters.append(text)
        except (BadZipFile, KeyError, ElementTree.ParseError) as error:
            raise SourceExtractionError(f"EPUB 结构损坏：{error}") from error
        return ExtractedSource(
            source_path=str(path),
            media_type="application/epub+zip",
            sha256=sha256,
            text="\n\n".join(chapters),
            extractor_id=self.adapter_id,
            warnings=tuple(warnings),
            metadata={"chapter_count": len(chapters)},
        )

    @staticmethod
    def _spine_paths(archive: ZipFile) -> list[str]:
        container = ElementTree.fromstring(archive.read("META-INF/container.xml"))
        rootfile = next(
            (
                element.attrib.get("full-path")
                for element in container.iter()
                if _local_name(element.tag) == "rootfile"
            ),
            None,
        )
        if not rootfile:
            return []
        package = ElementTree.fromstring(archive.read(rootfile))
        manifest: dict[str, str] = {}
        spine: list[str] = []
        for element in package.iter():
            name = _local_name(element.tag)
            if name == "item" and element.attrib.get("id") and element.attrib.get("href"):
                manifest[element.attrib["id"]] = element.attrib["href"]
            elif name == "itemref" and element.attrib.get("idref"):
                spine.append(element.attrib["idref"])
        base = PurePosixPath(rootfile).parent
        return [
            posixpath.normpath(str(base / manifest[item_id]))
            for item_id in spine
            if item_id in manifest
        ]


class PdfAdapter:
    adapter_id = "pdf-text"
    extensions = frozenset({".pdf"})

    def extract(self, path: Path, sha256: str) -> ExtractedSource:
        try:
            from pypdf import PdfReader
        except ImportError as error:
            raise SourceExtractionError(
                "缺少 pypdf；请安装 pipeline 项目依赖后重试。"
            ) from error
        reader = PdfReader(path)
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
        text = "\n\n".join(page for page in pages if page)
        requires_ocr = not bool(text.strip())
        warnings = (
            ("PDF 没有可提取文本，已标记为需要 OCR/人工转录。",)
            if requires_ocr
            else ()
        )
        return ExtractedSource(
            source_path=str(path),
            media_type="application/pdf",
            sha256=sha256,
            text=text,
            extractor_id=self.adapter_id,
            requires_ocr=requires_ocr,
            warnings=warnings,
            metadata={"page_count": len(reader.pages)},
        )


class ImageAdapter:
    adapter_id = "image-pending-ocr"
    extensions = frozenset({".bmp", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"})

    def extract(self, path: Path, sha256: str) -> ExtractedSource:
        return ExtractedSource(
            source_path=str(path),
            media_type=_media_type(path, "application/octet-stream"),
            sha256=sha256,
            text="",
            extractor_id=self.adapter_id,
            requires_ocr=True,
            warnings=("图片原件已登记，必须由 OCR 或人工转录阶段生成文本。",),
        )


class SourceRegistry:
    def __init__(self, adapters: tuple[SourceAdapter, ...]) -> None:
        self._by_extension: dict[str, SourceAdapter] = {}
        for adapter in adapters:
            for extension in adapter.extensions:
                normalized = extension.lower()
                if normalized in self._by_extension:
                    raise ValueError(f"重复的来源扩展名适配器：{normalized}")
                self._by_extension[normalized] = adapter

    @property
    def supported_extensions(self) -> tuple[str, ...]:
        return tuple(sorted(self._by_extension))

    def extract(self, path: Path) -> ExtractedSource:
        resolved = path.expanduser().resolve()
        if not resolved.is_file():
            raise SourceExtractionError(f"来源文件不存在：{resolved}")
        adapter = self._by_extension.get(resolved.suffix.lower())
        if not adapter:
            supported = ", ".join(self.supported_extensions)
            raise SourceExtractionError(
                f"不支持的来源格式 {resolved.suffix or '(无扩展名)'}；当前支持：{supported}"
            )
        sha256 = hashlib.sha256(resolved.read_bytes()).hexdigest()
        return adapter.extract(resolved, sha256)


def default_source_registry() -> SourceRegistry:
    return SourceRegistry(
        (
            PlainTextAdapter(),
            HtmlAdapter(),
            DocxAdapter(),
            EpubAdapter(),
            PdfAdapter(),
            ImageAdapter(),
        )
    )


def extract_source(path: Path) -> ExtractedSource:
    return default_source_registry().extract(path)
