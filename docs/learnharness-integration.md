# LearnHarness integration

Source review: `amosblomqvist/learnharness` at commit
`0795ef197cca04f6a8e7d50d10ed4dc71bd1a0cc` (2026-10-25).

Neuroplast already incorporates the LearnHarness learning engine. This is a
source-level port into one Next.js application, rather than a second app or a
runtime dependency on the upstream repository. A source inventory found
counterpart filenames for all upstream `src` files except two; targeted source
comparisons confirm the main learning and session flows. The unmatched files,
`src/core/contracts.ts` and
`src/server/stores.ts`, have their contracts and store composition split across
the corresponding domain and platform modules. Electron packaging and its
private desktop subscription transport are outside the web app's runtime.

| Upstream | Neuroplast owner | Integration |
| --- | --- | --- |
| `src/agent`, `src/server/chat-handler.ts`, `src/core` learning rules | `src/domains/learning` | Native session history, probe and teach turns, practice, tools, compaction, steering |
| `src/store/chats.ts` | `src/domains/learning/infrastructure/persistence` | One server-owned session store for Learn, Sessions, and chat routes |
| Graph and extraction code | `src/domains/knowledge` | Persistent propositions, chains, notes import, graph views |
| Background agents and job store | `src/domains/artifacts` | Research, visual, demo, PDF jobs and delivery into sessions |
| Model catalog, keys, subscription adapters | `src/domains/connections` | Provider keys and model selection; web Grok connection has its own browser-owned credential service |
| Settings code | `src/domains/preferences` | Workspace settings and per-session model pins |
| `app/api` | `app/api` | The same lesson, session, graph, job, and settings protocol through the Neuroplast shell |

The Grok connection's **Tutoring model** choice now updates the strong model
slot used when creating new lessons. It preserves cheap and vision slots and
does not rewrite existing sessions, whose model pins are stored at creation.
First-time connection setup fills the vision slot only when that model accepts
images.
When a provider returns a model absent from the installed Pi catalog, the
connection chooses the first supported model it offered. A model with no Pi
catalog entry cannot be selected for tutoring.

The source comparison, TypeScript check, lint, and production build verify the
code integration. Live provider dispatch and xAI OAuth sign-in require an
authorized OAuth client and provider account and have not been verified here.
