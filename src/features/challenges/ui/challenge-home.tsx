"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
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
  const status = (challenge: ChallengeSummary) => challenge.submittedAt ? challenge.goalMet ? "Cleared" : challenge.trainingReady ? "Ready to retake" : "Train weak skills" : "In progress";
  return <div className="challenge-page"><div className="challenge-container">
    <div className="challenge-title-row"><h1>Challenges</h1><Link href="/challenges/new" className="challenge-title-link">Test yourself on any topic <ArrowRight size={14}/></Link></div>
    {error && <p role="alert" className="error-banner">{error}</p>}
    {customTopics.length > 0 && <section className="challenge-history" aria-labelledby="custom-topics-title"><div className="challenge-section-heading"><h2 id="custom-topics-title">Your topics</h2></div>
      {customTopics.map(challenge => <button className="challenge-history-row" key={challenge.topicId} onClick={() => router.push(`/challenge/${challenge.id}`)}><span><b>{challenge.topicTitle}</b><small>{status(challenge)}</small></span><strong>{challenge.score === undefined ? "Continue" : `${challenge.score}/100`}</strong><ArrowRight size={16}/></button>)}</section>}
    <section className="challenge-topic" aria-labelledby="topic-title">
      <h2 id="topic-title">{TOPIC.title}</h2>
      <div className="challenge-skill-list">{SKILLS.map((skill, index) => <span key={skill.id}><b>{String(index + 1).padStart(2, "0")}</b>{skill.name}</span>)}</div>
      <div className="challenge-actions">
        {latest && !latest.submittedAt ? <Button onClick={() => router.push(`/challenge/${latest.id}`)} rightIcon={<ArrowRight size={16}/>}>Resume</Button>
          : latest?.submittedAt && !latest.goalMet && !latest.trainingReady ? <Button onClick={() => router.push(`/challenge/${latest.id}`)} rightIcon={<ArrowRight size={16}/>}>Train weak skills</Button>
          : <Button onClick={() => void start(latest?.submittedAt ? latest.id : undefined)} isLoading={busy} rightIcon={<ArrowRight size={16}/>}>{latest ? "Retake" : "Start"}</Button>}
        {latest?.submittedAt && <Button variant="secondary" onClick={() => router.push(`/challenge/${latest.id}`)}>Last score · {latest.score}/100</Button>}
      </div>
    </section>
  </div></div>;
}
