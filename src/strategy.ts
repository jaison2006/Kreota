import { app, appCheckDebugToken } from "./firebase";
import { formatINR } from "./data/india";

/** Gemini models to try, newest first; older ones get retired for new projects, so we fall through the list. */
export const AI_MODELS = ["gemini-3.8", "gemini-flash-latest", "gemini-2.5-flash"];

export interface StrategyInput {
  prompt: string;
  objective: string;
  budget: number;
  weeks: number;
  platforms: string[];
  languages: string[];
  brand: string;
  industry: string;
  description: string;
  tone: string;
}

export interface Strategy {
  title: string;
  summary: string;
  audience: { primary: string; insight: string };
  pillars: { name: string; message: string }[];
  hooks: string[];
  contentPlan: { format: string; platform: string; count: number; length: string; purpose: string }[];
  creative: { mood: string; visuals: string; tone: string; avoid: string[] };
  timeline: { week: string; focus: string }[];
  budget: { item: string; percent: number }[];
  kpis: { metric: string; target: string }[];
  creatorNiches: string[];
  risks: string[];
  nextActions: string[];
}

export type Engine = "gemini" | "planner";
export interface StrategyResult { strategy: Strategy; engine: Engine; notice?: string; model?: string; appCheckToken?: string }

/* ---------- Gemini via Firebase AI Logic ---------- */

function buildPrompt(i: StrategyInput) {
  return `You are Kreota's senior creator-marketing strategist for the Indian market.
Write a practical creator campaign strategy as JSON matching the schema.

Brand: ${i.brand || "an Indian D2C brand"}
Industry: ${i.industry || "not specified"}
What the brand does: ${i.description || "not specified"}
Brand tone: ${i.tone || "not specified"}
Campaign request: ${i.prompt}
Main objective: ${i.objective}
Total budget: ${formatINR(i.budget)} (Indian rupees)
Timeline: ${i.weeks} weeks
Platforms: ${i.platforms.join(", ") || "Instagram"}
Content languages: ${i.languages.join(", ") || "Hindi, English"}

Rules:
- Be specific to India: real Indian audiences, cities, festivals, and platforms (Instagram Reels, YouTube Shorts, Moj, Josh, ShareChat). Never mention TikTok.
- Use rupees; budget percentages must add up to 100.
- 3 messaging pillars, 5 short scroll-stopping hooks, 3–6 content plan rows, one timeline row per week (max 8), 4–5 KPIs with numeric targets, 3–4 risks, 4–5 next actions.
- creatorNiches: 3–5 short niche keywords such as "Skincare", "Food", "Tech", "Fitness", "Ethnic wear", "Personal finance".
- Keep each text field to one or two sentences.`;
}

async function strategyFromGemini(input: StrategyInput): Promise<{ strategy: Strategy; model: string }> {
  const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = await import("firebase/ai");
  const str = () => Schema.string();
  const schema = Schema.object({
    properties: {
      title: str(),
      summary: str(),
      audience: Schema.object({ properties: { primary: str(), insight: str() } }),
      pillars: Schema.array({ items: Schema.object({ properties: { name: str(), message: str() } }) }),
      hooks: Schema.array({ items: str() }),
      contentPlan: Schema.array({ items: Schema.object({ properties: { format: str(), platform: str(), count: Schema.integer(), length: str(), purpose: str() } }) }),
      creative: Schema.object({ properties: { mood: str(), visuals: str(), tone: str(), avoid: Schema.array({ items: str() }) } }),
      timeline: Schema.array({ items: Schema.object({ properties: { week: str(), focus: str() } }) }),
      budget: Schema.array({ items: Schema.object({ properties: { item: str(), percent: Schema.integer() } }) }),
      kpis: Schema.array({ items: Schema.object({ properties: { metric: str(), target: str() } }) }),
      creatorNiches: Schema.array({ items: str() }),
      risks: Schema.array({ items: str() }),
      nextActions: Schema.array({ items: str() }),
    },
  });
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  let lastError: unknown;
  for (const name of AI_MODELS) {
    const model = getGenerativeModel(ai, { model: name, generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.8 } });
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), 60_000));
    try {
      const res = await Promise.race([model.generateContent(buildPrompt(input)), timeout]);
      return { strategy: normalise(JSON.parse(res.response.text()), input), model: name };
    } catch (e) {
      lastError = e;
      // A retired or unknown model: try the next one. Anything else (App Check, quota, network) won't be fixed by switching.
      if (!/no longer available|not found|NOT_FOUND|is not supported|unknown model|\[404/i.test((e as Error).message ?? "")) throw e;
    }
  }
  throw lastError;
}

