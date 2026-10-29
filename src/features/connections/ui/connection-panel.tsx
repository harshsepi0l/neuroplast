"use client";
import { ExternalLink, RefreshCw, ShieldCheck, Unplug, ArrowUpRight, Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/ui/easyui/Button";
import { Select, Switch } from "@/ui/easyui/Form";
import { SpotlightCard } from "@/ui/easyui/SpotlightCard";
import type { ConnectionView } from "../core/connection";

export function ConnectionPanel({ connection, busy, action }: { connection: ConnectionView | null; busy: boolean; action: (command: Record<string, string>) => Promise<void> }) {
  const [copied, setCopied] = useState(false);
  const connected = connection?.phase === "connected";
  const pending = connection?.phase === "pending" || connection?.phase === "authorizing";
  return <section className="settings-page">
    <h2 className="connection-heading">Connect a subscription</h2>
    <SpotlightCard className="connection-card" spotlightColor="rgba(185,173,250,.06)">
      <div className="between"><div className="row gap-4"><div className="grok-symbol" aria-hidden="true">𝕏</div><div><h2>Grok</h2><p className="muted text-sm">xAI subscription</p></div></div>
        <span className={`status-badge ${connected ? "active" : ""}`}><span/>{connected ? "Connected" : pending ? "Awaiting approval" : "Not connected"}</span></div>
      <p className="connection-description">Sign in with SuperGrok or X Premium. Lessons count toward your Grok plan.</p>
      {connection && !connection.configured && <div className="notice"><strong>Sign-in setup is incomplete</strong><p>This site needs an xAI OAuth client registration before accounts can be connected.</p></div>}
      {connection?.message && <p className="notice" role="status">{connection.message}</p>}
      {connection?.account && <div className="account-row"><ShieldCheck size={17}/><div><span className="small-label">CONNECTED ACCOUNT</span><p>{connection.account.label}</p></div></div>}
      {connection?.attempt && <div className="device-step">
        <p className="small-label">APPROVE YOUR CONNECTION AT XAI</p><div className="between"><code>{connection.attempt.userCode}</code><Button variant="ghost" size="icon" aria-label="Copy sign-in code" onClick={async () => { try { await navigator.clipboard.writeText(connection.attempt!.userCode); setCopied(true); } catch { setCopied(false); } }}>{copied ? <Check size={16}/> : <Copy size={16}/>}</Button></div>
        <p>Open xAI, sign in, and approve this code. Keep this page open—we’ll check for your approval.</p>
        <a className="verification-link" href={connection.attempt.verificationUrl} target="_blank" rel="noopener noreferrer">Continue to xAI <ExternalLink size={14}/></a>
      </div>}
      {connected && <div className="model-field"><label htmlFor="grok-model" className="small-label">TUTORING MODEL</label>
        <Select id="grok-model" value={connection?.selectedModel || ""} disabled={busy || !connection?.models.length} onChange={event => void action({ action: "select-model", modelId: event.target.value })} options={connection?.models.length ? connection.models.map(model => ({ value: model.id, label: model.name })) : [{ value: "", label: "No models available" }]}/>
      </div>}
      <div className="connection-actions">
        {connected ? <><Button variant="secondary" size="sm" disabled={busy} leftIcon={<RefreshCw size={14}/>} onClick={() => void action({ action: "refresh-models" })}>Refresh models</Button><Button variant="ghost" size="sm" disabled={busy} leftIcon={<Unplug size={14}/>} onClick={() => void action({ action: "disconnect" })}>Disconnect</Button></>
          : <><Button disabled={!connection?.configured || busy || pending} isLoading={busy && !pending} rightIcon={<ArrowUpRight size={15}/>} onClick={() => void action({ action: "connect" })}>{connection?.phase === "reconnect_required" ? "Reconnect Grok" : "Connect Grok"}</Button>{pending && <Button variant="ghost" disabled={busy} onClick={() => void action({ action: "disconnect" })}>Cancel sign-in</Button>}</>}
      </div>
      {connected && <div className="mt-6"><Switch label="Allow background use" description="Let research and knowledge-extraction agents use this subscription." checked={connection?.allowBackgroundUse === true} onChange={enabled => void action({ action: "background-use", enabled: String(enabled) })}/></div>}
    </SpotlightCard>
  </section>;
}
