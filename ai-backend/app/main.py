import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    CampaignInput,
    CampaignSpec,
    Creator,
    PromptRequest,
    PromptResponse,
    ReportResponse,
    CampaignRequest,
    CampaignResponse,
)
from .extraction import extract_campaign
from .matching import rank_creators
from .prompts import generate_prompt
from .sample_data import SAMPLE_CREATORS
from .llm import extract_campaign_requirements
from .extraction import extract_campaign, extract_campaign_with_ai


# Initialize the application BEFORE defining routes
app = FastAPI(
    title="Kreota AI Intelligence API",
    version="0.2.0",
    description=(
        "Campaign extraction, creator matching, "
        "report generation, and prompt generation."
    ),
)

# CORS configuration for the React frontend
origins = [
    x.strip()
    for x in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:8443",
    ).split(",")
    if x.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Development fixture only. Replace with authenticated
# database access before production.
CREATORS = SAMPLE_CREATORS


@app.get("/")
def home():
    return {
        "message": "Welcome to Kreota AI Intelligence API",
        "status": "running",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "kreota-ai",
        "mode": "gemini-enabled",
    }


# Gemini-powered campaign analysis
@app.post(
    "/api/campaign/analyze",
    response_model=CampaignResponse,
)
def analyze_campaign(request: CampaignRequest):
    try:
        result = extract_campaign_requirements(
            request.description
        )
        return CampaignResponse(**result)

    except Exception as exc:
        print(f"Gemini campaign analysis failed: {exc}")

        raise HTTPException(
            status_code=502,
            detail=(
                "AI campaign analysis failed. "
                "Please try again."
            ),
        ) from exc


# Existing baseline campaign extraction
@app.post(
    "/api/campaign/extract",
    response_model=CampaignSpec,
)
def campaign_extract(body: CampaignInput):
    return extract_campaign(body)


# Creator matching
@app.post("/api/creators/match", response_model=list)
def creator_match(body: CampaignSpec, limit: int = 5):
    if limit < 1 or limit > 20:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 20",
        )

    return rank_creators(body, CREATORS, limit)


# Full campaign report
@app.post(
    "/api/reports/generate",
    response_model=ReportResponse,
)
def generate_report(body: CampaignInput):
    try:
        # Use Gemini to understand the brief
        campaign = extract_campaign_with_ai(body)

        # Match the campaign against creator profiles
        ranked = rank_creators(campaign, CREATORS, 5)

        summary = (
            f"{len(ranked)} creator matches found for "
            f"{campaign.objective.lower()}. "
            "Review portfolio evidence and confirm missing "
            "campaign details before outreach."
        )

        return ReportResponse(
            campaign=campaign,
            total_candidates=len(CREATORS),
            recommendations=ranked,
            report_summary=summary,
        )

    except Exception as exc:
        print(f"Report generation failed: {exc}")
        raise HTTPException(
            status_code=502,
            detail="Report generation failed. Please try again.",
        ) from exc


# Prompt generation
@app.post(
    "/api/prompts/generate",
    response_model=PromptResponse,
)
def prompt_generate(body: PromptRequest):
    return generate_prompt(body)


# List available creators
@app.get("/api/creators", response_model=list[Creator])
def list_creators():
    return CREATORS
