import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { PATHS } from "@/platform/server/workspace-config";
import { AppError } from "@/shared/kernel/errors";
import {
  SKILLS, TOPIC, challengeQuestions, grade, publicQuestion, trainingQuestion,
  type Question, type SkillId, type TrainingStage,
} from "@/domains/challenges/domain/linear-equations";
import type { ChallengeResult } from "@/domains/challenges/domain/contracts";
import { buildKnowledgeTree } from "@/domains/challenges/domain/knowledge-tree";
import { generateCustomForm } from "./custom-quiz-generator";
import type { CustomForm } from "@/domains/challenges/domain/custom-quiz";

const directory = path.join(PATHS.data, "challenges");
const stages: TrainingStage[] = ["recall", "discrimination", "application", "delayed-recall"];
const VERSION = 1;

interface TrainingTask { question: Question; response?: string; correct?: boolean; answeredAt?: string }
interface TrainingRecord { tasks: TrainingTask[]; startedAt: string }
export interface ChallengeRecord {
  version: number;
  id: string;
  topicId: string;
  kind?: "custom";
  topic?: { id: string; title: string; description: string };
  skills?: { id: string; name: string; description: string }[];
  request?: string;
  practice?: Question[];
  seed: number;
  createdAt: string;
  previousId?: string;
  questions: Question[];
  responses: Record<string, string>;
  submittedAt?: string;
  result?: ChallengeResult;
  training?: TrainingRecord;
}

