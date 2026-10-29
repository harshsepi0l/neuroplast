"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Check, Circle, GitBranch, RotateCcw, Target } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import type { KnowledgeTree, SkillKnowledge, SkillState } from "../core/knowledge-tree";
import type { ChallengeView } from "../core/contracts";
import { challengeRequest } from "./challenge-api";

const stateLabels: Record<SkillState, string> = {
  unassessed: "Not assessed", "needs-practice": "Needs practice", practicing: "In training",
  trained: "Trained for retake", strong: "Strong on last boss",
};
const stageLabels = { recall: "Recall the move", discrimination: "Choose the method", application: "Apply the skill", "delayed-recall": "Recall it again" };

function SkillNode({ skill, selected, onSelect, number }: { skill: SkillKnowledge; selected: boolean; onSelect: () => void; number: string }) {
  return <button type="button" className={`knowledge-skill-node ${skill.state}${selected ? " selected" : ""}`} aria-pressed={selected} onClick={onSelect}>
    <div className="knowledge-node-top"><span className="knowledge-node-number">{number}</span><span className={`knowledge-state-dot ${skill.state}`}/></div>
    <strong>{skill.name}</strong>
    <span className="knowledge-node-status">{stateLabels[skill.state]}</span>
    <div className="knowledge-node-meter" aria-label={`${skill.training.completed} of ${skill.training.total} training steps completed`}><span style={{ width: `${100 * skill.training.completed / skill.training.total}%` }}/></div>
    <small>{skill.latest ? `${skill.latest.correct}/${skill.latest.total} on last boss` : "Take a boss challenge to assess"}</small>
  </button>;
}

