# Obsidian vault

Neuroplast can keep its records as Markdown notes in an Obsidian vault:
every Learn topic and its steps, every session, and every challenge. The
app's own records stay the source of truth; the notes are a mirror you can
read, link and annotate in Obsidian.

## Connecting

Settings › **Obsidian** › enter the vault's folder (an absolute path; `~` is
fine) › **Connect**. Neuroplast writes into a `Neuroplast` folder inside it
and syncs right away.

Connecting also shows a **local token**, once. It is for tools on this
computer (the Neuroplast CLI and other harnesses, next). Only its hash is
stored; connect again for a new one. **Disconnect** stops syncing and leaves
the notes where they are.

## What gets written

```text
<vault>/Neuroplast/
  Neuroplast.md                                  home: links to everything
  Topics/<topic>.md                              status, a Mermaid tree, the steps
  Topics/<topic>/<NN> <step>.md                  one note per plan step or challenge skill
  Sessions/<date> <session>.md                   the session, by stage
  Challenges/<date> <topic> <id>.md              score, skills, each question
  .neuroplast-vault.json                         which note each record lives in
```

- **Topics**: one per Learn session with a plan, plus one per challenge
  topic you have taken. The Mermaid diagram colors each step by status.
- **Steps**: status, the steps it builds on (as links), and the lesson
  questions asked on that step with your answers. What it leads to shows in
  Obsidian's backlinks.
- **Sessions**: `## Warm-up`, `## Plan`, `## Learn` sections. Your messages,
  the tutor's text, each question as a callout (`[!success]`, `[!failure]`,
  `[!question]`) with your answer, the warm-up assessment, and stage moves.
- **Challenges**: score, a per-skill table and every question. Answers and
  explanations appear only after the challenge is submitted, as in the app.

Every note has properties (frontmatter) such as `neuroplast: step`,
`status`, `score`, `topic` and `tags`, so Dataview and Bases work over them.
Links use full paths, so two notes with the same name never collide. Math is converted to Obsidian's `$…$` / `$$…$$`, and money keeps a
literal `\$`.

## The graph

Links follow the knowledge tree rather than forming stars, so Obsidian's
graph shows each plan's shape:

- home → topics (and any session no topic reaches; never a challenge);
- topic → its first step(s), the current step and its session;
- step → the steps it builds on;
- session → its newest challenge → each earlier attempt ("Retake of").

A challenge always chains to its session. Only a challenge with no session
(the built-in chapter) chains to its topic instead.

Steps do not link back to their topic, and the topic's step list is plain
text (its Mermaid diagram shows the tree). Diagram labels read "1 · Step",
never "1. Step", which Mermaid would read as a Markdown list.

Every note is tagged `neuroplast/<kind>`, and steps also
`neuroplast/<status>` (`learning`, `solid`, `needs-practice`, `ahead`).
**Color the graph** in Settings › Obsidian adds color groups for those tags
to `<vault>/.obsidian/graph.json`, in front of your own groups (which stay):
by default yellow learning now, green solid, red needs practice, gray ahead,
blue topics, purple sessions, orange challenges.

**Colors** in the same section picks each of those eight colors. A pick is
saved with the vault connection, recolors every topic's diagram (with dark
or light text, whichever reads), and, once **Color the graph** has been
used, rewrites the graph's color groups too. **Reset colors** goes back to
the defaults.

## Writing in the notes

Each note's generated part sits between two Obsidian comments:

```markdown
%% neuroplast:start (rewritten on every sync; …) %%
…generated…
%% neuroplast:end %%
Your own notes go here.
```

Everything after the end marker is yours and is never changed. The
properties and the generated part are rewritten on every sync. If you delete
the markers, the whole note body is treated as yours and kept below a fresh
generated block.

## When it syncs

About 1.5 seconds after a change: a turn settling, a session created,
renamed or deleted, a challenge answered or submitted. **Sync now** forces
it.

- A renamed record moves its note (your text comes with it).
- A deleted record removes its note, unless you wrote in it; then it stays.
- Folders left empty are removed. Nothing outside `Neuroplast/` is touched.

## Where it lives

| What | File |
| --- | --- |
| Note rendering (pure) | `src/features/vault/core/notes.ts` |
| Connect, sync, watch | `src/features/vault/server/vault.ts` |
| API | `app/api/vault/route.ts` (status, connect, disconnect), `app/api/vault/sync/route.ts`, `app/api/vault/graph/route.ts` (graph colors), `app/api/vault/colors/route.ts` (color picks) |
| Settings section | `src/features/vault/ui/vault-section.tsx` |
| Connection record | `<workspace>/vault.json` (path, token hash, last sync, color picks) |
| Tests | `tests/vault.test.mjs` |

## Next

1. A `neuroplast` CLI over the local API, authenticated with the vault's
   token: `tree`, `export`, `learn`, `question`, `answer`, `challenge`.
2. An MCP server and a Claude Code skill on top of it.
3. Reading the vault back: your notes as tutor materials, and imports into
   Knowledge.