/** Fills gaps and fixes totals so a slightly-off model answer still renders cleanly. */
function normalise(raw: Partial<Strategy>, input: StrategyInput): Strategy {
  const fallback = planStrategy(input);
  const arr = <T,>(v: T[] | undefined, fb: T[]) => (Array.isArray(v) && v.length ? v : fb);
  const budget = arr(raw.budget, fallback.budget).filter((b) => b && b.item && Number.isFinite(b.percent));
  const total = budget.reduce((s, b) => s + b.percent, 0) || 1;
  const scaled = budget.map((b) => ({ item: b.item, percent: Math.round((b.percent / total) * 100) }));
  if (scaled.length) scaled[0].percent += 100 - scaled.reduce((s, b) => s + b.percent, 0);
  return {
    title: raw.title || fallback.title,
    summary: raw.summary || fallback.summary,
    audience: { primary: raw.audience?.primary || fallback.audience.primary, insight: raw.audience?.insight || fallback.audience.insight },
    pillars: arr(raw.pillars, fallback.pillars).slice(0, 4),
    hooks: arr(raw.hooks, fallback.hooks).slice(0, 6),
    contentPlan: arr(raw.contentPlan, fallback.contentPlan).slice(0, 8).map((r) => ({ ...r, count: Math.max(1, Math.round(Number(r.count) || 1)) })),
    creative: { mood: raw.creative?.mood || fallback.creative.mood, visuals: raw.creative?.visuals || fallback.creative.visuals, tone: raw.creative?.tone || fallback.creative.tone, avoid: arr(raw.creative?.avoid, fallback.creative.avoid) },
    timeline: arr(raw.timeline, fallback.timeline).slice(0, 8),
    budget: scaled.length ? scaled : fallback.budget,
    kpis: arr(raw.kpis, fallback.kpis).slice(0, 6),
    creatorNiches: arr(raw.creatorNiches, fallback.creatorNiches).slice(0, 6),
    risks: arr(raw.risks, fallback.risks).slice(0, 5),
    nextActions: arr(raw.nextActions, fallback.nextActions).slice(0, 6),
  };
}

/* ---------- built-in planner (no AI) ---------- */

const KEYWORDS: [RegExp, string[]][] = [
  [/skin|serum|sunscreen|beauty|cosmetic|makeup|glow/i, ["Skincare", "Beauty"]],
  [/food|snack|recipe|chai|coffee|masala|drink|beverage|kitchen|restaurant|biryani/i, ["Food", "Home cooking"]],
  [/phone|laptop|gadget|app|tech|earbud|software|device/i, ["Tech", "Gadgets"]],
  [/fitness|gym|protein|yoga|wellness|health/i, ["Fitness", "Wellness"]],
  [/saree|kurta|fashion|clothing|apparel|ethnic|wear|sneaker/i, ["Fashion", "Ethnic wear"]],
  [/travel|hotel|trip|stay|resort|tour/i, ["Travel"]],
  [/finance|invest|sip|loan|bank|upi|payment|credit/i, ["Personal finance", "Fintech"]],
  [/kid|baby|parent|mom|family/i, ["Parenting", "Family"]],
  [/ev|scooter|bike|car|auto/i, ["Auto", "EV"]],
  [/home|decor|furniture|interior/i, ["Home decor"]],
  [/course|learn|exam|education|student|coding/i, ["Education"]],
];
const INDUSTRY: Record<string, string[]> = {
  "Beauty & wellness": ["Beauty", "Skincare"], "Food & beverage": ["Food", "Home cooking"], "Consumer technology": ["Tech", "Gadgets"],
  Fashion: ["Fashion", "Ethnic wear"], Fintech: ["Personal finance"], Education: ["Education"], "Travel & hospitality": ["Travel"],
  "Home & living": ["Home decor"], "Automotive & EV": ["Auto", "EV"], "Health & nutrition": ["Fitness", "Wellness"],
};
const AUDIENCES: [RegExp, string][] = [
  [/gen ?z|college|student|teen/i, "Gen Z students and first-jobbers, 18–24, in metros and Tier 2 cities"],
  [/mom|mother|parent|family/i, "Young parents, 26–38, managing busy households"],
  [/professional|office|working|corporate/i, "Working professionals, 24–35, in Bengaluru, Mumbai, Pune and Delhi NCR"],
  [/farmer|rural|village/i, "Rural and small-town households across Hindi-speaking states"],
  [/premium|luxury/i, "Affluent urban buyers, 28–45, who research before they buy"],
];