function file(id: string): string {
  if (!/^challenge_[0-9a-f-]{36}$/.test(id)) throw new AppError("invalid_challenge", "Invalid challenge ID.", 400);
  return path.join(directory, `${id}.json`);
}
function save(record: ChallengeRecord) {
  fs.mkdirSync(directory, { recursive: true });
  const target = file(record.id);
  const temporary = `${target}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(record, null, "\t"), { mode: 0o600 });
  fs.renameSync(temporary, target);
}
export function readChallenge(id: string): ChallengeRecord {
  try {
    const record = JSON.parse(fs.readFileSync(file(id), "utf8")) as ChallengeRecord;
    if (record.version !== VERSION || record.id !== id || typeof record.topicId !== "string" || !Array.isArray(record.questions)) throw new Error("version or shape");
    if (record.kind === "custom" && (!record.topic || !record.skills || !record.practice || !record.request)) throw new Error("custom shape");
    if (record.kind !== "custom" && record.topicId !== TOPIC.id) throw new Error("topic");
    return record;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("challenge_not_found", "This challenge could not be found.", 404);
  }
}
function seed(): number { return randomBytes(4).readUInt32BE(0); }
export function createChallenge(previousId?: string): ChallengeRecord {
  let previous: ChallengeRecord | undefined;
  if (previousId) {
    previous = readChallenge(previousId);
    if (!previous.submittedAt || previous.topicId !== TOPIC.id) throw new AppError("challenge_incomplete", "Choose a completed linear equations challenge for this retake.", 409);
  }
  let nextSeed = seed();
  if (previous && nextSeed === previous.seed) nextSeed = (nextSeed + 1) >>> 0;
  const record: ChallengeRecord = {
    version: VERSION, id: `challenge_${randomUUID()}`, topicId: TOPIC.id,
    seed: nextSeed, createdAt: new Date().toISOString(),
    ...(previous ? { previousId: previous.id } : {}),
    questions: challengeQuestions(nextSeed), responses: {},
  };
  save(record);
  return record;
}
export async function createCustomChallenge(request: string, previousId?: string, signal?: AbortSignal): Promise<ChallengeRecord> {
  const previous = previousId ? readChallenge(previousId) : undefined;
  if (previous && (previous.kind !== "custom" || !previous.submittedAt)) throw new AppError("challenge_incomplete", "Choose a completed custom challenge for this retake.", 409);
  const topicId = previous?.topicId ?? `topic_${randomUUID()}`;
  const source = previous?.request ?? request;
  const previousForm: CustomForm | undefined = previous ? { topic: previous.topic!, skills: previous.skills!, questions: previous.questions, practice: previous.practice! } : undefined;
  const generated = await generateCustomForm(source, topicId, previousForm, signal);
  const record: ChallengeRecord = {
    version: VERSION, id: `challenge_${randomUUID()}`, kind: "custom", topicId, seed: seed(), createdAt: new Date().toISOString(),
    ...(previous ? { previousId: previous.id } : {}), topic: previous?.topic ?? generated.topic,
    skills: previous?.skills ?? generated.skills, request: source,
    questions: generated.questions, practice: generated.practice, responses: {},
  };
  save(record);
  return record;
}
export function saveResponse(id: string, questionId: string, response: string): ChallengeRecord {
  const record = readChallenge(id);
  if (record.submittedAt) throw new AppError("already_submitted", "This challenge has already been scored.", 409);
  if (!record.questions.some(question => question.id === questionId)) throw new AppError("unknown_question", "That question is not in this challenge.", 400);
  if (response.length > 80) throw new AppError("answer_too_long", "Keep the answer under 80 characters.", 400);
  record.responses[questionId] = response;
  save(record);
  return record;
}
export function submitChallenge(id: string): ChallengeRecord {
  const record = readChallenge(id);
  if (record.submittedAt) return record;
  if (record.questions.some(question => !record.responses[question.id]?.trim())) throw new AppError("questions_remaining", "Answer every question before scoring the challenge.", 400);
  record.submittedAt = new Date().toISOString();
  record.result = calculateScore(record);
  save(record);
  return record;
}
function calculateScore(record: ChallengeRecord): ChallengeResult {
  const items = record.questions.map(question => ({
    questionId: question.id, skillId: question.skillId, mode: question.mode,
    correct: grade(question, record.responses[question.id] ?? ""),
    response: record.responses[question.id] ?? "",
    answer: question.answer, explanation: question.explanation,
  }));
  const correct = items.filter(item => item.correct).length;
  const bySkill = skillsOf(record).map(skill => {
    const group = items.filter(item => item.skillId === skill.id);
    return { skillId: skill.id, name: skill.name, correct: group.filter(item => item.correct).length, total: group.length };
  });
  const byMode = (["recall", "application"] as const).map(mode => {
    const group = items.filter(item => item.mode === mode);
    return { mode, correct: group.filter(item => item.correct).length, total: group.length };
  });
  const points = Math.round(100 * correct / items.length);
  return { points, correct, total: items.length, goalMet: points >= 80 && bySkill.every(skill => skill.correct / skill.total >= 0.5), items, bySkill, byMode };
}
export function score(record: ChallengeRecord): ChallengeResult | null {
  if (!record.submittedAt) return null;
  return record.result ?? calculateScore(record);
}
export function challengeView(record: ChallengeRecord) {
  const result = score(record);
  const previous = record.previousId ? score(readChallenge(record.previousId)) : null;
  return {
    id: record.id, topic: record.topic ?? TOPIC, skills: skillsOf(record), createdAt: record.createdAt,
    previousId: record.previousId, previousScore: previous?.points,
    submittedAt: record.submittedAt, questions: record.questions.map(publicQuestion),
    responses: record.responses, result,
    training: record.training ? trainingProgress(record) : null,
  };
}
function skillsOf(record: ChallengeRecord): readonly { id: string; name: string; description: string }[] { return record.skills ?? SKILLS; }
function allRecords(): ChallengeRecord[] {
  try {
    return fs.readdirSync(directory).filter(name => /^challenge_[0-9a-f-]{36}\.json$/.test(name))
      .map(name => { try { return readChallenge(name.slice(0, -5)); } catch { return null; } })
      .filter((record): record is ChallengeRecord => record !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch { return []; }
}
export function listChallenges() {
  return allRecords().slice(0, 100).map(record => ({ id: record.id, topicId: record.topicId, topicTitle: record.topic?.title ?? TOPIC.title, createdAt: record.createdAt, submittedAt: record.submittedAt, score: score(record)?.points, goalMet: score(record)?.goalMet, trainingReady: record.training ? trainingProgress(record).ready : false }));
}
function knowledgeProjection(records: ChallengeRecord[]) {
  return records.map(record => ({
    id: record.id, createdAt: record.createdAt, submittedAt: record.submittedAt, result: score(record),
    training: record.training ? { startedAt: record.training.startedAt, tasks: record.training.tasks.map(task => ({
      skillId: task.question.skillId, stage: task.question.stage, response: task.response,
      correct: task.correct, answeredAt: task.answeredAt,
    })) } : undefined,
  }));
}
export function knowledgeTree() {
  return buildKnowledgeTree(knowledgeProjection(allRecords().filter(record => record.topicId === TOPIC.id)));
}
export function knowledgeTrees() {
  const records = allRecords();
  const customTopics = [...new Set(records.filter(record => record.kind === "custom").map(record => record.topicId))];
  return [buildKnowledgeTree(knowledgeProjection(records.filter(record => record.topicId === TOPIC.id))),
    ...customTopics.map(topicId => {
      const topicRecords = records.filter(record => record.topicId === topicId);
      return buildKnowledgeTree(knowledgeProjection(topicRecords), topicRecords[0].topic!, topicRecords[0].skills!);
    })];
}

function weakSkills(record: ChallengeRecord): string[] {
  return (score(record)?.bySkill ?? []).filter(skill => skill.correct < skill.total).map(skill => skill.skillId);
}
function passed(tasks: TrainingTask[], skillId: string, stage: TrainingStage): boolean {
  return tasks.some(task => task.question.skillId === skillId && task.question.stage === stage && task.correct === true);
}
function nextTask(record: ChallengeRecord): TrainingTask | undefined {
  const tasks = record.training?.tasks ?? [];
  return tasks.find(task => {
    const { skillId, stage } = task.question;
    if (!stage || task.response !== undefined || passed(tasks, skillId, stage)) return false;
    const prior = stages.slice(0, stages.indexOf(stage));
    return prior.every(previous => passed(tasks, skillId, previous));
  });
}
function trainingProgress(record: ChallengeRecord) {
  const tasks = record.training?.tasks ?? [];
  const skills = weakSkills(record);
  const completed = skills.reduce((count, skillId) => count + stages.filter(stage => passed(tasks, skillId, stage)).length, 0);
  const total = skills.length * stages.length;
  return { completed, total, ready: completed === total, skills: skills.map(skillId => ({
    skillId, name: skillsOf(record).find(skill => skill.id === skillId)!.name,
    stages: stages.map(stage => ({ stage, passed: passed(tasks, skillId, stage) })),
  })) };
}
export function trainingView(record: ChallengeRecord) {
  if (!record.submittedAt) throw new AppError("challenge_incomplete", "Finish the challenge before training.", 409);
  const progress = trainingProgress(record);
  const current = nextTask(record);
  return { challengeId: record.id, topic: record.topic ?? TOPIC, progress, current: current ? publicQuestion(current.question) : null };
}
export function startTraining(id: string) {
  const record = readChallenge(id);
  if (!record.submittedAt) throw new AppError("challenge_incomplete", "Finish the challenge before training.", 409);
  if (!record.training) {
    const skills = weakSkills(record);
    const tasks: TrainingTask[] = [];
    for (const stage of stages) for (const skillId of skills) {
      const question = record.kind === "custom"
        ? record.practice!.find(item => item.skillId === skillId && item.stage === stage)
        : trainingQuestion(skillId as SkillId, stage, seed(), `t${tasks.length + 1}`);
      if (!question) throw new AppError("practice_missing", "This challenge is missing a practice question.", 500);
      tasks.push({ question: { ...question, id: `t${tasks.length + 1}` } });
    }
    record.training = { tasks, startedAt: new Date().toISOString() };
    save(record);
  }
  return trainingView(record);
}
export function answerTraining(id: string, questionId: string, response: string) {
  const record = readChallenge(id);
  if (!record.training) throw new AppError("training_not_started", "Start training before answering.", 409);
  const current = nextTask(record);
  if (!current || current.question.id !== questionId) throw new AppError("training_changed", "This practice problem is no longer active. Refresh and try again.", 409);
  if (response.length > 80 || !response.trim()) throw new AppError("invalid_answer", "Enter an answer under 80 characters.", 400);
  const correct = grade(current.question, response);
  current.response = response;
  current.correct = correct;
  current.answeredAt = new Date().toISOString();
  if (!correct) {
    const { skillId, stage } = current.question;
    const nextId = `t${record.training.tasks.length + 1}`;
    const retry = record.kind === "custom"
      ? (stage === "discrimination" ? undefined : record.questions.find(question => question.skillId === skillId && question.mode === (stage === "application" ? "application" : "recall") && !record.training!.tasks.some(task => task.question.prompt === question.prompt)))
        ?? record.practice!.find(question => question.skillId === skillId && question.stage === stage)!
      : trainingQuestion(skillId as SkillId, stage!, seed(), nextId);
    record.training.tasks.push({ question: { ...retry, id: nextId, stage: stage!, mode: stage === "application" ? "application" : "recall" } });
  }
  save(record);
  return { ...trainingView(record), feedback: {
    correct, answer: current.question.answer, explanation: current.question.explanation,
    response, skillId: current.question.skillId, stage: current.question.stage,
  } };
}
