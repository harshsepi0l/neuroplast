import { KnowledgeWorkspace } from "@/domains/knowledge/presentation/knowledge-workspace";
import { readSettings } from "@/domains/preferences/infrastructure/persistence/settings";
import { resolveSettings } from "@/domains/preferences/domain/settings-resolution";

export const dynamic = "force-dynamic";
export default function LegacyKnowledge() { return <KnowledgeWorkspace rendering={resolveSettings(readSettings()).graph.rendering}/>; }
