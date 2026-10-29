import { z } from "zod";
import type { Question, TrainingStage } from "./linear-equations";

const skillSchema = z.object({ name: z.string().trim().min(3).max(70), description: z.string().trim().min(8).max(180) });
const itemSchema = z.object({
  skillIndex: z.number().int().min(0).max(3),
  prompt: z.string().trim().min(12).max(400),
  answer: z.string().trim().min(1).max(80),
  acceptedAnswers: z.array(z.string().trim().min(1).max(80)).max(5).optional(),
  explanation: z.string().trim().min(12).max(600),
  options: z.array(z.string().trim().min(1).max(80)).length(4).optional(),
});
const formSchema = z.object({
  title: z.string().trim().min(3).max(70),
  description: z.string().trim().min(10).max(180),
  skills: z.array(skillSchema).length(4),
  questions: z.array(itemSchema.extend({ mode: z.enum(["recall", "application"]) })).length(10),
  practice: z.array(itemSchema.extend({ stage: z.enum(["recall", "discrimination", "application", "delayed-recall"]) })).length(16),
});

export interface CustomForm {
  topic: { id: string; title: string; description: string };
  skills: { id: string; name: string; description: string }[];
  questions: Question[];
  practice: Question[];
}

function itemToQuestion(item: z.infer<typeof itemSchema>, skillId: string, id: string, mode: "recall" | "application", stage?: TrainingStage): Question {
  const options = item.options?.map(label => ({ value: label, label }));
  return { id, skillId, mode, ...(stage ? { stage } : {}), prompt: item.prompt,
    responseKind: options ? "choice" : "text", ...(options ? { options } : {}),
    answer: item.answer, ...(item.acceptedAnswers ? { acceptedAnswers: item.acceptedAnswers } : {}), explanation: item.explanation };
}

export function parseCustomForm(raw: unknown, topicId: string): CustomForm {
  const form = formSchema.parse(raw);
  const expectedStages: TrainingStage[] = ["recall", "discrimination", "application", "delayed-recall"];
  for (let index = 0; index < 4; index++) {
    const boss = form.questions.filter(question => question.skillIndex === index);
    if (boss.filter(question => question.mode === "recall").length !== 1 || boss.filter(question => question.mode === "application").length < 1) throw new Error(`Skill ${index + 1} needs one recall and at least one application question.`);
    const training = form.practice.filter(question => question.skillIndex === index);
    if (training.length !== 4 || expectedStages.some(stage => training.filter(question => question.stage === stage).length !== 1)) throw new Error(`Skill ${index + 1} needs each training stage once.`);
  }
  const all = [...form.questions, ...form.practice];
  const prompts = new Set<string>();
  for (const item of all) {
    const prompt = item.prompt.toLocaleLowerCase("en-US").replace(/\s+/g, " ");
    if (prompts.has(prompt)) throw new Error("The quiz repeats a question.");
    prompts.add(prompt);
    const isRecall = "stage" in item ? item.stage === "recall" || item.stage === "delayed-recall" : item.mode === "recall";
    if (isRecall && item.options) throw new Error("Recall questions must use typed answers.");
    if (!isRecall && (!item.options || new Set(item.options).size !== 4 || !item.options.includes(item.answer))) throw new Error("Choice questions need four unique options and an exact answer.");
    if (isRecall && item.answer.split(/\s+/).length > 5) throw new Error("Typed answers must be five words or fewer.");
  }
  const skills = form.skills.map((skill, index) => ({ id: `skill-${index + 1}`, ...skill }));
  return {
    topic: { id: topicId, title: form.title, description: form.description }, skills,
    questions: form.questions.map((item, index) => itemToQuestion(item, skills[item.skillIndex].id, `q${index + 1}`, item.mode)),
    practice: form.practice.map((item, index) => itemToQuestion(item, skills[item.skillIndex].id, `p${index + 1}`, item.stage === "application" ? "application" : "recall", item.stage)),
  };
}

/**
 * The quiz request for a challenge on a Learn session: the session's
 * topic plus what its plan covered, within the 500-character request
 * limit. Steps are dropped from the end when they do not fit.
 */
export function sessionChallengeRequest(title: string, planSteps: readonly string[]): string {
  const head = `Test me on what I just learned: ${title.trim() || "this topic"}.`;
  let request = head;
  const steps = planSteps.map(step => step.trim()).filter(Boolean);
  for (let count = steps.length; count > 0; count--) {
    const candidate = `${head} It covered: ${steps.slice(0, count).join("; ")}.`;
    if (candidate.length <= 500) { request = candidate; break; }
  }
  return request.slice(0, 500);
}
