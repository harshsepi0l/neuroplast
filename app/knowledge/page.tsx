import { knowledgeTrees } from "@/features/challenges/server/challenge-store";
import { KnowledgeTreeView } from "@/features/challenges/ui/knowledge-tree-view";
export const dynamic = "force-dynamic";
export default function Knowledge() { return <KnowledgeTreeView trees={knowledgeTrees()}/>; }
