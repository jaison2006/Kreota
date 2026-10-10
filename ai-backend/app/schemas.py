from typing import Literal
from pydantic import BaseModel, Field

ContentType = Literal["video", "image", "animation", "design", "writing", "mixed", "unknown"]

class CampaignInput(BaseModel):
    description: str = Field(min_length=10, max_length=12000)
    budget_min: float | None = Field(default=None, ge=0)
    budget_max: float | None = Field(default=None, ge=0)
    deadline: str | None = None
    commercial_use: bool | None = None

class CampaignSpec(BaseModel):
    objective: str
    audience: str | None = None
    content_type: ContentType = "unknown"
    style_keywords: list[str] = []
    required_skills: list[str] = []
    tools: list[str] = []
    platform: str | None = None
    aspect_ratio: str | None = None
    duration_seconds: int | None = Field(default=None, ge=1)
    budget_min: float | None = None
    budget_max: float | None = None
    deadline: str | None = None
    commercial_use: bool | None = None
    mandatory_requirements: list[str] = []
    optional_preferences: list[str] = []
    keywords: list[str] = []
    missing_information: list[str] = []

class Creator(BaseModel):
    id: str
    name: str
    title: str
    bio: str = ""
    skills: list[str] = []
    specializations: list[str] = []
    tools: list[str] = []
    content_types: list[str] = []
    portfolio_descriptions: list[str] = []
    portfolio_urls: list[str] = []
    price_min: float | None = None
    price_max: float | None = None
    available: bool | None = None
    verified_tools: list[str] = []
    commercial_use_supported: bool | None = None

class CreatorMatch(BaseModel):
    creator: Creator
    match_score: int
    reasons: list[str]
    gaps: list[str] = []

class ReportResponse(BaseModel):
    campaign: CampaignSpec
    total_candidates: int
    recommendations: list[CreatorMatch]
    report_summary: str

class PromptRequest(BaseModel):
    campaign: CampaignSpec
    creator: Creator | None = None
    target_tool: Literal["higgsfield", "openart", "claude", "chatgpt", "generic"] = "generic"
    reference_context: list[str] = []

class PromptResponse(BaseModel):
    target_tool: str
    title: str
    prompt: str
    sections: dict[str, str]
    retrieved_sources: list[str] = []
    note: str = "Review tool-specific controls and campaign requirements before production."



class CampaignRequest(BaseModel):
    description: str = Field(min_length=10, max_length=10000)


class CampaignResponse(BaseModel):
    objective: str | None = None
    target_audience: str | None = None
    content_type: str | None = None
    visual_style: str | None = None
    mood: str | None = None
    keywords: list[str] = []
    required_skills: list[str] = []
    preferred_tools: list[str] = []
    platform: str | None = None
    aspect_ratio: str | None = None
    duration_seconds: int | None = None
    budget: str | None = None
    deadline: str | None = None
    commercial_use: bool | None = None
    missing_information: list[str] = []