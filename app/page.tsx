import { listChallenges } from "@/domains/challenges/infrastructure/challenge-store";
import { ChallengeHome } from "@/domains/challenges/presentation/challenge-home";

export const dynamic = "force-dynamic";
export default function Home() { return <ChallengeHome challenges={listChallenges()}/>; }
