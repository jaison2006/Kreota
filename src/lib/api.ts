const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"

export interface CampaignAnalysis {
  objective?: string | null

  target_audience?: string | null

  content_type?: string | null

  visual_style?: string | null

  mood?: string | null

  keywords: string[]

  required_skills: string[]

  preferred_tools: string[]

  platform?: string | null

  aspect_ratio?: string | null

  duration_seconds?: number | null

  budget?: string | null

  deadline?: string | null

  commercial_use?: boolean | null

  missing_information: string[]
}

export async function analyzeCampaign(
  description: string,
): Promise<CampaignAnalysis> {
  const trimmed = description.trim()

  if (trimmed.length < 10) {
    throw new Error(
      "Please enter at least 10 characters describing your campaign.",
    )
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/api/campaign/analyze`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({ description: trimmed }),
    })
  } catch {
    throw new Error(
      `Unable to connect to the AI service at ${API_BASE_URL}. Ensure the backend is running.`,
    )
  }

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`

    try {
      const errorJson = await response.json()

      if (errorJson && typeof errorJson === "object") {
        if (typeof errorJson.detail === "string") {
          errorDetail = errorJson.detail
        } else if (Array.isArray(errorJson.detail)) {
          errorDetail = errorJson.detail

            .map((item: { msg?: string }) => item.msg || JSON.stringify(item))

            .join("; ")
        }
      }
    } catch {
      // response wasn't JSON
    }

    throw new Error(errorDetail)
  }

  return response.json()
}
