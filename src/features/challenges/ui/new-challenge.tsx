"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import type { ChallengeView } from "../core/contracts";
import { challengeRequest } from "./challenge-api";

export function NewChallenge() {
  const router = useRouter();
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    if (request.trim().length < 8 || busy) return;
    setBusy(true); setError("");
    try {
      const challenge = await challengeRequest<ChallengeView>("/api/challenges", "POST", { topicId: "custom", request: request.trim() });
      router.push(`/challenge/${challenge.id}`);
    } catch (failure) { setError((failure as Error).message); setBusy(false); }
  }
  return <div className="challenge-page"><div className="challenge-container new-challenge-page">
    <h1>Test yourself</h1>
    <section className="challenge-topic" aria-label="Create a topic challenge">
      <label className="sr-only" htmlFor="challenge-request">Topic</label>
      <textarea id="challenge-request" autoFocus maxLength={500} value={request} onChange={event => setRequest(event.target.value)} placeholder="A topic or question, e.g. photosynthesis"/>
      <div className="new-challenge-form-bottom"><span>{request.length}/500</span><Button onClick={() => void create()} disabled={request.trim().length < 8 || busy} isLoading={busy} rightIcon={<ArrowRight size={16}/>}>Build quiz</Button></div>
      {error && <div className="new-challenge-error" role="alert"><p>{error}</p><Link href="/connections">Check model connection</Link></div>}
    </section>
  </div></div>;
}
