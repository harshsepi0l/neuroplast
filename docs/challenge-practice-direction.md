# Challenge and practice direction

> **Status (October 29, 2026).** This is the direction set on October 25. The
> challenge loop shipped as described below. The plan to take the tutor out of
> the main journey was reversed: Learn sessions (warm-up, plan, lesson) are a
> main journey again, and each session can end in a challenge built from its
> plan. See [session-flow.md](session-flow.md).

## Product loop

1. Choose a topic and a goal. Show the skills the challenge covers before it starts.
2. Take a fixed diagnostic challenge without hints or answer reveals. Include unaided recall and application items for each skill; save every response.
3. Receive a score out of 100, a per-skill breakdown, and separate recall and application results.
4. Train each weak skill through recall first: produce the fact, method, or first move from a cue without seeing the answer. Then practice choosing it among similar methods and using it in mixed problems.
5. Revisit missed skills in fresh situations after other skills intervene. Suggest a retake after repeated unaided recall and successful mixed use.
6. Retake a parallel challenge with the same skill blueprint and comparable difficulty. Show the score change and which skills improved.

The challenge is the boss; practice is training. A score measures performance on
that challenge. Skill progress is a separate estimate backed by recall,
application, and retake evidence, never an automatic reward for opening a lesson.

## Targeted practice sequence

1. **Recall:** Ask for the needed idea or first move from a new cue, without naming it in the question or showing options that give it away. Record whether it came unaided, after a hint, or only after a reveal.
2. **Discrimination:** Put the skill beside a plausible alternative and ask the learner to choose the right method and explain the cue that separates them.
3. **Application:** Use the skill in a worked problem, then a mixed problem where the target is not announced.
4. **Delayed recall:** Return to the skill after other work, with a different surface. Repeating the same question immediately does not count as new evidence.

The existing practice tool already names `recall`, `discrimination`, and
`composition` modes. Keep those mechanics and the fresh-surface retest idea.
Replace the open-ended agent decision about when to stop with recorded targets:
at least two unaided recalls on distinct variants, followed by successful mixed
use, before marking a skill ready for a challenge retake. Hinted success is
valuable practice but does not count as unaided recall.

## What to keep

| Current part | Use in the new product |
| --- | --- |
| Question validation, answer options, math rendering | Build challenge and practice questions; move challenge grading to the server so answers remain hidden until submission. |
| Practice modes (`recall`, `discrimination`, `composition`), problem commitment, hint ladder, fresh-surface retests | Make these the core training engine after a diagnostic miss. |
| Session persistence and usage accounting | Keep attempts, practice history, model cost, and a route back to old sessions. |
| Provider connections and model settings | Generate and explain problems, with a clear fallback when no model is configured. |
| Accessible UI primitives and workspace shell | Carry the new challenge, score, and skill views. |

## What to remove from the main journey (superseded)

Kept for history. Learn sessions, their plans and background jobs are back in
the main journey; the skill tree in Knowledge replaced the graph view as
planned.

| Current part | Replacement |
| --- | --- |
| Open-ended Learn composer as the home screen | Topic selection and an obvious Start challenge action. |
| Probe-to-teach handoff and generated lesson plan as the default | A scored diagnostic followed by a training plan based on missed skills. |
| Endless practice chat without a completion rule | Short practice sets, visible progress, and a retake gate. |
| Proposition and reasoning-chain graph as the learner's main progress view | A small, explicit skill map with score evidence and prerequisites. |
| Research, visual, demo, and PDF jobs in the main learning flow | On-demand explanation aids after a learner asks for help. |

Keep existing session and graph files readable during the transition. Removing
old screens or agent wiring must not delete learners' data.

## Required records

- **Topic and skill blueprint:** topic ID, skill IDs, prerequisites, weights, and question types.
- **Challenge form:** versioned question set, skill tags, recall/application mode, difficulty, answer key, and rubric. The server owns the key.
- **Challenge attempt:** form ID, start/end times, responses, per-item verdicts, total score, and per-skill score.
- **Practice item and attempt:** target skill, mode, cue variant, problem, answer, hints used, verdict, and whether the target was recalled unaided on a fresh surface.
- **Readiness:** a derived view of challenge and practice evidence, with a clear rule for when to suggest a retake.

The first release should cover a constrained math curriculum with deterministic
grading. That makes scores trustworthy and retakes comparable. Broader topics
can use the same records later, but AI-graded free responses need rubric review
and an uncertainty path before their scores carry the same meaning.

## First playable slice

One topic with 3–5 explicit skills; a 10-question challenge; a score and skill
breakdown; targeted practice for missed skills; and a parallel retake. Generate
question variants from reviewed templates. Use AI for explanations and optional
coaching, not as the sole judge of the score. The old LearnHarness routes can
remain available to existing sessions while the new loop is built and tested.

**Implemented:** linear equations with four explicit skills, ten server-graded
questions, free-response recall, targeted training stages, and a linked retake.
An optional per-problem Excalidraw scratchpad saves drawings in the current
browser during an attempt.
Problem explanations are currently template-authored. AI coaching and additional
topics remain future work. Learn sessions build their own challenges from
their plans.