export function KnowledgeTreeView({ trees }: { trees: KnowledgeTree[] }) {
  const router = useRouter();
  const [topicId, setTopicId] = useState(trees[0].topic.id);
  const tree = trees.find(item => item.topic.id === topicId) ?? trees[0];
  const [selectedId, setSelectedId] = useState<string>(tree.skills[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = tree.skills.find(skill => skill.id === selectedId) ?? tree.skills[0];
  const needsTraining = tree.skills.some(skill => skill.state === "needs-practice" || skill.state === "practicing");

  async function primaryAction() {
    if (tree.activeChallengeId) { router.push(`/challenge/${tree.activeChallengeId}`); return; }
    if (tree.latestChallengeId && needsTraining) { router.push(`/challenge/${tree.latestChallengeId}`); return; }
    setBusy(true); setError("");
    try {
      const attempt = await challengeRequest<ChallengeView>("/api/challenges", "POST", {
        topicId: tree.topic.id, ...(tree.latestChallengeId ? { previousId: tree.latestChallengeId } : {}),
      });
      router.push(`/challenge/${attempt.id}`);
    } catch (failure) { setError((failure as Error).message); setBusy(false); }
  }

  const primaryLabel = tree.activeChallengeId ? "Resume boss" : tree.latestChallengeId && needsTraining ? "Train weak skills" : tree.latestChallengeId ? "Retake boss" : "Start boss challenge";
  return <div className="knowledge-page"><div className="knowledge-container">
    <div className="challenge-eyebrow"><GitBranch size={16}/> KNOWLEDGE TREE</div>
    <div className="knowledge-intro-row"><div><h1>See what you&apos;ve built.</h1><p>Your map grows from boss results and the practice you complete. Select a skill to see its recall, application, and training history.</p></div>
      <Button onClick={() => void primaryAction()} isLoading={busy} rightIcon={<ArrowRight size={16}/>}>{primaryLabel}</Button></div>
    {error && <p role="alert" className="error-banner">{error}</p>}
    {trees.length > 1 && <div className="knowledge-topic-picker" aria-label="Choose a topic">{trees.map(item => <button type="button" key={item.topic.id} className={item.topic.id === tree.topic.id ? "selected" : ""} aria-pressed={item.topic.id === tree.topic.id} onClick={() => { setTopicId(item.topic.id); setSelectedId(item.skills[0].id); }}><span>{item.topic.title}</span><small>{item.latestScore === undefined ? "Not assessed" : `${item.latestScore}/100 latest`}</small></button>)}</div>}
    <div className="knowledge-overview" aria-label="Learning overview"><div><strong>{tree.attempts}</strong><span>Scored attempts</span></div><div><strong>{tree.readySkills}<small>/{tree.skills.length}</small></strong><span>Skills ready</span></div><div><strong>{tree.latestScore === undefined ? "—" : `${tree.latestScore}/100`}</strong><span>Latest boss score</span></div><div><strong>{tree.bestScore === undefined ? "—" : `${tree.bestScore}/100`}</strong><span>Best boss score</span></div></div>
    <div className="knowledge-layout"><section className="knowledge-map" aria-label="Topic and skill tree">
      <div className="knowledge-map-heading"><div><span className="challenge-tag">TOPIC · FOUR SKILLS</span><h2>Learning path</h2></div><span className="knowledge-map-key"><i/> Skill status from your latest boss</span></div>
      <div className="knowledge-topic-node"><div className="knowledge-topic-icon"><BookOpen size={21}/></div><div><span className="challenge-tag">TOPIC</span><h3>{tree.topic.title}</h3><p>{tree.topic.description}</p></div><div className={`knowledge-topic-score${tree.bossCleared ? " cleared" : ""}`}><Target size={15}/>{tree.bossCleared ? "Boss cleared" : tree.latestScore !== undefined ? "Boss in progress" : "Not yet assessed"}</div></div>
      <div className="knowledge-chain">
        <SkillNode skill={tree.skills[0]} number="01" selected={selected.id === tree.skills[0].id} onSelect={() => setSelectedId(tree.skills[0].id)}/>
        <SkillNode skill={tree.skills[1]} number="02" selected={selected.id === tree.skills[1].id} onSelect={() => setSelectedId(tree.skills[1].id)}/>
        <div className="knowledge-fork"><SkillNode skill={tree.skills[2]} number="03" selected={selected.id === tree.skills[2].id} onSelect={() => setSelectedId(tree.skills[2].id)}/><SkillNode skill={tree.skills[3]} number="04" selected={selected.id === tree.skills[3].id} onSelect={() => setSelectedId(tree.skills[3].id)}/></div>
      </div>
    </section><aside className="knowledge-detail" aria-live="polite">
      <span className="challenge-tag">SKILL DETAIL</span><h2>{selected.name}</h2><p className="knowledge-detail-description">{selected.description}</p>
      <span className={`knowledge-status-pill ${selected.state}`}>{stateLabels[selected.state]}</span>
      <div className="knowledge-detail-section"><h3>Latest boss check</h3>{selected.latest ? <><div className="knowledge-detail-score"><strong>{selected.latest.correct}/{selected.latest.total}</strong><span>{new Date(selected.latest.at).toLocaleDateString()}</span></div><div className="knowledge-mode-row"><span>Recall</span><strong>{selected.latest.recall.correct}/{selected.latest.recall.total}</strong></div><div className="knowledge-mode-row"><span>Application</span><strong>{selected.latest.application.correct}/{selected.latest.application.total}</strong></div></> : <p>Take a boss challenge to see where this skill stands.</p>}</div>
      <div className="knowledge-detail-section"><h3>Training steps</h3><div className="knowledge-stage-list">{selected.training.stages.map(stage => <div key={stage.stage} className={stage.passed ? "passed" : ""}>{stage.passed ? <Check size={15}/> : <Circle size={14}/>}<span>{stageLabels[stage.stage]}</span></div>)}</div><p>{selected.training.completed}/{selected.training.total} complete for the latest assessment.</p></div>
      <div className="knowledge-detail-section knowledge-practice-history"><h3>Practice history</h3><p>{selected.training.correct} correct of {selected.training.answered} practice answers · {selected.training.cycles} complete training {selected.training.cycles === 1 ? "cycle" : "cycles"}</p>{selected.training.lastPracticedAt && <p>Last practiced {new Date(selected.training.lastPracticedAt).toLocaleDateString()}.</p>}</div>
      {selected.latest && <Button variant="secondary" onClick={() => router.push(`/challenge/${selected.latest!.challengeId}`)} rightIcon={<ArrowRight size={15}/>}>Review boss result</Button>}
    </aside></div>
    <div className="knowledge-footer"><RotateCcw size={15}/><span>Every retake uses new problems. Your training history stays in this map.</span><Link href="/knowledge/legacy">Previous notes graph</Link></div>
  </div></div>;
}