function planStrategy(i: StrategyInput): Strategy {
  const text = `${i.prompt} ${i.description}`;
  const niches = [...new Set([...KEYWORDS.filter(([re]) => re.test(text)).flatMap(([, n]) => n), ...(INDUSTRY[i.industry] ?? [])])].slice(0, 4);
  if (!niches.length) niches.push("Lifestyle", "Relatable");
  const product = (i.prompt.match(/(?:for|launch(?:ing)?|promote|our)\s+(?:our\s+|a\s+|the\s+|new\s+)*([a-z][\w\s-]{2,40}?)(?:[.,]|\s+(?:to|for|in|with|that|during)\b|$)/i)?.[1] ?? "our product").trim();
  const audience = AUDIENCES.find(([re]) => re.test(text))?.[1] ?? "Urban Indians, 22–35, in metros and fast-growing Tier 2 cities";
  const platforms = i.platforms.length ? i.platforms : ["Instagram", "YouTube Shorts"];
  const langs = i.languages.length ? i.languages : ["Hindi", "English"];
  const awareness = /awareness|launch/i.test(i.objective);
  const conversion = /conversion/i.test(i.objective);
  const perWeek = Math.max(2, Math.min(6, Math.round(i.budget / Math.max(1, i.weeks) / 40_000)));
  const plan = platforms.slice(0, 4).map((p, k) => ({
    format: /YouTube$/.test(p) ? "Long-form review" : /LinkedIn|X/.test(p) ? "Founder-led post" : k === 0 ? "Creator Reel series" : "Short-form cut-downs",
    platform: p,
    count: /YouTube$/.test(p) ? Math.max(1, Math.round(i.weeks / 4)) : Math.max(2, Math.round((perWeek * i.weeks) / Math.max(1, platforms.length))),
    length: /YouTube$/.test(p) ? "6–10 min" : /LinkedIn|X/.test(p) ? "150–250 words" : "20–45 sec",
    purpose: k === 0 ? (awareness ? "Reach new viewers with a strong first-2-second hook" : "Show the product solving a real problem") : conversion ? "Retarget warm viewers with offer-led cuts" : "Extend reach and test hooks cheaply",
  }));
  plan.push({ format: "Stories with link sticker", platform: "Instagram", count: i.weeks * 2, length: "3–5 frames", purpose: "Drive clicks and answer questions in polls" });
  const split = conversion ? [55, 30, 10, 5] : awareness ? [60, 25, 10, 5] : [65, 20, 10, 5];
  const phases = ["Seed: brief creators, collect first cuts and test 5 hooks", "Launch: publish hero creator content across platforms", "Amplify: boost the top 20% of posts with paid spend", "Optimise: double down on winning hooks and formats", "Convert: offer-led content and creator codes", "Sustain: always-on content from the best two creators"];
  return {
    title: `${i.brand ? `${i.brand}: ` : ""}${i.objective.toLowerCase().includes("launch") ? "Launch" : "Growth"} plan for ${product}`,
    summary: `A ${i.weeks}-week creator-led campaign on ${platforms.join(", ")} that introduces ${product} to ${audience.split(",")[0]} in ${langs.join(" and ")}, with ${formatINR(i.budget)} weighted towards creators who already speak to this audience.`,
    audience: { primary: audience, insight: `They trust people like them over ads — real routines, honest reviews and regional-language creators outperform polished studio content for ${niches[0].toLowerCase()}.` },
    pillars: [
      { name: "Real-life proof", message: `Show ${product} in an everyday Indian setting with honest before-and-after moments.` },
      { name: "Why it's different", message: `One clear reason ${product} beats what people use today, said in the creator's own words.` },
      { name: "Easy next step", message: conversion ? "A creator code or limited offer that makes trying it a no-brainer." : "A simple call to follow, save or try it — no hard sell." },
    ],
    hooks: [
      `I tried ${product} for 7 days so you don't have to`,
      `Stop scrolling if you're still doing this the old way`,
      `The money I wasted before finding ${product}`,
      `My honest review — I didn't expect this`,
      `3 things nobody tells you about ${niches[0].toLowerCase()}`,
    ],
    contentPlan: plan,
    creative: {
      mood: "Warm, natural light, real homes and streets — confident but never salesy",
      visuals: `Tactile close-ups of ${product}, quick cuts, bold on-screen captions in ${langs[0]}`,
      tone: i.tone || "Friendly, honest and specific",
      avoid: ["Over-polished studio looks", "Long intros before the hook", "Reading the brand script word for word"],
    },
    timeline: Array.from({ length: Math.min(8, Math.max(2, i.weeks)) }, (_, k) => ({ week: `Week ${k + 1}`, focus: phases[Math.min(k, phases.length - 1)] })),
    budget: [
      { item: "Creator fees", percent: split[0] },
      { item: "Paid amplification", percent: split[1] },
      { item: "Production & product seeding", percent: split[2] },
      { item: "Contingency", percent: split[3] },
    ],
    kpis: [
      { metric: "Reach", target: `${Math.round(i.budget / 1.5).toLocaleString("en-IN")}+ people` },
      { metric: "Average view-through (3s)", target: "40%+" },
      { metric: "Engagement rate", target: "5%+" },
      { metric: "Saves and shares", target: `${Math.round(i.budget / 200).toLocaleString("en-IN")}+` },
      ...(conversion ? [{ metric: "Creator-code orders", target: `${Math.round(i.budget / 1500).toLocaleString("en-IN")}+` }] : []),
    ],
    creatorNiches: niches,
    risks: [
      "Hooks that don't land in the first 2 seconds — test several before boosting",
      "Creators sounding scripted — give a brief, not a script",
      langs.length > 1 ? "Splitting budget across too many languages — start with the top two" : "Missing regional audiences by staying in one language",
      i.budget < 75_000 ? "A tight budget — favour 2–3 micro-creators over one big name" : "Over-spending on reach before proof — hold 25% until week 2 results",
    ],
    nextActions: [
      "Turn this strategy into a project brief",
      `Invite 4–6 ${niches[0].toLowerCase()} creators who post in ${langs[0]}`,
      "Ship product samples to shortlisted creators",
      "Agree a posting calendar and usage rights",
      "Set up creator codes and UTM links to track sales",
    ],
  };
}

