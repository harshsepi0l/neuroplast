import { HomeDashboard, type HomeSkill, type HomeWeek } from "@/app-shell/home-dashboard";
import { getChat, listChats } from "@/features/learning/server/chats";
import { answerTally } from "@/features/learning/core/answer-tally";
import { knowledgeTrees, listChallenges } from "@/features/challenges/server/challenge-store";

export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 86_400_000;

export default function Home() {
	const now = Date.now();
	const sessions = listChats();
	const challenge = listChallenges()[0];

	// This week: sessions touched in the last seven days, and the answers
	// given in them during that time.
	const since = now - WEEK_MS;
	const week: HomeWeek = { sessions: 0, answered: 0, graded: 0, correct: 0 };
	for (const s of sessions) {
		if (Date.parse(s.updatedAt) < since) continue;
		week.sessions++;
		const record = getChat(s.id);
		if (!record) continue;
		const t = answerTally(record.messages, since);
		week.answered += t.answered;
		week.graded += t.graded;
		week.correct += t.correct;
	}

	const tree = challenge ? knowledgeTrees().find((t) => t.topic.id === challenge.topicId) : undefined;
	const skills: HomeSkill[] = (tree?.skills ?? []).map((skill) => ({
		id: skill.id,
		name: skill.name,
		state: skill.state,
		latest: skill.latest ? { correct: skill.latest.correct, total: skill.latest.total } : undefined,
	}));

	return <HomeDashboard sessions={sessions.slice(0, 5)} challenge={challenge} skills={skills} week={week} now={now} />;
}
