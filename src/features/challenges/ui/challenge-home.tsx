"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, RotateCcw, Target } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import type { ChallengeSummary, ChallengeView } from "../core/contracts";
import { SKILLS, TOPIC } from "../core/linear-equations";
import { challengeRequest } from "./challenge-api";

export function ChallengeHome({ challenges }: { challenges: ChallengeSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const linearChallenges = challenges.filter(challenge => challenge.topicId === TOPIC.id);
  const latest = linearChallenges[0];
  const customChallenges = challenges.filter(challenge => challenge.topicId !== TOPIC.id);
  const customTopics = customChallenges.filter((challenge, index) => customChallenges.findIndex(item => item.topicId === challenge.topicId) === index);
  async function start(previousId?: string) {
    setBusy(true); setError("");
    try {
      const view = await challengeRequest<ChallengeView>("/api/challenges", "POST", { topicId: TOPIC.id, ...(previousId ? { previousId } : {}) });
      router.push(`/challenge/${view.id}`);
    } catch (failure) { setError((failure as Error).message); setBusy(false); }
  }
  return <div className="challenge-page"><div className="challenge-container">
    <div className="challenge-eyebrow"><Target size={15}/> YOUR NEXT CHALLENGE</div>
    <h1>Find your edge.<br/><span>Then train past it.</span></h1>
    <p className="challenge-intro">Finish a Learn session and take its challenge, or try a ready-made chapter. Train the gaps, then retake a new version of the test.</p>
    {error && <p role="alert" className="error-banner">{error}</p>}
    <section className="challenge-topic" aria-labelledby="topic-title">
      <div className="challenge-topic-top"><span className="challenge-tag">MATH · FIRST CHAPTER</span><span className="challenge-tag">10 QUESTIONS</span></div>
      <h2 id="topic-title">{TOPIC.title}</h2><p>{TOPIC.description}</p>
      <div className="challenge-skill-list">{SKILLS.map((skill, index) => <span key={skill.id}><b>{String(index + 1).padStart(2, "0")}</b>{skill.name}</span>)}</div>
      <div className="challenge-actions">
        {latest && !latest.submittedAt ? <Button onClick={() => router.push(`/challenge/${latest.id}`)} rightIcon={<ArrowRight size={16}/>}>Resume challenge</Button>
          : latest?.submittedAt && !latest.goalMet && !latest.trainingReady ? <Button onClick={() => router.push(`/challenge/${latest.id}`)} rightIcon={<ArrowRight size={16}/>}>Train for the rematch</Button>
          : <Button onClick={() => void start(latest?.submittedAt ? latest.id : undefined)} isLoading={busy} rightIcon={<ArrowRight size={16}/>}>{latest ? "Retake boss" : "Start boss challenge"}</Button>}
        {latest?.submittedAt && <Button variant="secondary" onClick={() => router.push(`/challenge/${latest.id}`)}>View last score</Button>}
      </div>
    </section>
    {customTopics.length > 0 && <section className="challenge-history" aria-labelledby="custom-topics-title"><div className="challenge-section-heading"><h2 id="custom-topics-title">From your sessions</h2><span>{customTopics.length} {customTopics.length === 1 ? "challenge" : "challenges"}</span></div>
      {customTopics.map(challenge => <button className="challenge-history-row" key={challenge.topicId} onClick={() => router.push(`/challenge/${challenge.id}`)}><span><b>{challenge.topicTitle}</b><small>{challenge.sessionId ? "From a Learn session · " : "Your own topic · "}{challenge.submittedAt ? challenge.goalMet ? "Boss cleared" : challenge.trainingReady ? "Ready to retake" : "Training available" : "In progress"}</small></span><strong>{challenge.score === undefined ? "Continue" : `${challenge.score}/100`}</strong><ArrowRight size={16}/></button>)}</section>}
    {linearChallenges.length > 0 && <section className="challenge-history" aria-labelledby="history-title"><div className="challenge-section-heading"><h2 id="history-title">Linear equations attempts</h2><span>{linearChallenges.length} recent</span></div>
      {linearChallenges.slice(0, 5).map((challenge, index) => <button className="challenge-history-row" key={challenge.id} onClick={() => router.push(`/challenge/${challenge.id}`)}>
        <span><b>{index === 0 ? "Latest attempt" : `Attempt ${linearChallenges.length - index}`}</b><small>{new Date(challenge.createdAt).toLocaleDateString()} · {challenge.submittedAt ? challenge.goalMet ? "Boss cleared" : challenge.trainingReady ? "Ready to retake" : "Training available" : "In progress"}</small></span>
        <strong>{challenge.score === undefined ? "Continue" : `${challenge.score}/100`}</strong><ArrowRight size={16}/>
      </button>)}</section>}
    <div className="challenge-note"><RotateCcw size={15}/> Every retake uses new questions on the same four skills.</div>
    <p className="challenge-footnote">Already know a topic? <Link href="/challenges/new">Test yourself on any topic</Link> without a Learn session.</p>
  </div></div>;
}
