export const TOPIC = {
  id: "linear-equations",
  title: "Linear equations",
  description: "Work from one-step equations to variables on both sides.",
} as const;

export const SKILLS = [
  { id: "one-step", name: "Undo one operation", description: "Isolate x by reversing addition or subtraction." },
  { id: "two-step", name: "Solve two-step equations", description: "Undo the constant, then the coefficient." },
  { id: "distribution", name: "Handle parentheses", description: "Work with a factor outside parentheses." },
  { id: "both-sides", name: "Variables on both sides", description: "Collect x terms before isolating the variable." },
] as const;

export type SkillId = (typeof SKILLS)[number]["id"];
export type QuestionMode = "recall" | "application";
export type TrainingStage = "recall" | "discrimination" | "application" | "delayed-recall";
export type ResponseKind = "choice" | "integer" | "text";

export interface Question {
  id: string;
  skillId: string;
  mode: QuestionMode;
  stage?: TrainingStage;
  prompt: string;
  responseKind: ResponseKind;
  options?: { value: string; label: string }[];
  answer: string;
  acceptedAnswers?: string[];
  explanation: string;
}

export type PublicQuestion = Omit<Question, "answer" | "acceptedAnswers" | "explanation">;
export function publicQuestion(question: Question): PublicQuestion {
  const { answer: _answer, acceptedAnswers: _acceptedAnswers, explanation: _explanation, ...publicFields } = question;
  void _answer;
  void _acceptedAnswers;
  void _explanation;
  return publicFields;
}

export class Random {
  private state: number;
  constructor(state: number) { this.state = state || 1; }
  next(): number {
    let x = this.state | 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.state = x | 0;
    return (x >>> 0) / 4294967296;
  }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  pick<T>(items: readonly T[]): T { return items[this.int(0, items.length - 1)]; }
  shuffle<T>(items: T[]): T[] {
    for (let index = items.length - 1; index > 0; index--) {
      const other = this.int(0, index);
      [items[index], items[other]] = [items[other], items[index]];
    }
    return items;
  }
}

function signed(value: number): string { return value < 0 ? `− ${Math.abs(value)}` : `+ ${value}`; }
function nonzero(random: Random, min: number, max: number): number {
  let value = 0;
  while (!value) value = random.int(min, max);
  return value;
}
function skillQuestion(skillId: SkillId, mode: QuestionMode, random: Random, id: string, stage?: TrainingStage): Question {
  const x = nonzero(random, -8, 8);
  const a = random.int(2, 8);
  const b = random.int(2, 11);
  const offset = random.pick([-b, b]);
  const c = random.int(1, 6);
  const recall = mode === "recall";
  let equation = "";
  let prompt = "";
  let answer = "";
  let explanation = "";

  if (skillId === "one-step") {
    const total = x + offset;
    equation = `x ${signed(offset)} = ${total}`;
    prompt = recall ? `For **${equation}**, what signed number would you add to both sides to isolate x?` : `Solve for x: **${equation}**`;
    answer = recall ? String(-offset) : String(x);
    explanation = `${offset > 0 ? "Subtract" : "Add"} ${b} ${offset > 0 ? "from" : "to"} both sides. That leaves x = ${x}.`;
  } else if (skillId === "two-step") {
    const total = a * x + offset;
    equation = `${a}x ${signed(offset)} = ${total}`;
    prompt = recall ? `For **${equation}**, what signed number would you add to both sides first?` : `Solve for x: **${equation}**`;
    answer = recall ? String(-offset) : String(x);
    explanation = `${offset > 0 ? "Subtract" : "Add"} ${b}, then divide by ${a}. That leaves x = ${x}.`;
  } else if (skillId === "distribution") {
    const total = a * (x + offset);
    equation = `${a}(x ${signed(offset)}) = ${total}`;
    prompt = recall ? `For **${equation}**, what number should you divide both sides by to remove the factor outside parentheses?` : `Solve for x: **${equation}**`;
    answer = recall ? String(a) : String(x);
    explanation = `Divide both sides by ${a}, then ${offset > 0 ? "subtract" : "add"} ${b}. That leaves x = ${x}.`;
  } else {
    const other = c === a ? c - 1 : c;
    const right = (a - other) * x + offset;
    equation = `${a}x ${signed(offset)} = ${other}x ${signed(right)}`;
    prompt = recall ? `For **${equation}**, what coefficient of x should you subtract from both sides to remove the x term on the right?` : `Solve for x: **${equation}**`;
    answer = recall ? String(other) : String(x);
    explanation = `Subtract ${other}x from both sides, then isolate x. That leaves x = ${x}.`;
  }
  return { id, skillId, mode, ...(stage ? { stage } : {}), prompt, responseKind: "integer", answer, explanation };
}

export function challengeQuestions(seed: number): Question[] {
  const random = new Random(seed);
  const plan: { skillId: SkillId; mode: QuestionMode }[] = SKILLS.flatMap(skill => [
    { skillId: skill.id, mode: "recall" as const },
    { skillId: skill.id, mode: "application" as const },
  ]);
  plan.push({ skillId: "distribution", mode: "application" }, { skillId: "both-sides", mode: "application" });
  return random.shuffle(plan.map((item, index) => skillQuestion(item.skillId, item.mode, random, `q${index + 1}`)));
}

export function trainingQuestion(skillId: SkillId, stage: TrainingStage, seed: number, id: string): Question {
  const random = new Random(seed);
  if (stage === "discrimination") {
    const a = random.int(2, 6), b = random.int(2, 9), c = random.int(1, 5), total = random.int(12, 30);
    const other = c === a ? c - 1 : c;
    const examples: Record<SkillId, string> = {
      "one-step": `x + ${b} = ${total}`,
      "two-step": `${a}x + ${b} = ${total}`,
      distribution: `${a}(x + ${b}) = ${total}`,
      "both-sides": `${a}x + ${b} = ${other}x + ${total}`,
    };
    const prompts: Record<SkillId, string> = {
      "one-step": "Which equation can be solved by undoing just one operation?",
      "two-step": "Which equation has x on one side with both a coefficient and a separate constant, without parentheses?",
      distribution: "Which equation has a factor outside parentheses?",
      "both-sides": "Which equation requires collecting x terms from both sides?",
    };
    return {
      id, skillId, mode: "recall", stage, prompt: prompts[skillId], responseKind: "choice",
      options: random.shuffle((Object.keys(examples) as SkillId[]).map(key => ({ value: key, label: examples[key] }))),
      answer: skillId,
      explanation: `The equation ${examples[skillId]} has the structure described in the question. Notice where x appears and whether it is inside parentheses.`,
    };
  }
  const mode: QuestionMode = stage === "application" ? "application" : "recall";
  return skillQuestion(skillId, mode, random, id, stage);
}

export function grade(question: Question, response: string): boolean {
  const value = response.trim().replace(/^−/, "-");
  if (question.responseKind === "choice") return value === question.answer;
  if (question.responseKind === "text") {
    const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase("en-US").trim().replace(/[.,;:!?]+$/g, "").replace(/\s+/g, " ");
    return [question.answer, ...(question.acceptedAnswers ?? [])].some(answer => normalize(answer) === normalize(value));
  }
  return /^[+-]?\d{1,5}$/.test(value) && Number(value) === Number(question.answer);
}
