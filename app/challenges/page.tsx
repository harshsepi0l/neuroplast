import { listChallenges } from "@/features/challenges/server/challenge-store";
import { ChallengeHome } from "@/features/challenges/ui/challenge-home";

export const dynamic = "force-dynamic";
export default function ChallengesPage() { return <ChallengeHome challenges={listChallenges()}/>; }
