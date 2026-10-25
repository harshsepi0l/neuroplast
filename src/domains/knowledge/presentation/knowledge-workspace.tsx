"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Network } from "lucide-react";
import { GraphView } from "./graph-view";
import { MinimalHome } from "@/domains/knowledge/presentation/knowledge-summary";
import { Button } from "@/shared/ui/easyui/Button";
import { useDraft } from "@/domains/learning/presentation/draft-context";
export function KnowledgeWorkspace({ rendering }: { rendering: boolean }) {
  const draft = useDraft("practice"); const router = useRouter(); const [picking, setPicking] = useState(false);
  const props = { chainSelectOpen: picking, practiceSelection: new Set(draft.picks.map(pick => pick.id)), onPracticeSelectionChange: (picks: typeof draft.picks) => draft.update({ picks }), onChainSelectClose: () => setPicking(false) };
  return <div className="knowledge-workspace"><div className="knowledge-canvas">{rendering ? <GraphView {...props}/> : <MinimalHome {...props}/>}</div><div className="knowledge-practice"><Button variant="secondary" size="sm" leftIcon={<Network size={14}/>} onClick={() => setPicking(true)}>{draft.picks.length ? `${draft.picks.length} topics selected` : "Choose topics"}</Button>{draft.picks.length > 0 && <><Button variant="ghost" size="sm" onClick={() => draft.update({ picks: [] })}>Clear</Button><Button size="sm" leftIcon={<Dumbbell size={14}/>} onClick={() => router.push("/practice")}>Practice these</Button></>}</div></div>;
}
