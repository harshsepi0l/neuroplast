"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import type { ChallengeView as ChallengeDto } from "../core/contracts";
import { challengeRequest } from "./challenge-api";
import { QuestionInput, QuestionPrompt } from "./question-input";
import { ProblemScratchpad } from "./problem-scratchpad";
import { renderDrawingsForPrint, scratchpadKey } from "./print-drawings";
import { PrintButton, printedOn } from "@/ui/print/print-button";

/** The boss challenge as one page: every question stacked, answered in any order, each saved as it is given. */
export function ChallengeView({ initial }: { initial: ChallengeDto }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => ({ ...initial.responses }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Last value sent per question, so blur/Enter only saves real changes.
  const sent = useRef<Record<string, string>>({ ...initial.responses });
  // In-flight saves; submitting waits for them so the score sees every answer.
  const pending = useRef(new Set<Promise<void>>());

  function save(questionId: string, value: string): Promise<void> {
    const response = value.trim();
    if (!response || sent.current[questionId] === response) return Promise.resolve();
    sent.current[questionId] = response;
    const request = persist(questionId, response).finally(() => pending.current.delete(request));
    pending.current.add(request);
    return request;
  }
  async function persist(questionId: string, response: string) {
    try {
      const saved = await challengeRequest<ChallengeDto>(`/api/challenges/${view.id}`, "PATCH", { questionId, response });
      setView(current => ({ ...current, responses: saved.responses }));
      setError("");
    } catch (failure) {
      delete sent.current[questionId];
      setError((failure as Error).message);
    }
  }
  function choose(questionId: string, value: string, immediate: boolean) {
    setDrafts(current => ({ ...current, [questionId]: value }));
    if (immediate) void save(questionId, value);
  }
  async function submit() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      for (const question of view.questions) void save(question.id, drafts[question.id] ?? "");
      await Promise.all(pending.current);
      setView(await challengeRequest<ChallengeDto>(`/api/challenges/${view.id}`, "POST", { action: "submit" }));
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  function jump(questionId: string) {
    const target = document.getElementById(`question-${questionId}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    target?.querySelector<HTMLElement>("input, button.challenge-option")?.focus({ preventScroll: true });
  }
  async function train() {
    setBusy(true); setError("");
    try { await challengeRequest(`/api/challenges/${view.id}/training`, "POST", { action: "start" }); router.push(`/challenge/${view.id}/train`); }
    catch (failure) { setError((failure as Error).message); setBusy(false); }
  }
  async function retake() {
    setBusy(true); setError("");
    try { const nextView = await challengeRequest<ChallengeDto>("/api/challenges", "POST", { topicId: view.topic.id, previousId: view.id }); router.push(`/challenge/${nextView.id}`); }
    catch (failure) { setError((failure as Error).message); setBusy(false); }
  }
  if (view.result) {
    const result = view.result;
    const misses = result.items.filter(item => !item.correct);
    const optionLabel = (questionId: string, value: string) => view.questions.find(question => question.id === questionId)?.options?.find(option => option.value === value)?.label ?? value;
    return <div className="challenge-page"><div className="challenge-container">
      <button className="challenge-back" onClick={() => router.push("/challenges")}><ArrowLeft size={15}/> Challenges</button>
      <p className="print-only print-header" suppressHydrationWarning><strong>neuroplast</strong> · Boss challenge · {view.topic.title} · Printed {printedOn()}</p>
      <div className="challenge-score-hero"><div><h1>{view.topic.title}</h1><p>{result.correct} of {result.total} correct{view.previousScore !== undefined && ` · last time ${view.previousScore}`}</p></div><strong>{result.points}<small>/100</small></strong></div>
      <section className="challenge-breakdown"><div className="challenge-section-heading"><h2>Skills</h2></div>
        {result.bySkill.map(skill => <div className="challenge-skill-row" key={skill.skillId}><div><strong>{skill.name}</strong><span>{skill.correct}/{skill.total}</span></div><div className="challenge-meter"><span style={{ width: `${100 * skill.correct / skill.total}%` }}/></div></div>)}
      </section>
      <div className="challenge-actions">{misses.length > 0 && <Button onClick={() => void train()} isLoading={busy} rightIcon={<ArrowRight size={16}/>}>{view.training?.ready ? "Review training" : "Train weak skills"}</Button>}
        <Button variant={misses.length ? "secondary" : "primary"} onClick={() => void retake()} disabled={busy} leftIcon={<RotateCcw size={16}/>}>Retake</Button>
        {view.sessionId && <Button variant="ghost" onClick={() => router.push(`/chat/${view.sessionId}`)}>Session</Button>}
        <PrintButton prepare={renderDrawingsForPrint}/></div>
      {error && <p role="alert" className="error-banner">{error}</p>}
      <section className="challenge-review"><div className="challenge-section-heading"><h2>Questions</h2></div>
        {result.items.map((item, index) => { const original = view.questions.find(question => question.id === item.questionId)!;
          return <div className="challenge-review-item" key={item.questionId}><span className="challenge-tag">{index + 1} · {view.skills.find(skill => skill.id === item.skillId)?.name}</span><QuestionPrompt text={original.prompt}/>
            <p>Your answer: {optionLabel(item.questionId, item.response)} {item.correct ? "✓" : "✗"}</p>
            {!item.correct && <p><b>Answer: {optionLabel(item.questionId, item.answer)}.</b> {item.explanation}</p>}
            <div className="print-only print-drawing" data-print-drawing={scratchpadKey(view.id, item.questionId)}/></div>; })}</section>
    </div></div>;
  }
  const answered = view.questions.filter(question => drafts[question.id]?.trim()).length;
  const remaining = view.questions.length - answered;
  return <div className="challenge-page"><div className="challenge-container challenge-taking">
    <button className="challenge-back" onClick={() => router.push("/challenges")}><ArrowLeft size={15}/> Challenges</button>
    <p className="print-only print-header" suppressHydrationWarning><strong>neuroplast</strong> · Boss challenge · {view.topic.title} · Printed {printedOn()} · Name: ______________________</p>
    <h1 className="challenge-training-title">{view.topic.title}</h1>
    <div className="challenge-sheet-bar">
      <strong>{answered}/{view.questions.length}</strong>
      <nav className="challenge-sheet-chips" aria-label="Jump to question">
        {view.questions.map((question, index) => <button key={question.id} type="button" className={drafts[question.id]?.trim() ? "answered" : ""} aria-label={`Question ${index + 1}${drafts[question.id]?.trim() ? ", answered" : ""}`} onClick={() => jump(question.id)}>{index + 1}</button>)}
      </nav>
      <PrintButton label="Print" prepare={renderDrawingsForPrint}/>
    </div>
    <ol className="challenge-sheet" aria-label="Questions">
      {view.questions.map((question, index) => <li key={question.id} id={`question-${question.id}`} className={`challenge-sheet-item${drafts[question.id]?.trim() ? " answered" : ""}`}>
        <span className="challenge-sheet-number" aria-hidden="true">{index + 1}</span>
        <ProblemScratchpad challengeId={view.id} questionId={question.id}>
                    <QuestionPrompt text={question.prompt}/>
          <QuestionInput question={question} inputId={`answer-${question.id}`} value={drafts[question.id] ?? ""} disabled={busy}
            onChange={value => choose(question.id, value, question.responseKind === "choice")}
            onCommit={() => void save(question.id, drafts[question.id] ?? "")}/>
        </ProblemScratchpad>
      </li>)}
    </ol>
    <div className="challenge-sheet-submit">
      <p>{remaining ? `${remaining} left` : ""}</p>
      <Button disabled={remaining > 0 || busy} isLoading={busy} rightIcon={<Check size={16}/>} onClick={() => void submit()}>Submit</Button>
    </div>
    {error && <p role="alert" className="error-banner">{error}</p>}
  </div></div>;
}
