from io import BytesIO
from types import SimpleNamespace
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from app.config import settings
from app.main import app
from app.services import gemini_service

client = TestClient(app)


def _escape_pdf_text(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_valid_pdf_with_text(lines: list[str]) -> bytes:
    """Create a minimal spec-compliant PDF containing embedded text streams."""
    text_ops = ["BT", "/F1 12 Tf", "50 750 Td"]
    for idx, line in enumerate(lines):
        if idx > 0:
            text_ops.append("0 -18 Td")
        text_ops.append(f"({_escape_pdf_text(line)}) Tj")
    text_ops.append("ET")
    stream_bytes = "\n".join(text_ops).encode("latin1")

    objects = [
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        (
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
        ),
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        (
            f"5 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode("latin1")
            + stream_bytes
            + b"\nendstream\nendobj\n"
        ),
    ]

    buffer = BytesIO()
    buffer.write(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(buffer.tell())
        buffer.write(obj)

    xref_pos = buffer.tell()
    buffer.write(f"xref\n0 {len(objects) + 1}\n".encode("latin1"))
    buffer.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        buffer.write(f"{offset:010d} 00000 n \n".encode("latin1"))
    buffer.write(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF".encode(
            "latin1"
        )
    )
    return buffer.getvalue()


def build_blank_pdf() -> bytes:
    """Create a valid PDF with one blank page and zero embedded text (simulates scanned PDF)."""
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def test_parse_resume_requires_internal_api_key(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", "")
    res_unconfigured = client.post(
        "/ai/parse-resume",
        files={"file": ("resume.pdf", b"%PDF-1.4 test", "application/pdf")},
    )
    assert res_unconfigured.status_code == 503
    assert res_unconfigured.json()["error"]["code"] == "INTERNAL_AUTH_NOT_CONFIGURED"

    monkeypatch.setattr(settings, "internal_api_key", "super-internal-key")
    res_missing = client.post(
        "/ai/parse-resume",
        files={"file": ("resume.pdf", b"%PDF-1.4 test", "application/pdf")},
    )
    assert res_missing.status_code == 401
    assert res_missing.json()["error"]["code"] == "MISSING_INTERNAL_API_KEY"

    res_wrong = client.post(
        "/ai/parse-resume",
        headers={"X-Internal-API-Key": "wrong-key"},
        files={"file": ("resume.pdf", b"%PDF-1.4 test", "application/pdf")},
    )
    assert res_wrong.status_code == 403
    assert res_wrong.json()["error"]["code"] == "INVALID_INTERNAL_API_KEY"


def test_parse_resume_rejects_invalid_and_oversized_files(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", "internal-secret")
    headers = {"X-Internal-API-Key": "internal-secret"}

    res_txt = client.post(
        "/ai/parse-resume",
        headers=headers,
        files={"file": ("resume.txt", b"plain text", "text/plain")},
    )
    assert res_txt.status_code == 400
    assert res_txt.json()["error"]["code"] == "INVALID_FILE_TYPE"

    res_empty = client.post(
        "/ai/parse-resume",
        headers=headers,
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert res_empty.status_code == 400
    assert res_empty.json()["error"]["code"] == "EMPTY_FILE"

    res_sig = client.post(
        "/ai/parse-resume",
        headers=headers,
        files={"file": ("fake.pdf", b"NOT_A_PDF_FILE", "application/pdf")},
    )
    assert res_sig.status_code == 400
    assert res_sig.json()["error"]["code"] == "INVALID_PDF_SIGNATURE"

    oversized = b"%PDF-" + (b"0" * (settings.max_resume_file_size_bytes + 64))
    res_big = client.post(
        "/ai/parse-resume",
        headers=headers,
        files={"file": ("big.pdf", oversized, "application/pdf")},
    )
    assert res_big.status_code == 413
    assert res_big.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_parse_resume_handles_corrupted_and_scanned_pdfs(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", "internal-secret")
    headers = {"X-Internal-API-Key": "internal-secret"}

    res_corrupt = client.post(
        "/ai/parse-resume",
        headers=headers,
        files={"file": ("corrupt.pdf", b"%PDF-1.4\n%%corrupted-body", "application/pdf")},
    )
    assert res_corrupt.status_code == 422
    assert res_corrupt.json()["error"]["code"] == "CORRUPTED_PDF"

    blank_pdf = build_blank_pdf()
    res_scanned = client.post(
        "/ai/parse-resume",
        headers=headers,
        files={"file": ("scanned.pdf", blank_pdf, "application/pdf")},
    )
    assert res_scanned.status_code == 422
    assert res_scanned.json()["error"]["code"] == "SCANNED_OR_EMPTY_PDF"


def test_parse_resume_success_with_mocked_gemini(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", "internal-secret")
    monkeypatch.setattr(settings, "gemini_api_key", "mock-key-for-unit-test")
    monkeypatch.setattr(settings, "gemini_model", "gemini-2.5-flash")

    captured_calls: list[dict] = []

    class FakeModels:
        def generate_content(self, *, model, contents, config):
            captured_calls.append({"model": model, "contents": contents})
            parsed_obj = gemini_service._GeminiResumeSchema(
                summary="Early-career Full-Stack and Applied AI Engineer.",
                atsScore=88,
                completionPercentage=95,
                skillCategories=[
                    gemini_service._SkillCategory(
                        category="Languages", skills=["Python", "JavaScript"]
                    ),
                    gemini_service._SkillCategory(
                        category="Frameworks", skills=["FastAPI", "React", "Node.js"]
                    ),
                ],
                education=[
                    {
                        "degree": "B.Tech Computer Science",
                        "institution": "NIT Surathkal",
                        "duration": "2021 - 2025",
                        "grade": "8.7 CGPA",
                        "highlights": "Machine Learning, Distributed Systems",
                    }
                ],
                experience=[
                    {
                        "role": "Backend & AI Intern",
                        "company": "NovaStack Labs",
                        "location": "Bengaluru",
                        "duration": "2025",
                        "highlights": ["Built FastAPI semantic retrieval APIs."],
                    }
                ],
                projects=[
                    {
                        "name": "CareerAI",
                        "techStack": ["React", "FastAPI", "MongoDB"],
                        "description": "AI-powered job recommendation platform.",
                    }
                ],
                strengths=["Strong backend and AI API experience."],
                improvements=["Quantify latency improvements in bullet points."],
            )
            return SimpleNamespace(parsed=parsed_obj, text=None)

    class FakeGenAIClient:
        def __init__(self, api_key: str, **_kwargs):
            self.api_key = api_key
            self.models = FakeModels()

    monkeypatch.setattr(gemini_service.genai, "Client", FakeGenAIClient)

    sample_pdf = build_valid_pdf_with_text(
        [
            "Aarav Mehta - Software Engineer",
            "Skills: Python, FastAPI, React, Node.js, MongoDB, Docker",
            "Experience: Backend and AI Intern at NovaStack Labs",
            "Education: B.Tech Computer Science, NIT Surathkal",
        ]
    )

    response = client.post(
        "/ai/parse-resume",
        headers={"X-Internal-API-Key": "internal-secret"},
        files={"file": ("aarav_resume.pdf", sample_pdf, "application/pdf")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["fileName"] == "aarav_resume.pdf"
    assert payload["pageCount"] == 1
    assert "Aarav Mehta" in payload["extractedText"]
    assert payload["parsedProfile"]["atsScore"] == 88
    assert payload["parsedProfile"]["extractedSkills"]["Languages"] == [
        "Python",
        "JavaScript",
    ]
    assert captured_calls[0]["model"] == "gemini-2.5-flash"


def test_parse_resume_handles_missing_gemini_key_and_api_errors(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", "internal-secret")
    monkeypatch.setattr(settings, "gemini_api_key", "")

    sample_pdf = build_valid_pdf_with_text(
        [
            "Aarav Mehta - Software Engineer",
            "Skills: Python, FastAPI, React, Node.js, MongoDB, Docker",
        ]
    )

    res_no_key = client.post(
        "/ai/parse-resume",
        headers={"X-Internal-API-Key": "internal-secret"},
        files={"file": ("resume.pdf", sample_pdf, "application/pdf")},
    )
    assert res_no_key.status_code == 503
    assert res_no_key.json()["error"]["code"] == "GEMINI_NOT_CONFIGURED"

    monkeypatch.setattr(settings, "gemini_api_key", "fake-key")

    class FailingModels:
        def generate_content(self, **_kwargs):
            raise RuntimeError("Upstream quota error")

    class FailingClient:
        def __init__(self, api_key: str, **_kwargs):
            self.models = FailingModels()

    monkeypatch.setattr(gemini_service.genai, "Client", FailingClient)

    res_api_fail = client.post(
        "/ai/parse-resume",
        headers={"X-Internal-API-Key": "internal-secret"},
        files={"file": ("resume.pdf", sample_pdf, "application/pdf")},
    )
    assert res_api_fail.status_code == 502
    assert res_api_fail.json()["error"]["code"] == "GEMINI_API_ERROR"


def test_parse_resume_handles_gemini_timeout_and_invalid_output(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", "internal-secret")
    monkeypatch.setattr(settings, "gemini_api_key", "fake-key")

    sample_pdf = build_valid_pdf_with_text(
        [
            "Aarav Mehta - Software Engineer",
            "Skills: Python, FastAPI, React, Node.js, MongoDB, Docker",
        ]
    )

    class TimeoutModels:
        def generate_content(self, **_kwargs):
            raise TimeoutError("Request timed out")

    class TimeoutClient:
        def __init__(self, api_key: str, **_kwargs):
            self.models = TimeoutModels()

    monkeypatch.setattr(gemini_service.genai, "Client", TimeoutClient)

    res_timeout = client.post(
        "/ai/parse-resume",
        headers={"X-Internal-API-Key": "internal-secret"},
        files={"file": ("resume.pdf", sample_pdf, "application/pdf")},
    )
    assert res_timeout.status_code == 504
    assert res_timeout.json()["error"]["code"] == "GEMINI_TIMEOUT"

    class InvalidOutputModels:
        def generate_content(self, **_kwargs):
            return SimpleNamespace(parsed=None, text="{invalid-json")

    class InvalidOutputClient:
        def __init__(self, api_key: str, **_kwargs):
            self.models = InvalidOutputModels()

    monkeypatch.setattr(gemini_service.genai, "Client", InvalidOutputClient)

    res_invalid = client.post(
        "/ai/parse-resume",
        headers={"X-Internal-API-Key": "internal-secret"},
        files={"file": ("resume.pdf", sample_pdf, "application/pdf")},
    )
    assert res_invalid.status_code == 502
    assert res_invalid.json()["error"]["code"] == "GEMINI_INVALID_OUTPUT"
