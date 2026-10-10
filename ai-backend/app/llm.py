import json
import os
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ServerError

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key) if api_key else None

MODELS = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
]


def extract_campaign_requirements(description: str) -> dict:
    if client is None:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    prompt = f"""
Analyze this creative campaign description.

Return JSON with these fields:
- objective
- target_audience
- content_type
- visual_style
- mood
- keywords
- required_skills
- preferred_tools
- platform
- aspect_ratio
- duration_seconds
- budget
- deadline
- commercial_use
- missing_information

Use null for unknown scalar values and empty arrays for unknown lists.
Do not invent requirements.

Campaign description:
{description}
"""

    last_error = None

    for model in MODELS:
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.2,
                    ),
                )

                if not response.text:
                    raise RuntimeError("Gemini returned an empty response")

                return json.loads(response.text)

            except ServerError as exc:
                last_error = exc
                print(
                    f"{model} unavailable "
                    f"(attempt {attempt + 1}/3)."
                )

                if attempt < 2:
                    time.sleep(2 ** (attempt + 1))

    raise RuntimeError(
        "All configured Gemini models failed. "
        "Please retry later or verify available models. "
        f"Last error: {last_error}"
    )