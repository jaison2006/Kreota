import os
import re
from .schemas import CampaignInput, CampaignSpec

STYLE_TERMS = ["cinematic", "luxury", "minimal", "playful", "editorial", "surreal", "photorealistic", "futuristic", "premium", "warm", "dramatic", "golden lighting", "moody"]
SKILL_TERMS = ["product cinematography", "storyboarding", "color grading", "motion design", "video editing", "image generation", "art direction", "sound design", "product photography", "animation", "retouching"]
TOOL_TERMS = ["Higgsfield", "OpenArt", "Midjourney", "Runway", "Kling", "ChatGPT", "Claude"]
PLATFORM_TERMS = ["Instagram Reels", "TikTok", "YouTube", "YouTube Shorts", "website", "LinkedIn"]


def _unique(items: list[str]) -> list[str]:
    seen: set[str] = set(); out = []
    for item in items:
        key = item.casefold()
        if key not in seen:
            seen.add(key); out.append(item)
    return out


def extract_campaign(data: CampaignInput) -> CampaignSpec:
    """Deterministic local baseline; replace/augment with a schema-constrained LLM call."""
    text = data.description.strip()
    lower = text.casefold()
    content_type = "unknown"
    if any(x in lower for x in ["video", "film", "reel", "commercial", "ad spot"]): content_type = "video"
    elif any(x in lower for x in ["animation", "animated"]): content_type = "animation"
    elif any(x in lower for x in ["image", "photo", "poster", "graphic", "visual"]): content_type = "image"
    elif any(x in lower for x in ["script", "copywriting", "caption", "voiceover"]): content_type = "writing"

    styles = [term for term in STYLE_TERMS if term in lower]
    skills = [term for term in SKILL_TERMS if term in lower]
    tools = [term for term in TOOL_TERMS if term.casefold() in lower]
    platforms = [term for term in PLATFORM_TERMS if term.casefold() in lower]
    ratio_match = re.search(r"\b(\d{1,2}\s*:\s*\d{1,2})\b", text)
    duration_match = re.search(r"\b(\d{1,3})\s*(?:-| )?seconds?\b", lower)
    budget_match = re.search(r"(?:\$|usd\s*)(\d[\d,]*(?:\.\d+)?)", lower)
    product_terms = ["perfume", "fragrance", "skincare", "beauty", "fashion", "food", "beverage", "game", "app", "product"]
    product = next((p for p in product_terms if p in lower), None)
    objective = f"Create a {content_type} campaign" if content_type != "unknown" else "Create campaign content"
    if product: objective += f" for {product}"
    missing = []
    if not platforms: missing.append("target platform")
    if not ratio_match: missing.append("aspect ratio")
    if not duration_match and content_type in ("video", "animation"): missing.append("duration")
    if data.budget_min is None and data.budget_max is None and not budget_match: missing.append("budget")
    if data.deadline is None: missing.append("deadline")

    keywords = _unique(styles + skills + tools + platforms + ([ratio_match.group(1).replace(" ", "") if ratio_match else ""]) + ([f"{duration_match.group(1)} seconds" if duration_match else ""]))
    return CampaignSpec(
        objective=objective, content_type=content_type, style_keywords=_unique(styles),
        required_skills=_unique(skills), tools=_unique(tools), platform=platforms[0] if platforms else None,
        aspect_ratio=ratio_match.group(1).replace(" ", "") if ratio_match else None,
        duration_seconds=int(duration_match.group(1)) if duration_match else None,
        budget_min=data.budget_min, budget_max=data.budget_max, deadline=data.deadline,
        commercial_use=data.commercial_use, mandatory_requirements=[], optional_preferences=[],
        keywords=keywords, missing_information=missing,
    )

from .llm import extract_campaign_requirements


def extract_campaign_with_ai(body):
    """Extract campaign requirements using Gemini."""
    result = extract_campaign_requirements(body.description)

    # Validate the extracted requirements using your existing schema
    from .schemas import CampaignSpec

    return CampaignSpec(**result)
