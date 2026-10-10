# Kreota AI Intelligence API (starter)

This is a first backend milestone for the Kreota AI branch. It provides a FastAPI scaffold for campaign extraction, explainable creator ranking, report JSON, and tool-specific prompt drafting.

> Important: this is a deterministic local baseline, not a production LLM/RAG system yet. Creator records are fictional fixtures. Match scores are explainable prototype scores, not calibrated probabilities. Replace fixture data with authenticated marketplace database queries before production.

## Run locally

```bash
cd ai-backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` for the interactive API docs.

## Endpoints

- `GET /health` — service health
- `GET /api/creators` — fictional development creators
- `POST /api/campaign/extract` — natural-language brief to structured campaign fields
- `POST /api/creators/match` — rank creators for a supplied `CampaignSpec`
- `POST /api/reports/generate` — campaign extraction plus recommendations in one report payload
- `POST /api/prompts/generate` — create an editable prompt tailored to Higgsfield, OpenArt, Claude, ChatGPT, or generic use

Example request:

```json
{
  "description": "Create a cinematic luxury perfume video for Instagram Reels, 15 seconds, 9:16 vertical, golden lighting.",
  "budget_min": 500,
  "budget_max": 1500,
  "commercial_use": true
}
```

## Tests

```bash
pytest -q
```

## Next implementation milestones

1. Add a provider adapter for Gemini structured extraction using `GEMINI_API_KEY`; retain deterministic fallback for tests.
2. Replace `SAMPLE_CREATORS` with real creator/profile/portfolio retrieval from the Kreota database.
3. Add embeddings and pgvector semantic search for portfolio descriptions.
4. Implement document ingestion, chunking, embeddings, retrieval, and citations for current tool documentation (RAG).
5. Generate prompts with retrieved tool-specific context; validate tool capability claims and show sources.
6. Add auth, rate limiting, observability, secret management, and privacy controls before deployment.

## Frontend integration

The React app can call `POST http://localhost:8000/api/reports/generate` with a campaign description. The returned JSON has `campaign`, `total_candidates`, `recommendations`, and `report_summary`. Configure CORS with `CORS_ORIGINS` for the Vite origin in use.
