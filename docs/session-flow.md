# Learn session flow

How a Learn session moves from the first message to a challenge: what each
stage is, what moves it on, what runs on its own, what waits for the
learner, and what the server enforces. Change this file in the same commit
as any change to that behavior.

Practice sessions (`kind: "practice"`) follow their own problem loop and are
out of scope here.

## Stages

| Stage | Who is talking | Ends when |
| --- | --- | --- |
| **Warm-up** | the prober | `probe_done` succeeds |
| **Plan** | the teacher | the learner starts the lesson |
| **Learn** | the teacher | — (the learner may take the challenge any time) |
| **Challenge** | — (a scored page, outside the chat) | — |

The stage is derived from the transcript, never stored:
`core/phases.ts` (phase fold), `core/stages.ts` (gates and buttons),
`core/stage-sections.ts` (which section each message renders in).

## The page: one section per stage

A Learn session reads as stacked sections, numbered 1–4
(`ui/session/stage-sections.tsx`):

- the **current** stage is open, with its buttons at its foot;
- a **finished** stage folds to one line (warm-up: "9 answered · 3 right";
  plan: "7 steps") and opens again on Show;
- a stage **still ahead** is a dashed row saying when it opens;
- the **Challenge** row sits under them, always: Take it now / Open
  challenge.

Each message renders in the stage it began in: the warm-up's closing
message stays in the warm-up, and Learn begins at Start learning or the
first lesson question, whichever comes first. The plan outline shows at the
top of Plan, and at the top of Learn while Plan is folded.

**Loading screens** (`stageLoading`): the current section shows neurons
trying to connect while it waits on the tutor:

| Section | Shows while |
| --- | --- |
| Warm-up | the first message is sent and the tutor has not spoken |
| Plan | the warm-up has ended and no plan is written |
| Learn | Start learning was pressed and the tutor has not spoken |

When no turn has run for 20 seconds (`STALL_MS`) the screen offers
**Retry**, which sends a plain message ("Go ahead and write the plan.") so
a dropped handoff never strands the session.

## 1. Warm-up

1. The learner's first message starts the session. The title is a short
   version of that message (`core/titles.ts shortTitle`: filler like
   "Can you teach me" dropped, first sentence, 40 characters at most).
2. The prober asks one question at a time:
   - **the goal** with `ask_user_question` — what it is for (class, exam,
     project) and whether there is a syllabus, textbook or notes to attach;
   - **knowledge questions** with `probe` (or `recall` in free-recall mode)
     to find where the learner's understanding runs out.
3. Attached files land in `materials/uploads/` and reach the tutor as a path
   line in the message or answer. PDFs are read with the `pdf` job; `read`
   and `grep` refuse PDFs and binary files and point at `pdf`.
4. The prober ends the warm-up with `probe_done` (assessment written to the
   learner in second person, plus a 2–5 word `title`).

**Server rule — warm-up floor** (`warmupBlocker`): `probe_done` is refused
until the goal question is answered **and** at least
`MIN_WARMUP_QUESTIONS` (5) knowledge questions are answered. Dismissed
questions do not count; "I don't know" does. The refusal tells the prober
what is missing. **Skip to plan** lifts the floor.

**On success:** the assessment card shows, the session is renamed to the
prober's `title` (unless the learner renamed it), and the handoff to
planning is queued. The handoff runs **immediately and automatically** — it
is the lesson's own next step, so it never waits on a subscription's
background-use setting (`lessonHandoffOnly`).

The prober's closing sentence asks nothing: the plan starts as soon as its
turn ends, so a question there would go unanswered.

## 2. Plan

1. The teacher writes the plan with `plan_init` (a mermaid graph of 5–15
   steps). It shows as a numbered outline in the Plan section, with an
   **Open the knowledge tree** button (`/knowledge?topic=learn:<chatId>`).
2. The teacher presents the plan in a few lines and ends its turn.

**Server rule — plan gate** (`planAwaitingStart`): lesson questions (`quiz`,
`explain`) are refused while the first plan waits. The gate opens on any of:
**Start learning**, a typed reply, or an answered `ask_user_question`. A
refused call does not count as teaching (the session stays on Plan). A plan
rewritten mid-lesson never re-gates.

## 3. Learn

Teaching runs step by step through the plan. Every lesson question names its
plan step (`nodeId`); step status (visited / current / upcoming) is derived
from those tags and shown in the outline at the top of Learn.

## 4. Challenge

One challenge per session, built from the session title and plan steps
(`sessionChallengeRequest`). Asking again opens the existing one.

## Buttons

| Where | Buttons | Effect |
| --- | --- | --- |
| Foot of Warm-up | Skip to plan · Skip to challenge | dismisses the open question, then sends the `skip-warmup` stage message / builds the challenge |
| Foot of Plan (waiting) | Start learning · Skip to challenge | sends `start-learning` / builds the challenge |
| Plan outline | Open the knowledge tree | opens this session's tree |
| Challenge row | Take it now · Open challenge | builds or opens the challenge |
| A stalled loading screen | Retry | sends a plain message to move the session on |
| A finished section | Show · Hide | unfolds or folds it |
| Knowledge, Learn topic | Take the challenge | same, without opening the session |
| Under an open question | Attach file | the file rides the answer |

Stage moves are a `{ type: "stage", action }` chat input; the server
validates them (`inputAppends`): Learn sessions only, no open question,
skip only before `probe_done`, start only while the plan waits.

## Background work

Helper jobs run outside the turn and report back as a message: `research`,
`pdf`, `demo`. (There is no figure tool.)

- **Model:** each job uses its role's slot (`ROLE_SLOT`); when that slot's
  provider has no key, it uses the session's own model instead
  (`resolveEngine` in `chat-handler.ts`).
- **Grok sign-in:** jobs and their follow-up turns count as background use.
  The switch is on unless the learner turned it off in Connections. The
  warm-up → plan handoff is never treated as background.
- **Display:** a running job is one line (spinner, name, seconds, activity).
  A finished one is one line ("PDF reading complete · view brief"). A failed
  one is one line ("PDF reading failed · details").

## Where the rules live

| Rule | Code | Tests |
| --- | --- | --- |
| warm-up floor, plan gate, stage moves, handoff exemption | `src/features/learning/core/stages.ts`, `core/input-events.ts`, `server/agent/tools/probe.ts`, `server/agent/tools.ts` | `tests/stages.test.mjs` |
| phase fold | `src/features/learning/core/phases.ts` | `tests/stages.test.mjs` |
| sections and loading screens | `src/features/learning/core/stage-sections.ts`, `ui/session/stage-sections.tsx` | `tests/stage-sections.test.mjs` |
| titles | `src/features/learning/core/titles.ts` | `tests/titles.test.mjs` |
| attachments | `src/features/learning/core/attachments.ts`, `server/materials.ts` | `tests/stages.test.mjs` |
| prober / teacher instructions | `src/features/learning/server/agent/prompts/` | — |