/* ---------- entry point ---------- */

export async function generateStrategy(input: StrategyInput): Promise<StrategyResult> {
  try {
    const { strategy, model } = await strategyFromGemini(input);
    return { strategy, model, engine: "gemini" };
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    const msg = (e as Error).message ?? "";
    if (/App Check/i.test(msg)) {
      return {
        strategy: planStrategy(input), engine: "planner", appCheckToken: appCheckDebugToken ?? undefined,
        notice: appCheckDebugToken
          ? "Gemini is on, but Firebase App Check is blocking this browser. Register the debug token below in the Firebase console (App Check → Apps → ⋮ → Manage debug tokens), then generate again."
          : "Gemini is on, but Firebase App Check is blocking requests from this site. Add a reCAPTCHA v3 site key (VITE_RECAPTCHA_SITE_KEY) registered in App Check, or turn off App Check enforcement for Firebase AI Logic.",
      };
    }
    const notice = code.includes("api-not-enabled") || /SERVICE_DISABLED|has not been used|not enabled/i.test(msg)
      ? "Gemini isn't switched on for this project yet, so Kreota's built-in planner wrote this. Turn on Firebase AI Logic in the Firebase console to use Gemini."
      : `Gemini couldn't answer (${msg.replace(/^.*?\]\s*/, "").slice(0, 120) || "unknown error"}), so Kreota's built-in planner wrote this instead.`;
    return { strategy: planStrategy(input), engine: "planner", notice };
  }
}

/** Plain-text export of a strategy (Markdown). */
export function strategyToMarkdown(s: Strategy, input: StrategyInput) {
  const lines = [
    `# ${s.title}`, "", s.summary, "",
    `**Budget:** ${formatINR(input.budget)} · **Timeline:** ${input.weeks} weeks · **Platforms:** ${input.platforms.join(", ")}`, "",
    "## Audience", `${s.audience.primary}`, "", `_Insight:_ ${s.audience.insight}`, "",
    "## Messaging pillars", ...s.pillars.map((p) => `- **${p.name}** — ${p.message}`), "",
    "## Hooks", ...s.hooks.map((h) => `- ${h}`), "",
    "## Content plan", "| Format | Platform | Count | Length | Purpose |", "|---|---|---|---|---|",
    ...s.contentPlan.map((r) => `| ${r.format} | ${r.platform} | ${r.count} | ${r.length} | ${r.purpose} |`), "",
    "## Creative direction", `- Mood: ${s.creative.mood}`, `- Visuals: ${s.creative.visuals}`, `- Tone: ${s.creative.tone}`, `- Avoid: ${s.creative.avoid.join("; ")}`, "",
    "## Timeline", ...s.timeline.map((t) => `- **${t.week}:** ${t.focus}`), "",
    "## Budget split", ...s.budget.map((b) => `- ${b.item}: ${b.percent}% (${formatINR(Math.round((input.budget * b.percent) / 100))})`), "",
    "## KPIs", ...s.kpis.map((k) => `- ${k.metric}: ${k.target}`), "",
    "## Risks", ...s.risks.map((r) => `- ${r}`), "",
    "## Next actions", ...s.nextActions.map((a) => `- ${a}`), "",
  ];
  return lines.join("\n");
}
