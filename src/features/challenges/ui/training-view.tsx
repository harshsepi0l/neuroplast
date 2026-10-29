"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import type { ChallengeView, TrainingView as TrainingDto } from "../core/contracts";
import type { PublicQuestion } from "../core/linear-equations";
import { challengeRequest, loadChallenge, loadTraining } from "./challenge-api";
import { QuestionInput, QuestionPrompt } from "./question-input";
import { ProblemScratchpad } from "./problem-scratchpad";
import { renderDrawingsForPrint, scratchpadKey } from "./print-drawings";
import { PrintButton, printedOn } from "@/ui/print/print-button";

const stageNames = { recall: "Recall", discrimination: "Choose the method", application: "Apply it", "delayed-recall": "Recall again" };

function label(question: PublicQuestion, value: string): string {
  return question.options?.find(option => option.value === value)?.label ?? value;
}

/**
 * Training as one growing page: answered problems stay above, locked, with
 * their feedback; the next problem is chosen from that answer and appears
 * at the bottom.
 */
export function TrainingView({ id }: { id: string }) {
  const router = useRouter();
  const [view, setView] = useState<TrainingDto | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currentRef = useRef<HTMLDivElement>(null);
  const answeredOnce = useRef(false);
  useEffect(() => { let active = true; void loadTraining(id).then(data => { if (active) setView(data); }).catch(failure => { if (active) setError(failure.message); }); return () => { active = false; }; }, [id]);
  // After an answer, bring the next problem (or the finish) into view.
  const currentId = view?.current?.id ?? (view ? "done" : "");
  useEffect(() => {
    if (!answeredOnce.current || !currentRef.current) return;
    currentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    currentRef.current.querySelector<HTMLElement>("input, button.challenge-option")?.focus({ preventScroll: true });
  }, [currentId]);
  async function start() {
    setBusy(true); setError("");
    try { setView(await challengeRequest<TrainingDto>(`/api/challenges/${id}/training`, "POST", { action: "start" })); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  async function answer() {
    if (!view?.current || !draft.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const next = await challengeRequest<TrainingDto>(`/api/challenges/${id}/training`, "POST", { action: "answer", questionId: view.current.id, response: draft.trim() });
      answeredOnce.current = true;
      setView(next); setDraft("");
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  async function retake() {
    setBusy(true); setError("");
    try { const current = await loadChallenge(id); const next = await challengeRequest<ChallengeView>("/api/challenges", "POST", { topicId: current.topic.id, previousId: id }); router.push(`/challenge/${next.id}`); }
    catch (failure) { setError((failure as Error).message); setBusy(false); }
  }
  const skillName = (skillId: string) => view?.progress.skills.find(skill => skill.skillId === skillId)?.name;
  const question = view?.current;
  return <div className="challenge-page"><div className="challenge-container challenge-taking">
    <button className="challenge-back" onClick={() => router.push(`/challenge/${id}`)}><ArrowLeft size={15}/> Back to score</button>
    <p className="print-only print-header" suppressHydrationWarning><strong>neuroplast</strong> · Training · {view?.topic.title} · Printed {printedOn()}</p>
    <div className="challenge-eyebrow">TRAINING · {view?.topic.title ?? "YOUR TOPIC"}</div><h1 className="challenge-training-title">Build the skills to beat the boss.</h1>
    {view && <div className="challenge-sheet-bar"><div className="challenge-progress-label" style={{ flex: 1 }}><span>Skill steps completed</span><strong>{view.progress.completed}/{view.progress.total}</strong></div><PrintButton label="Print" prepare={renderDrawingsForPrint}/><div className="challenge-progress" style={{ flexBasis: "100%", margin: 0 }}><span style={{ width: `${view.progress.total ? 100 * view.progress.completed / view.progress.total : 100}%` }}/></div></div>}
    {view && <ol className="challenge-sheet" aria-label="Practice problems">
      {view.history.map((item, index) => <li key={item.question.id} className="challenge-sheet-item answered">
        <span className="challenge-sheet-number" aria-hidden="true">{index + 1}</span>
        <div>
          <div className="challenge-question-meta"><span>{skillName(item.question.skillId)}</span><span>{stageNames[item.question.stage ?? "recall"]}</span></div>
          <QuestionPrompt text={item.question.prompt}/>
          <div className="training-log-result">
            <span className={`challenge-feedback-label ${item.correct ? "correct" : "incorrect"}`}>{item.correct ? "Unaided success" : "Keep training"}</span>
            Your answer: {label(item.question, item.response)}
            {!item.correct && <p><b>Answer: {label(item.question, item.answer)}.</b></p>}
            <p>{item.explanation}{!item.correct && " This skill returns in a new problem after other work."}</p>
          </div>
          <div className="print-only print-drawing" data-print-drawing={scratchpadKey(id, item.question.id)}/>
        </div>
      </li>)}
      {question && <li key={question.id} className="challenge-sheet-item">
        <span className="challenge-sheet-number" aria-hidden="true">{view.history.length + 1}</span>
        <div ref={currentRef} className="training-log-current"><ProblemScratchpad challengeId={id} questionId={question.id}>
          <div className="challenge-question-meta"><span>{skillName(question.skillId)}</span><span>{stageNames[question.stage ?? "recall"]}</span></div>
          <QuestionPrompt text={question.prompt}/><QuestionInput question={question} inputId={`answer-${question.id}`} value={draft} onChange={setDraft} disabled={busy}/>
          <div className="challenge-actions"><Button disabled={!draft.trim() || busy} isLoading={busy} onClick={() => void answer()} rightIcon={<ArrowRight size={16}/>}>Check answer</Button></div>
          <p className="challenge-footnote">A correct answer without a hint counts toward readiness. A miss returns later for another try.</p>
        </ProblemScratchpad></div>
      </li>}
    </ol>}
    {view && !question && <div ref={currentRef} className="challenge-training-complete"><h2>Ready for another boss attempt.</h2><p>You recalled each weak skill twice on different questions and used it in a problem. The boss score stays the same until you retake it.</p><Button onClick={() => void retake()} isLoading={busy} leftIcon={<RotateCcw size={16}/>}>Retake boss</Button></div>}
    {!view && error && <div className="challenge-training-complete"><p>Training has not started for this challenge.</p><Button onClick={() => void start()} isLoading={busy}>Start training</Button></div>}
    {error && view && <p role="alert" className="error-banner">{error}</p>}
  </div></div>;
}
