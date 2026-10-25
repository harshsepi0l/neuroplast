"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/easyui/Button";
import type { ChallengeView, TrainingView as TrainingDto } from "../domain/contracts";
import { challengeRequest, loadChallenge, loadTraining } from "./challenge-api";
import { QuestionInput, QuestionPrompt } from "./question-input";
import { ProblemScratchpad } from "./problem-scratchpad";

const stageNames = { recall: "Recall", discrimination: "Choose the method", application: "Apply it", "delayed-recall": "Recall again" };

export function TrainingView({ id }: { id: string }) {
  const router = useRouter();
  const [view, setView] = useState<TrainingDto | null>(null);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<TrainingDto["feedback"]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; void loadTraining(id).then(data => { if (active) setView(data); }).catch(failure => { if (active) setError(failure.message); }); return () => { active = false; }; }, [id]);
  async function start() {
    setBusy(true); setError("");
    try { setView(await challengeRequest<TrainingDto>(`/api/challenges/${id}/training`, "POST", { action: "start" })); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  async function answer() {
    if (!view?.current || !draft.trim()) return;
    setBusy(true); setError("");
    try {
      const next = await challengeRequest<TrainingDto>(`/api/challenges/${id}/training`, "POST", { action: "answer", questionId: view.current.id, response: draft.trim() });
      setView(next); setFeedback(next.feedback);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  async function retake() {
    setBusy(true); setError("");
    try { const current = await loadChallenge(id); const next = await challengeRequest<ChallengeView>("/api/challenges", "POST", { topicId: current.topic.id, previousId: id }); router.push(`/challenge/${next.id}`); }
    catch (failure) { setError((failure as Error).message); setBusy(false); }
  }
  const question = view?.current;
  return <div className="challenge-page"><div className="challenge-container challenge-taking">
    <button className="challenge-back" onClick={() => router.push(`/challenge/${id}`)}><ArrowLeft size={15}/> Back to score</button>
    <div className="challenge-eyebrow">TRAINING · {view?.topic.title ?? "YOUR TOPIC"}</div><h1 className="challenge-training-title">Build the skills to beat the boss.</h1>
    {view && <><div className="challenge-progress-label"><span>Skill steps completed</span><strong>{view.progress.completed}/{view.progress.total}</strong></div><div className="challenge-progress"><span style={{ width: `${view.progress.total ? 100 * view.progress.completed / view.progress.total : 100}%` }}/></div></>}
    {question && !feedback && <div className="challenge-training-question"><ProblemScratchpad challengeId={id} questionId={question.id}>
      <div className="challenge-question-meta"><span>{view?.progress.skills.find(skill => skill.skillId === question.skillId)?.name}</span><span>{stageNames[question.stage ?? "recall"]}</span></div>
      <QuestionPrompt text={question.prompt}/><QuestionInput question={question} value={draft} onChange={setDraft} disabled={busy}/>
      <div className="challenge-actions"><Button disabled={!draft.trim() || busy} isLoading={busy} onClick={() => void answer()} rightIcon={<ArrowRight size={16}/>}>Check answer</Button></div>
      <p className="challenge-footnote">A correct answer without a hint counts toward readiness. A miss returns later for another try.</p>
    </ProblemScratchpad></div>}
    {feedback && <div className="challenge-feedback" aria-live="polite"><span className={`challenge-feedback-label ${feedback.correct ? "correct" : "incorrect"}`}>{feedback.correct ? "Unaided success" : "Keep training"}</span>
      <h2>{feedback.correct ? "You got it." : "Here is the move to remember."}</h2><p>{feedback.explanation}</p>
      {!feedback.correct && <p>This skill will return in a new problem after other work.</p>}
      <Button onClick={() => { setFeedback(undefined); setDraft(""); }} rightIcon={<ArrowRight size={16}/>}>{view?.current ? "Next practice problem" : "See readiness"}</Button></div>}
    {view && !question && !feedback && <div className="challenge-training-complete"><h2>Ready for another boss attempt.</h2><p>You recalled each weak skill twice on different questions and used it in a problem. The boss score stays the same until you retake it.</p><Button onClick={() => void retake()} isLoading={busy} leftIcon={<RotateCcw size={16}/>}>Retake boss</Button></div>}
    {!view && error && <div className="challenge-training-complete"><p>Training has not started for this challenge.</p><Button onClick={() => void start()} isLoading={busy}>Start training</Button></div>}
    {error && view && <p role="alert" className="error-banner">{error}</p>}
  </div></div>;
}
