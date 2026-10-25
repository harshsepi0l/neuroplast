import { notFound } from "next/navigation";
import { challengeView, readChallenge } from "@/domains/challenges/infrastructure/challenge-store";
import { ChallengeView } from "@/domains/challenges/presentation/challenge-view";

export const dynamic = "force-dynamic";
export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { return <ChallengeView initial={challengeView(readChallenge(id))}/>; }
  catch { notFound(); }
}
