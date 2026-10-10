from .schemas import CampaignSpec, Creator, CreatorMatch


def _norm(values: list[str]) -> set[str]:
    return {v.casefold().strip() for v in values if v.strip()}


def rank_creators(campaign: CampaignSpec, creators: list[Creator], limit: int = 5) -> list[CreatorMatch]:
    """Explainable baseline ranking. Replace lexical overlap with embeddings when data is ready."""
    results: list[CreatorMatch] = []
    styles = _norm(campaign.style_keywords + campaign.keywords)
    skills = _norm(campaign.required_skills)
    tools = _norm(campaign.tools)
    campaign_terms = _norm(campaign.keywords + campaign.style_keywords + campaign.required_skills + ([campaign.content_type] if campaign.content_type != "unknown" else []))

    for creator in creators:
        reasons: list[str] = []; gaps: list[str] = []
        creator_skills = _norm(creator.skills + creator.specializations)
        creator_tools = _norm(creator.tools)
        creator_types = _norm(creator.content_types)
        portfolio_text = " ".join(creator.portfolio_descriptions).casefold()
        score = 0.0
        skill_hits = skills & creator_skills
        if skills:
            score += 30 * len(skill_hits) / len(skills)
            if skill_hits: reasons.append("Relevant skills: " + ", ".join(sorted(skill_hits)))
            missing = skills - creator_skills
            if missing: gaps.append("No listed evidence for: " + ", ".join(sorted(missing)))
        tool_hits = tools & creator_tools
        if tools:
            score += 20 * len(tool_hits) / len(tools)
            if tool_hits: reasons.append("Uses requested tools: " + ", ".join(sorted(tool_hits)))
        if campaign.content_type != "unknown":
            if campaign.content_type in creator_types: score += 15; reasons.append(f"Works in {campaign.content_type}")
            else: gaps.append(f"No listed {campaign.content_type} specialization")
        overlap = [term for term in campaign_terms if len(term) > 2 and (term in portfolio_text or term in creator.bio.casefold() or term in " ".join(creator.specializations).casefold())]
        if campaign_terms:
            score += min(25, 25 * len(set(overlap)) / max(1, min(5, len(campaign_terms))))
            if overlap: reasons.append("Portfolio or profile mentions: " + ", ".join(overlap[:3]))
        if campaign.budget_max is not None and creator.price_min is not None:
            if creator.price_min <= campaign.budget_max:
                score += 10; reasons.append("Starting price is within the stated budget")
            else: gaps.append("Starting price may exceed the stated budget")
        if campaign.commercial_use is True:
            if creator.commercial_use_supported is True: reasons.append("Commercial use marked as supported")
            elif creator.commercial_use_supported is False: gaps.append("Commercial use is not supported")
            else: gaps.append("Commercial-use terms need confirmation")
        if creator.available is False: gaps.append("Currently marked unavailable")
        if not reasons: reasons.append("Limited profile data; review portfolio manually")
        results.append(CreatorMatch(creator=creator, match_score=max(0, min(99, round(score))), reasons=reasons, gaps=gaps))
    return sorted(results, key=lambda x: (x.match_score, x.creator.available is True), reverse=True)[:limit]
