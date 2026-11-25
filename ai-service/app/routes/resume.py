from fastapi import APIRouter, Depends, File, UploadFile

from app.middleware.security import verify_internal_api_key
from app.schemas.resume import ResumeParseResponse
from app.services.gemini_service import extract_resume_profile
from app.services.pdf_service import validate_and_extract_pdf

router = APIRouter(prefix="/ai", tags=["resume"])


@router.post(
    "/parse-resume",
    response_model=ResumeParseResponse,
    dependencies=[Depends(verify_internal_api_key)],
)
async def parse_resume(file: UploadFile = File(...)) -> ResumeParseResponse:
    """Validate uploaded PDF resume, extract text, and parse structured fields via Gemini."""
    content = await file.read()
    extraction = validate_and_extract_pdf(file, content)
    parsed_profile = extract_resume_profile(extraction.text)

    return ResumeParseResponse(
        success=True,
        fileName=extraction.file_name,
        fileSizeKb=extraction.file_size_kb,
        pageCount=extraction.page_count,
        extractedText=extraction.text,
        parsedProfile=parsed_profile,
    )
