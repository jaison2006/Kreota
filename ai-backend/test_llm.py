from app.llm import extract_campaign_requirements

result = extract_campaign_requirements(
    """
    Create a 15-second luxury perfume advertisement.
    Use cinematic golden lighting and a vertical 9:16 format
    for Instagram Reels. Budget is $1000.
    """
)

print(result)