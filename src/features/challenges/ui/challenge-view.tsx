"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import type { ChallengeView as ChallengeDto } from "../core/contracts";
import { challengeRequest } from "./challenge-api";
import { QuestionInput, QuestionPrompt } from "./question-input";
import { ProblemScratchpad } from "./problem-scratchpad";

export function ChallengeView({ initial }: { initial: ChallengeDto }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [index, setIndex] = useState(() => Math.max(0, initial.questions.findIndex(question => !initial.responses[question.id]?.trim())));
  const [draft, setDraft] = useState(() => initial.responses[initial.questions[Math.max(0, initial.questions.findIndex(question => !initial.responses[question.id]?.trim()))]?.id] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const question = view.questions[index];
  useEffect(() => { if (question) setDraft(view.responses[question.id] ?? ""); }, [index, question, view.responses]);

  async function next() {
    if (!question || !draft.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const saved = await challengeRequest<ChallengeDto>(`/api/challenges/${view.id}`, "PATCH", { questionId: question.id, response: draft.trim() });
      setView(saved);
      if (index < view.questions.length - 1) setIndex(index + 1);
      else setView(await challengeRequest<ChallengeDto>(`/api/challenges/${view.id}`, "POST", { action: "submit" }));
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
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
    return <div className="challenge-page"><div className="challenge-container">
      <button className="challenge-back" onClick={() => router.push("/challenges")}><ArrowLeft size={15}/> All challenges</button>
      <div className="challenge-eyebrow"><Sparkles size={15}/> {result.goalMet ? "BOSS CLEARED" : "CHALLENGE COMPLETE"}</div>
      <div className="challenge-score-hero"><div><h1>{result.goalMet ? "You beat the boss." : "Now you know what to train."}</h1><p>{view.topic.title} · {result.correct} of {result.total} correct</p></div><strong>{result.points}<small>/100</small></strong></div>
      {view.previousScore !== undefined && <p className="challenge-delta">Previous challenge: {view.previousScore}/100 · {result.points > view.previousScore ? `Up ${result.points - view.previousScore} points` : result.points < view.previousScore ? `Down ${view.previousScore - result.points} points` : "Same score"}</p>}
      <div className="challenge-mode-results">{result.byMode.map(mode => <div key={mode.mode}><span>{mode.mode === "recall" ? "Recall" : "Application"}</span><strong>{mode.correct}/{mode.total}</strong></div>)}</div>
      <section className="challenge-breakdown"><div className="challenge-section-heading"><h2>Skill breakdown</h2><span>Train the gaps, then retake</span></div>
        {result.bySkill.map(skill => <div className="challenge-skill-row" key={skill.skillId}><div><strong>{skill.name}</strong><span>{skill.correct}/{skill.total}</span></div><div className="challenge-meter"><span style={{ width: `${100 * skill.correct / skill.total}%` }}/></div></div>)}
      </section>
      <div className="challenge-actions">{misses.length > 0 && <Button onClick={() => void train()} isLoading={busy} rightIcon={<ArrowRight size={16}/>}>{view.training?.ready ? "Review training" : "Train weak skills"}</Button>}
        <Button variant={misses.length ? "secondary" : "primary"} onClick={() => void retake()} disabled={busy} leftIcon={<RotateCcw size={16}/>}>Retake boss</Button>
        <Button variant="ghost" onClick={() => router.push("/knowledge")}>View knowledge tree</Button></div>
      {error && <p role="alert" className="error-banner">{error}</p>}
      {misses.length > 0 && <section className="challenge-review"><div className="challenge-section-heading"><h2>Review missed questions</h2></div>
        {misses.map(item => { const original = view.questions.find(question => question.id === item.questionId)!; const answerLabel = original.options?.find(option => option.value === item.answer)?.label ?? item.answer;
          return <div className="challenge-review-item" key={item.questionId}><span className="challenge-tag">{view.skills.find(skill => skill.id === item.skillId)?.name} · {item.mode}</span><QuestionPrompt text={original.prompt}/><p>Your answer: {original.options?.find(option => option.value === item.response)?.label ?? item.response}</p><p><b>Answer: {answerLabel}.</b> {item.explanation}</p></div>; })}</section>}
    </div></div>;
  }
  if (!question) return null;
  return <div className="challenge-page"><div className="challenge-container challenge-taking">
    <button className="challenge-back" onClick={() => router.push("/challenges")}><ArrowLeft size={15}/> Save and leave</button>
    <div className="challenge-topline"><span className="challenge-tag">BOSS CHALLENGE · {view.topic.title}</span><span>{index + 1} of {view.questions.length}</span></div>
    <div className="challenge-progress" aria-label={`${index + 1} of ${view.questions.length} questions`}><span style={{ width: `${100 * (index + 1) / view.questions.length}%` }}/></div>
    <ProblemScratchpad challengeId={view.id} questionId={question.id}>
      <div className="challenge-question-meta"><span>{view.skills.find(skill => skill.id === question.skillId)?.name}</span><span>{question.mode === "recall" ? "Recall" : "Application"}</span></div>
      <QuestionPrompt text={question.prompt}/>
      <QuestionInput question={question} value={draft} onChange={setDraft} disabled={busy}/>
      <div className="challenge-actions"><Button variant="secondary" disabled={busy || index === 0} onClick={() => setIndex(index - 1)}>Previous</Button>
        <Button disabled={!draft.trim() || busy} isLoading={busy} rightIcon={index === view.questions.length - 1 ? <Check size={16}/> : <ArrowRight size={16}/>} onClick={() => void next()}>{index === view.questions.length - 1 ? "Submit for score" : "Next question"}</Button></div>
      <p className="challenge-footnote">No hints during the boss challenge. Answers are revealed with your score.</p>
      {error && <p role="alert" className="error-banner">{error}</p>}
    </ProblemScratchpad>
  </div></div>;
}
