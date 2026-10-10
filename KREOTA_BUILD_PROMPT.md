# Kreota — Build Prompt

Build a polished, responsive web application named **Kreota**, an AI Content Creator Marketplace that connects verified brands with verified content creators and supports the full workflow from campaign idea to final content delivery.

## Product direction

- Position Kreota as a premium creative operating system, not a generic freelancer marketplace.
- Use a predominantly black, white, and warm-grey palette with restrained pastel mint, lilac, peach, and powder-blue accents.
- Keep the interface editorial, minimal, highly legible, and professional.
- Use the supplied Kreota “K” logo throughout authentication, navigation, and metadata.
- Use thoughtful whitespace, thin borders, soft radii, subtle depth, and strong typography.
- Avoid excessive gradients, generic SaaS visuals, or overly colorful UI.
- Make every screen responsive and accessible, with clear focus, hover, loading, empty, success, and error states.

## Core journey

### 1. Authentication

Create a split-screen login/sign-up experience:

- Strong monochrome brand statement on the left.
- Sign-up/sign-in form on the right.
- White “Continue with Google” button using the official Google mark.
- Email, password, forgot password, terms, and validation states.
- Successful authentication continues to role selection.

### 2. Role selection

Ask: **“How will you use Kreota?”**

- “I’m a client” for brands commissioning content.
- “I’m a creator” for professionals producing content.
- Explain the value of each path with concise feature previews.
- Allow users to switch roles later.

### 3. Client onboarding and verification

Collect:

- Brand name, website, work email, industry, company size, location.
- Product/service description and target audience.
- Main marketing goal, monthly budget, primary channels, brand tone.
- Brand assets, social links, and optional billing details.
- Business email verification and agreement to marketplace rules.

Show clear progress, save partial completion, and explain why each detail improves AI recommendations.

### 4. Client AI workspace

The main client page begins with a large conversational input asking what the user wants to create. Accept:

- Product details and unique value proposition.
- Audience and market.
- Campaign objective.
- Required content formats, platforms, timeline, and budget.
- Brand tone, references, and restrictions.

Kreota AI should return a structured strategy report:

- Campaign concept and audience insight.
- Messaging pillars and hook ideas.
- Recommended content system and deliverable mix.
- Platform-specific format and duration recommendations.
- Creative direction, visual mood, and tone.
- Suggested timeline, budget allocation, and performance metrics.
- Risks, missing information, and next best actions.

Provide controls to edit, regenerate, save, export, and turn the strategy into a project brief.

### 5. Creator discovery and outreach

Add a “Find creator matches” action to each strategy. Rank creators using:

- Audience fit, niche, location, platform, style, engagement quality.
- Portfolio relevance, availability, budget fit, ratings, and past performance.

Each creator card should show:

- Portrait, name, verification, title, location.
- AI match score with a short explanation.
- Skills, niches, reach, engagement, rating, starting rate.
- Portfolio preview and availability.

Support search, filters, sorting, save, compare, profile view, and multi-select invites. A client can send a project invitation to several creators at once.

### 6. Project, proposal, and selection workflow

Invited creators receive the same project brief and deadline. Creators can:

- Ask questions.
- Accept or decline the invitation.
- Submit a proposal with concept, approach, deliverables, timeline, revisions, usage rights, and price.

At the deadline, the client sees all proposals in a comparison workspace. Add an AI shortlist tool that ranks proposals by brief alignment, originality, feasibility, value, creator fit, and risk. Make the reasoning transparent and keep the final decision with the client. The client can select a creator, fund the project, and notify all applicants.

### 7. Creator onboarding and profile

Collect:

- Display name, legal name, location, languages, and creator category.
- Biography, skills, niches, platforms, social handles, audience insights.
- Typical rates, turnaround, availability, equipment, and usage-right preferences.
- Identity verification, payout setup, and agreement to creator rules.

Creators can add portfolio projects with media, role, category, client, outcomes, and short case-study descriptions. Include draft, preview, reorder, and publish controls.

### 8. Creator dashboard

Show:

- New high-fit invitations.
- Active and upcoming projects.
- Deliverables due soon.
- Messages requiring attention.
- Monthly earnings and pending payouts.
- Profile strength and portfolio performance.
- Useful AI recommendations for improving match quality.

### 9. Messaging

Create project-aware client/creator messaging with:

- Conversation list and unread states.
- Project context pinned above the chat.
- Text, attachments, links, media previews, and timestamps.
- Video-call action.
- Milestone, proposal, and delivery system messages.
- Search and notification preferences.

### 10. Kreota AI Studio

Build an AI-assisted vertical-video editor for creators:

- Media bin, preview canvas, multi-track timeline, playback, trim, split, reorder.
- Text, captions, brand assets, audio, transitions, and aspect ratios.
- AI smart cut, silence removal, hook rewrite, auto captions, auto reframe, B-roll suggestions, background cleanup, audio enhancement, and platform variants.
- Prompt field such as “Make the first three seconds more attention-grabbing.”
- Brand-safe overlays and brief-aware checks.
- Version history, save, share preview, export, and submit-for-review.

### 11. Review and delivery

Clients can annotate video frames, leave time-coded comments, request revisions, approve deliverables, and download final files. Creators can resolve comments and submit new versions. Keep all decisions and files in a clear audit trail.

## Suggested navigation

Client:

- AI Workspace
- Discover Creators
- Projects
- Messages
- Notifications
- Brand Settings

Creator:

- Overview
- Opportunities
- Active Projects
- Messages
- Kreota Studio
- My Profile
- Earnings

## Technical expectations

- Build reusable UI primitives and feature components.
- Use realistic seeded demo data rather than placeholder text.
- Make primary interactions work in the prototype, including authentication progression, role selection, onboarding steps, AI report generation, search/filter controls, creator invitations, proposal review, messaging, and editor controls.
- Keep data models ready for a real backend: users, brands, creator profiles, projects, invitations, proposals, contracts, milestones, messages, deliverables, versions, reviews, transactions, and notifications.
- Add robust form validation, permission boundaries, responsive behavior, and accessible semantics.
- Preserve a consistent design language across both role-based workspaces.

The final result should feel like a credible, investor-ready creative marketplace product: calm, intelligent, distinctive, and ready to demonstrate end-to-end.
