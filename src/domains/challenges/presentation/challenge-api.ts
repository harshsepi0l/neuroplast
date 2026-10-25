import type { ChallengeSummary, ChallengeView, TrainingView } from "../domain/contracts";

export async function challengeRequest<T>(path: string, method: "POST" | "PATCH", body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json", "x-neuroplast-client": "web" }, body: JSON.stringify(body), cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The request failed. Please retry.");
  return data as T;
}
export async function loadChallenge(id: string): Promise<ChallengeView> {
  const response = await fetch(`/api/challenges/${id}`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The challenge could not be loaded.");
  return data as ChallengeView;
}
export async function loadChallengeList(): Promise<ChallengeSummary[]> {
  const response = await fetch("/api/challenges", { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Challenges could not be loaded.");
  return Array.isArray(data.challenges) ? data.challenges as ChallengeSummary[] : [];
}
export async function loadTraining(id: string): Promise<TrainingView> {
  const response = await fetch(`/api/challenges/${id}/training`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Training could not be loaded.");
  return data as TrainingView;
}
