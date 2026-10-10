const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function analyzeCampaign(description: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/campaign/analyze`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.detail || `Request failed: ${response.status}`
    );
  }

  return response.json();
}
