import { SkillTreeView } from "@/features/knowledge/ui/skill-tree-view";
import { challengeTopic, learnTopic, type SkillTreeTopic } from "@/features/knowledge/core/skill-trees";
import { getChat, listChats } from "@/features/learning/server/chats";
import { knowledgeTrees } from "@/features/challenges/server/challenge-store";
import { TOPIC } from "@/features/challenges/core/linear-equations";

export const dynamic = "force-dynamic";

/** Knowledge: one skill tree per topic — each Learn session's plan (newest
 *  first), then challenge topics, with the built-in chapter last. */
export default async function Knowledge({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
	const { topic } = await searchParams;
	const learn: SkillTreeTopic[] = [];
	for (const summary of listChats()) {
		if (summary.kind !== "teach" || !summary.plan) continue;
		const record = getChat(summary.id);
		if (!record?.tree || record.tree.nodes.length === 0) continue;
		learn.push(learnTopic({ id: record.id, title: record.title, updatedAt: record.updatedAt, tree: record.tree, messages: record.messages }));
	}
	const trees = knowledgeTrees();
	const custom = trees.filter((t) => t.topic.id !== TOPIC.id).map((t) => challengeTopic(t, false));
	const chapter = trees.filter((t) => t.topic.id === TOPIC.id).map((t) => challengeTopic(t, true));
	return <SkillTreeView topics={[...learn, ...custom, ...chapter]} initialTopic={topic} />;
}
