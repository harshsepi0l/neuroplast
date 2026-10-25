import { knowledgeTrees } from "@/domains/challenges/infrastructure/challenge-store";
import { KnowledgeTreeView } from "@/domains/challenges/presentation/knowledge-tree-view";
export const dynamic = "force-dynamic";
export default function Knowledge() { return <KnowledgeTreeView trees={knowledgeTrees()}/>; }
