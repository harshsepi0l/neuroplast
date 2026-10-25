import type { PublicQuestion, TrainingStage } from "./linear-equations";

export interface ChallengeResult {
  points: number;
  correct: number;
  total: number;
  goalMet: boolean;
  items: { questionId: string; skillId: string; mode: "recall" | "application"; correct: boolean; response: string; answer: string; explanation: string }[];
  bySkill: { skillId: string; name: string; correct: number; total: number }[];
  byMode: { mode: "recall" | "application"; correct: number; total: number }[];
}
export interface TrainingProgress {
  completed: number;
  total: number;
  ready: boolean;
  skills: { skillId: string; name: string; stages: { stage: TrainingStage; passed: boolean }[] }[];
}
export interface ChallengeView {
  id: string;
  topic: { id: string; title: string; description: string };
  skills: readonly { id: string; name: string; description: string }[];
  createdAt: string;
  previousId?: string;
  previousScore?: number;
  submittedAt?: string;
  questions: PublicQuestion[];
  responses: Record<string, string>;
  result: ChallengeResult | null;
  training: TrainingProgress | null;
}
export interface TrainingView {
  challengeId: string;
  topic: { id: string; title: string; description: string };
  progress: TrainingProgress;
  current: PublicQuestion | null;
  feedback?: { correct: boolean; answer: string; explanation: string; response: string; skillId: string; stage?: TrainingStage };
}
export interface ChallengeSummary {
  id: string;
  topicId: string;
  topicTitle: string;
  createdAt: string;
  submittedAt?: string;
  score?: number;
  goalMet?: boolean;
  trainingReady: boolean;
}
