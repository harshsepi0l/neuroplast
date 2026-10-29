# neuroplast

A practice website built with Next.js, React, and TypeScript. The first
playable chapter is linear equations: take a ten-question boss challenge, see a
score and skill breakdown, practice missed skills through recall and application,
then retake a new version of the challenge.

The Knowledge tree maps the current topic and four skills. It shows the latest
boss result for each skill, completed recall and application training steps,
and cumulative practice history. The prior notes graph remains at
`/knowledge/legacy`.

Each boss and training problem has an optional Excalidraw scratchpad. Drawings
are saved per problem in the current browser and remain available when you return
to that problem. A new boss attempt starts with a clean scratchpad.

The previous LearnHarness-based tutor remains available through Session history
for existing records. Its question components, provider connections, and storage
informed the new loop; the old lesson planner and knowledge graph are outside
the main journey.

## Run locally

Use Node.js 24 or newer.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. Challenges and scoring run without a model key.
Connections and Preferences remain available for older tutor sessions. Grok
subscription sign-in requires your own authorized xAI OAuth client registration;
live subscription inference remains unverified until that is supplied.

```sh
npm run typecheck
npm run lint
npm run build
```

If your environment cannot run Turbopack's compiler subprocess, use
`npm run build -- --webpack`.

## Architecture and storage

The application is a modular monolith organized around Challenges and the
retained Learning, Knowledge, Connections, Artifacts, Preferences, and Identity
contexts. Each context owns its domain contracts, use cases, adapters, and
presentation. See [the architecture](docs/architecture.md),
[challenge direction](docs/challenge-practice-direction.md), and
[Grok connection design](docs/subscription-sign-in-design.md).

The current deployment serves one private workspace per server process. Learning,
knowledge, artifacts, challenges, preferences, and provider keys use durable file adapters under
`.neuroplast/workspace`; browser identities and encrypted Grok connections use
SQLite under `.neuroplast`. `NEUROPLAST_DATA_DIR` relocates persistent storage.
This version does not provide separate learning workspaces for different users.

Production requires HTTPS, persistent writable storage,
`NEUROPLAST_WORKSPACE_PASSWORD`, `NEUROPLAST_ORIGIN`, and a stable
`NEUROPLAST_CREDENTIAL_KEY`. Deploy the repository and runtime dependencies on a
persistent Node server. File tools read only `NEUROPLAST_MATERIALS_DIR` (default
`.neuroplast/materials`). Learners can also attach text/Markdown or import notes.
Interactive-demo rendering can use server-installed Chrome via `CHROME_PATH`;
learners use their browser and install no desktop application.

Retained third-party notices live alongside the relevant components and in
[docs/licenses](docs/licenses).
