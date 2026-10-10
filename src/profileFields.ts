import type { Role } from "./session";

export const OPTIONS = {
  category: ["Video & UGC", "Photography", "Design & motion", "Writing & strategy"],
  rate: ["₹10,000 – ₹25,000", "₹25,000 – ₹75,000", "₹75,000 – ₹2,00,000", "₹2,00,000+"],
  availability: ["20+ hours", "10–20 hours", "Under 10 hours"],
  industry: ["Consumer technology", "Beauty & wellness", "Fashion", "Food & beverage", "Fintech", "Education", "Travel & hospitality", "Home & living", "Automotive & EV", "Health & nutrition"],
  size: ["1–10 people", "11–50 people", "51–200 people", "200+ people"],
  goal: ["Launch a new product", "Build brand awareness", "Drive conversions", "Always-on social content"],
  budget: ["Under ₹50,000", "₹50,000 – ₹2,00,000", "₹2,00,000 – ₹10,00,000", "₹10,00,000+"],
  channels: ["Instagram & YouTube Shorts", "YouTube", "Regional apps (Moj, Josh, ShareChat)", "LinkedIn", "Multi-channel"],
};

export interface FieldDef {
  name: string;
  label: string;
  kind: "text" | "textarea" | "select" | "url";
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface FieldSection { title: string; fields: FieldDef[] }

/** The onboarding questions for each workspace, grouped the way the profile page shows them. */
export const ROLE_FIELDS: Record<Role, FieldSection[]> = {
  creator: [
    {
      title: "Creator profile",
      fields: [
        { name: "displayName", label: "Creator / display name", kind: "text", required: true, placeholder: "e.g. Maya Creates" },
        { name: "location", label: "Based in", kind: "text", required: true, placeholder: "City, country" },
        { name: "category", label: "Primary creator category", kind: "select", options: OPTIONS.category },
        { name: "bio", label: "Short bio", kind: "textarea", placeholder: "Tell brands what makes your work distinctive..." },
        { name: "social", label: "Instagram / TikTok", kind: "text", placeholder: "@yourhandle" },
        { name: "portfolio", label: "Portfolio URL", kind: "url", placeholder: "https://" },
      ],
    },
    {
      title: "Craft & availability",
      fields: [
        { name: "skills", label: "Skills and specialties", kind: "text", placeholder: "UGC, direction, editing, beauty..." },
        { name: "rate", label: "Typical project rate", kind: "select", options: OPTIONS.rate },
        { name: "availability", label: "Weekly availability", kind: "select", options: OPTIONS.availability },
      ],
    },
  ],
  client: [
    {
      title: "Brand",
      fields: [
        { name: "brand", label: "Brand name", kind: "text", required: true, placeholder: "e.g. Northstar Labs" },
        { name: "website", label: "Company website", kind: "url", required: true, placeholder: "https://" },
        { name: "description", label: "What your brand does", kind: "textarea", placeholder: "A short description of your product and audience..." },
        { name: "industry", label: "Industry", kind: "select", options: OPTIONS.industry },
        { name: "size", label: "Company size", kind: "select", options: OPTIONS.size },
      ],
    },
    {
      title: "Creative needs",
      fields: [
        { name: "goal", label: "Main content goal", kind: "select", options: OPTIONS.goal },
        { name: "budget", label: "Monthly content budget", kind: "select", options: OPTIONS.budget },
        { name: "channels", label: "Primary channels", kind: "select", options: OPTIONS.channels },
        { name: "tone", label: "Brand tone", kind: "text", placeholder: "e.g. optimistic, intelligent, candid" },
      ],
    },
  ],
};

/** Turns "northstar.com" into a safe https link; anything that isn't http(s) is not linked. */
export function toLink(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
