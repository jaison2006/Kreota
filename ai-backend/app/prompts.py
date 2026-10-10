from .schemas import PromptRequest, PromptResponse

TOOL_GUIDANCE = {
    "higgsfield": "Format for an AI video workflow. Separate subject, scene, camera movement, lighting, motion, duration, and aspect ratio. Use only controls supported by the selected Higgsfield model.",
    "openart": "Format for an image or video generation workflow. Clearly describe subject, composition, style, lighting, output format, and consistency constraints. Adapt to the selected OpenArt model.",
    "claude": "Ask for creative development, storyboard refinement, scripts, shot lists, and production planning. Do not frame Claude as a video renderer.",
    "chatgpt": "Ask for creative ideation, prompt refinement, scripts, storyboards, and planning. Image generation depends on the selected ChatGPT capabilities; do not assume a specific tool is available.",
    "generic": "Write a portable creative brief that can be adapted to the selected generation tool.",
}


def generate_prompt(request: PromptRequest) -> PromptResponse:
    c = request.campaign
    creator_line = f"Creator context: {request.creator.name} — {request.creator.title}. Skills: {', '.join(request.creator.skills)}." if request.creator else "Creator context: not selected."
    visual = ", ".join(c.style_keywords) or "Use a visual style consistent with the campaign brief."
    requirements = [f"Objective: {c.objective}", f"Content type: {c.content_type}", f"Visual direction: {visual}"]
    if c.platform: requirements.append(f"Platform: {c.platform}")
    if c.aspect_ratio: requirements.append(f"Aspect ratio: {c.aspect_ratio}")
    if c.duration_seconds: requirements.append(f"Duration: {c.duration_seconds} seconds")
    if c.tools: requirements.append(f"Requested tools/models: {', '.join(c.tools)}")
    if c.keywords: requirements.append(f"Keywords: {', '.join(c.keywords)}")
    if c.commercial_use is not None: requirements.append(f"Commercial use required: {'yes' if c.commercial_use else 'no'}")
    if request.reference_context: requirements.append("Retrieved reference context:\n" + "\n".join(request.reference_context))
    requirements.append("Preserve all supplied brand/product details. Do not invent claims, labels, logos, or rights. If a required detail is missing, flag it for confirmation rather than guessing.")
    prompt = "Create a production-ready creative concept based on the following requirements.\n\n" + "\n".join(f"- {r}" for r in requirements) + "\n\n" + creator_line + "\n\nTool-specific guidance: " + TOOL_GUIDANCE[request.target_tool]
    return PromptResponse(target_tool=request.target_tool, title=f"{c.objective.title()} — Master Prompt", prompt=prompt, sections={"objective": c.objective, "visual_direction": visual, "technical_requirements": "; ".join([x for x in [c.platform, c.aspect_ratio, f"{c.duration_seconds}s" if c.duration_seconds else None] if x]), "tool_guidance": TOOL_GUIDANCE[request.target_tool]}, retrieved_sources=[])
