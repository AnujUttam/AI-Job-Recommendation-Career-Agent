from dataclasses import dataclass
from io import BytesIO
import re
from fastapi import UploadFile
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.config import settings
from app.middleware.security import ServiceError


@dataclass(frozen=True)
class PdfExtractionResult:
    file_name: str
    file_size_kb: int
    page_count: int
    text: str


def _normalize_whitespace(text: str) -> str:
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    non_empty = [line for line in lines if line]
    return "\n".join(non_empty).strip()


def validate_and_extract_pdf(file: UploadFile, content: bytes) -> PdfExtractionResult:
    """Validate uploaded PDF metadata, size, signature, and extract readable text."""
    file_name = (file.filename or "resume.pdf").strip()
    content_type = (file.content_type or "").lower()

    if not file_name.lower().endswith(".pdf") or content_type not in {
        "application/pdf",
        "application/x-pdf",
    }:
        raise ServiceError(
            status_code=400,
            code="INVALID_FILE_TYPE",
            message="Only PDF files (.pdf) are supported.",
        )

    if not content:
        raise ServiceError(
            status_code=400,
            code="EMPTY_FILE",
            message="Uploaded PDF file is empty.",
        )

    if len(content) > settings.max_resume_file_size_bytes:
        raise ServiceError(
            status_code=413,
            code="FILE_TOO_LARGE",
            message=f"File exceeds maximum allowed size of {settings.max_resume_file_size_mb} MB.",
        )

    if not content.startswith(b"%PDF-"):
        raise ServiceError(
            status_code=400,
            code="INVALID_PDF_SIGNATURE",
            message="Uploaded file does not have a valid PDF signature.",
        )

    try:
        reader = PdfReader(BytesIO(content))
        if reader.is_encrypted:
            decrypt_result = reader.decrypt("")
            if decrypt_result == 0:
                raise ServiceError(
                    status_code=422,
                    code="ENCRYPTED_PDF",
                    message="Password-protected PDFs cannot be processed.",
                )

        pages_text: list[str] = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                pages_text.append(page_text)
    except ServiceError:
        raise
    except (PdfReadError, Exception) as exc:
        raise ServiceError(
            status_code=422,
            code="CORRUPTED_PDF",
            message="Unable to parse PDF file. It may be corrupted or malformed.",
        ) from exc

    normalized = _normalize_whitespace("\n".join(pages_text))
    alnum_chars = re.sub(r"[^A-Za-z0-9]", "", normalized)

    if len(alnum_chars) < 30:
        raise ServiceError(
            status_code=422,
            code="SCANNED_OR_EMPTY_PDF",
            message=(
                "No readable text could be extracted from this PDF. "
                "Scanned or image-only PDFs require OCR before parsing."
            ),
        )

    return PdfExtractionResult(
        file_name=file_name,
        file_size_kb=max(1, round(len(content) / 1024)),
        page_count=len(reader.pages),
        text=normalized,
    )
