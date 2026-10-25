import { SKILLS, TOPIC, type TrainingStage } from "./linear-equations.ts";
import type { ChallengeResult } from "./contracts";

const STAGES: readonly TrainingStage[] = ["recall", "discrimination", "application", "delayed-recall"];

export interface KnowledgeAttempt {
  id: string;
  createdAt: string;
  submittedAt?: string;
  result: ChallengeResult | null;
  training?: {
    startedAt: string;
    tasks: { skillId: string; stage?: TrainingStage; response?: string; correct?: boolean; answeredAt?: string }[];
  };
}

export type SkillState = "unassessed" | "needs-practice" | "practicing" | "trained" | "strong";
export interface SkillKnowledge {
  id: string;
  name: string;
  description: string;
  state: SkillState;
  latest?: { challengeId: string; at: string; correct: number; total: number; recall: { correct: number; total: number }; application: { correct: number; total: number } };
  training: { stages: { stage: TrainingStage; passed: boolean }[]; completed: number; total: number; answered: number; correct: number; cycles: number; lastPracticedAt?: string };
}

export interface KnowledgeTree {
  topic: { id: string; title: string; description: string };
  skills: SkillKnowledge[];
  attempts: number;
  latestChallengeId?: string;
  activeChallengeId?: string;
  latestScore?: number;
  bestScore?: number;
  bossCleared: boolean;
  readySkills: number;
}

export function buildKnowledgeTree(attempts: readonly KnowledgeAttempt[], topic: KnowledgeTree["topic"] = TOPIC, skillDefs: readonly { id: string; name: string; description: string }[] = SKILLS): KnowledgeTree {
  const ordered = [...attempts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const scored = ordered.filter(attempt => attempt.submittedAt && attempt.result);
  const latest = scored[0];
  const skills = skillDefs.map(skill => {
    const latestWithSkill = scored.find(attempt => attempt.result?.items.some(item => item.skillId === skill.id));
    const items = latestWithSkill?.result?.items.filter(item => item.skillId === skill.id) ?? [];
    const count = (mode: "recall" | "application") => {
      const group = items.filter(item => item.mode === mode);
      return { correct: group.filter(item => item.correct).length, total: group.length };
    };
    const latestTraining = latestWithSkill?.training?.tasks.filter(task => task.skillId === skill.id) ?? [];
    const stages = STAGES.map(stage => ({ stage, passed: latestTraining.some(task => task.stage === stage && task.correct === true) }));
    const allTasks = ordered.flatMap(attempt => attempt.training?.tasks.filter(task => task.skillId === skill.id && task.response !== undefined).map(task => ({ ...task, at: task.answeredAt ?? attempt.training!.startedAt })) ?? []);
    const cycles = ordered.filter(attempt => STAGES.every(stage => attempt.training?.tasks.some(task => task.skillId === skill.id && task.stage === stage && task.correct === true))).length;
    const completed = stages.filter(stage => stage.passed).length;
    const correct = items.filter(item => item.correct).length;
    const state: SkillState = !items.length ? "unassessed" : correct === items.length ? "strong" : completed === STAGES.length ? "trained" : completed > 0 ? "practicing" : "needs-practice";
    return {
      id: skill.id, name: skill.name, description: skill.description, state,
      ...(latestWithSkill?.submittedAt ? { latest: { challengeId: latestWithSkill.id, at: latestWithSkill.submittedAt, correct, total: items.length, recall: count("recall"), application: count("application") } } : {}),
      training: { stages, completed, total: STAGES.length, answered: allTasks.length, correct: allTasks.filter(task => task.correct).length, cycles,
        ...(allTasks.length ? { lastPracticedAt: allTasks.map(task => task.at).sort().at(-1) } : {}) },
    };
  });
  return {
    topic, skills, attempts: scored.length,
    latestChallengeId: latest?.id,
    activeChallengeId: ordered.find(attempt => !attempt.submittedAt)?.id,
    latestScore: latest?.result?.points,
    bestScore: scored.length ? Math.max(...scored.map(attempt => attempt.result!.points)) : undefined,
    bossCleared: latest?.result?.goalMet ?? false,
    readySkills: skills.filter(skill => skill.state === "trained" || skill.state === "strong").length,
  };
}
