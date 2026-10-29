import { KnowledgeWorkspace } from "@/features/knowledge/ui/knowledge-workspace";
import { readSettings } from "@/features/settings/server/settings-store";
import { resolveSettings } from "@/features/settings/core/settings-resolution";

export const dynamic = "force-dynamic";
export default function LegacyKnowledge() { return <KnowledgeWorkspace rendering={resolveSettings(readSettings()).graph.rendering}/>; }
