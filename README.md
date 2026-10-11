# Kreota — AI-Powered Creator Marketplace

**Turning creative ideas into meaningful collaborations.**

Kreota is an AI-powered creative collaboration platform designed to connect brands and agencies with AI content creators. It aims to simplify the journey from an initial campaign idea to creator discovery, portfolio evaluation, and project collaboration.

Developed for the **BYTE XL Hackathon**, Kreota focuses on making the AI creator marketplace more structured, accessible, and transparent.

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Our Solution](#our-solution)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Project Structure](#project-structure)
- [Future Scope](#future-scope)
- [Team](#team)
- [Acknowledgements](#acknowledgements)

---

## Overview

Generative AI is changing how digital content is created. AI filmmakers, animators, visual artists, and generative designers can produce increasingly sophisticated creative work.

However, brands often face challenges when trying to find suitable AI creators, evaluate their capabilities, understand their workflows, and communicate campaign requirements effectively.

Kreota addresses this challenge through a unified marketplace experience with two dedicated user journeys:

**For Brands**
- Define creative campaign requirements.
- Transform rough ideas into structured campaign briefs.
- Discover and evaluate relevant creators.
- Explore creator portfolios and available profile information.
- Shortlist candidates and manage collaboration workflows.

**For AI Creators**
- Build a professional creator profile.
- Showcase previous projects and creative work.
- Highlight skills, specializations, and AI tools.
- Discover relevant campaign opportunities.
- Participate in proposal and project workflows.

## Problem Statement

**AI Content Creator Marketplace**

Design and build an AI-native marketplace connecting AI creators with brands and creative agencies.

The platform should help brands discover suitable creators, publish creative briefs, evaluate AI-specific portfolios, and manage engagements from discovery through delivery.

### The problem we address

Traditional freelance and influencer marketplaces do not always provide the information brands need to evaluate AI-native creative capabilities.

Important considerations include:
- Which AI tools and models a creator uses.
- What types of content the creator specializes in.
- How the creator approaches a production workflow.
- Whether portfolio work is relevant to the campaign.
- What commercial-use and licensing conditions apply.

Kreota is designed to bring these considerations into a more focused creative collaboration experience.

## Our Solution

Kreota combines AI-assisted campaign planning with creator discovery and collaboration workflows.

A brand can begin with a rough creative idea and use the platform's campaign-planning experience to organize requirements. It can then explore relevant creators, evaluate available profile information, and move towards a potential collaboration.

Creators, in turn, can present their professional capabilities and explore opportunities suited to their work.

Our goal is to reduce friction between **what a brand wants to create and the creator who can help bring that idea to life.**

## Key Features

### 1. Separate Brand and Creator Experiences

Dedicated onboarding and workspace experiences serve the different needs of brands and AI creators.

### 2. AI-Assisted Campaign Analysis

Help transform an initial campaign idea into structured creative requirements and planning insights.

Depending on the configured workflow, campaign analysis can cover:
- Campaign objectives and audience.
- Creative direction and content requirements.
- Suggested creative hooks.
- Production considerations.
- Relevant creator specializations.

### 3. Creator Discovery

Explore creators using available search, filtering, profile information, and matching-related insights.

### 4. Creator Profiles and Portfolios

Provide a structured way to present creator specializations, skills, previous projects, tools, and creative experience.

### 5. Creator Verification Workflow

Support a trust-oriented approach to reviewing creator-submitted information and presenting verification status where the relevant review process is implemented.

### 6. Proposals and Project Collaboration

Connect creator discovery with the next stages of collaboration through available proposal, project, and communication workflows.

### 7. Unified Marketplace Experience

Bring campaign planning, creator evaluation, and collaboration into one connected application.

> Note: Feature availability depends on the current implementation and configuration. Verification badges, AI recommendations, and other trust or intelligence features should be interpreted according to the evidence and functionality actually provided by the application.

---

## How It Works

### Brand Journey

1. Access the brand workspace.
2. Set up the company profile.
3. Enter a campaign idea and relevant requirements.
4. Review the available AI-assisted campaign analysis.
5. Discover creators and explore their profiles.
6. Evaluate suitability and shortlist relevant candidates.
7. Continue through the available proposal and collaboration workflow.

### Creator Journey

1. Access the creator workspace.
2. Set up a professional profile.
3. Add skills, specializations, and relevant AI tools.
4. Showcase previous projects and portfolio work.
5. Complete any applicable verification process.
6. Explore relevant campaign opportunities.
7. Participate in proposals and project workflows.

---

## Technology Stack

Kreota uses a modern web application stack.

| Technology | Purpose |
|---|---|
| React | Component-based user interface |
| Vite | Development server and build tooling |
| TypeScript | Type safety and maintainable code |
| Tailwind CSS | Utility-first styling |
| Firebase configuration | Backend service integration, where enabled |
| pnpm | Package management |

Additional libraries and integrations depend on the current project configuration.

---

## Getting Started

Follow these steps to run the project locally.

### Prerequisites

Install:
- [Node.js](https://nodejs.org/) — use a version compatible with the project.
- [pnpm](https://pnpm.io/installation) — package manager used by this repository.

Verify your installations:

```bash
node -v
pnpm -v
```

### 1. Clone the repository

```bash
git clone https://github.com/jaison2006/Kreota.git
```

### 2. Navigate into the project

```bash
cd Kreota
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Configure environment variables

Inspect the provided `.env.example` file and follow the configuration instructions for the services enabled in your version of Kreota.

Create a local `.env` file if required, using only the variables documented by the project.

Do not commit private API keys, passwords, or production credentials.

### 5. Start the development server

```bash
pnpm dev
```

Open the local URL printed in the terminal. With a standard Vite configuration, this is commonly `http://localhost:5173`.

### 6. Build for production

```bash
pnpm build
```

### 7. Preview the production build

```bash
pnpm preview
```

If a command differs from the scripts in `package.json`, use the scripts defined in the repository as the source of truth.

---

## Environment Configuration

Kreota includes Firebase-related configuration files. The services required for a complete run depend on the current implementation.

Before running the application:

1. Review `.env.example`.
2. Identify any required Firebase or AI-provider configuration.
3. Configure the appropriate development environment.
4. Confirm that required backend services and permissions are available.
5. Never expose server-side secrets in frontend environment variables.

Public Firebase client configuration is not a substitute for appropriate database rules, authentication, and authorization.

---

## Project Structure

The repository includes a Vite application with source code under `src/` and static assets under `public/`.

A simplified view:

```text
Kreota/
├── public/              # Static assets
├── src/                 # Application source code
├── .env.example         # Environment configuration template
├── firebase.json        # Firebase configuration
├── database.rules.json  # Database rules configuration
├── index.html           # Application HTML entry
├── package.json         # Scripts and dependencies
├── pnpm-lock.yaml       # Locked dependency versions
├── pnpm-workspace.yaml  # pnpm workspace configuration
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── README.md            # Project documentation
```

Individual modules and features may be organized further within `src/`.

---

## Future Scope

Potential improvements for Kreota include:

- More advanced semantic creator matching.
- Evidence-backed creator verification.
- AI-assisted storyboard development.
- Improved portfolio and workflow evaluation.
- More detailed campaign and project analytics.
- Enhanced proposal and revision management.
- Additional integrations with creative tools and platforms.
- Expanded creator trust and commercial-use information.

These are future development opportunities, not claims that every feature is currently available.

---

## Team

**Team Kreota**

Developed as part of the BYTE XL Hackathon.

Our team is focused on exploring how AI can improve creative discovery, campaign planning, and collaboration between brands and AI-native creators.

---

## Acknowledgements

We thank BYTE XL and the hackathon organizers for the opportunity to develop a solution for the AI Content Creator Marketplace challenge.

---

**Kreota — Create. Collaborate. Amplify.**
