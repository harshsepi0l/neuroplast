"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/easyui/Button";
import { Input, Select } from "@/shared/ui/easyui/Form";
import { SpotlightCard } from "@/shared/ui/easyui/SpotlightCard";
import type { AuthKeyStatus, AuthProviderInfo } from "../domain/auth-keys";
import type { ModelCatalogResponse } from "../domain/contracts/models";
import type { UserSettings } from "@/domains/preferences/domain/settings";
import { notifySettingsSaved } from "@/platform/presentation/settings-signal";

type KeyResponse = { keys: AuthKeyStatus[]; providers: AuthProviderInfo[] };

async function jsonOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export function ProviderKeysPanel() {
  const [data, setData] = useState<KeyResponse | null>(null);
  const [catalog, setCatalog] = useState<ModelCatalogResponse | null>(null);
  const [providerId, setProviderId] = useState("xai");
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [modelId, setModelId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const initialized = useRef(false);

  const refresh = useCallback(async () => {
    const [keys, models] = await Promise.all([
      fetch("/api/keys", { cache: "no-store" }).then(response => jsonOrThrow<KeyResponse>(response)),
      fetch("/api/models", { cache: "no-store" }).then(response => jsonOrThrow<ModelCatalogResponse>(response)),
    ]);
    setData(keys);
    setCatalog(models);
    if (!initialized.current) {
      const preferred = keys.providers.find(item => item.id === models.defaults?.model.provider && keys.keys.some(key => key.id === item.envVar && key.present))
        ?? keys.providers.find(item => keys.keys.some(key => key.id === item.envVar && key.present))
        ?? keys.providers.find(item => item.id === "xai");
      if (preferred) setProviderId(preferred.id);
      initialized.current = true;
    }
  }, []);

  useEffect(() => { void refresh().catch(failure => setError((failure as Error).message)); }, [refresh]);

  const providers = useMemo(() => {
    const unique = new Map<string, AuthProviderInfo>();
    for (const provider of data?.providers ?? []) if (!unique.has(provider.envVar)) unique.set(provider.envVar, provider);
    return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);
  const provider = providers.find(item => item.id === providerId) ?? providers.find(item => item.id === "xai") ?? providers[0];
  const status = data?.keys.find(item => item.id === provider?.envVar);
  const availableModels = catalog?.models.filter(model => model.provider === provider?.id) ?? [];
  const currentModel = catalog?.defaults?.model;
  const selectedModel = availableModels.some(model => model.id === modelId)
    ? modelId
    : currentModel?.provider === provider?.id && availableModels.some(model => model.id === currentModel.id)
      ? currentModel.id
      : "";
  const selectedDetails = availableModels.find(model => model.id === selectedModel);

  async function save() {
    if (!provider || !value.trim() || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await jsonOrThrow(await fetch(`/api/keys/${encodeURIComponent(provider.envVar)}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ value }),
      }));
      setValue(""); setVisible(false);
      await refresh(); notifySettingsSaved("keys");
      setMessage(`${provider.label} key saved. Choose a tutoring model below.`);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!provider || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await jsonOrThrow(await fetch(`/api/keys/${encodeURIComponent(provider.envVar)}`, { method: "DELETE" }));
      await refresh(); notifySettingsSaved("keys");
      setMessage(`${provider.label} key removed.`);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function useModel() {
    if (!provider || !selectedModel || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const settings = await jsonOrThrow<{ settings: UserSettings | null }>(await fetch("/api/settings", { cache: "no-store" }));
      const next = { ...settings.settings?.models, strong: { model: { provider: provider.id, id: selectedModel } } };
      await jsonOrThrow(await fetch("/api/settings/models", {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next),
      }));
      await refresh(); notifySettingsSaved("models");
      setMessage(`${availableModels.find(model => model.id === selectedModel)?.name ?? selectedModel} is ready for tutoring.`);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  return <section className="provider-key-section" aria-labelledby="provider-keys-heading">
    <div className="eyebrow">BRING YOUR OWN KEY</div>
    <h2 id="provider-keys-heading">Provider API keys</h2>
    <p className="page-intro">Add a key, then choose the model Neuroplast uses for learning sessions.</p>
    <SpotlightCard className="provider-key-card" spotlightColor="rgba(185,173,250,.06)">
      <label htmlFor="key-provider" className="small-label">PROVIDER</label>
      <Select id="key-provider" value={provider?.id ?? ""} onChange={event => { setProviderId(event.target.value); setValue(""); setError(""); setMessage(""); setModelId(""); }} options={providers.map(item => ({ value: item.id, label: item.label }))} disabled={!data || busy}/>
      {provider && <>
        <div className="provider-key-status"><KeyRound size={15}/><span>{status?.present ? `${status.masked} · ${status.source === "env" ? "set by server" : "saved"}` : "No key saved"}</span></div>
        {status?.source === "env" ? <p className="provider-key-hint">This key is set in the server environment. Change it there to replace it.</p> : <>
          <label htmlFor="provider-key-value" className="small-label">{status?.present ? "REPLACE KEY" : "API KEY"}</label>
          <div className="provider-key-entry"><Input id="provider-key-value" type={visible ? "text" : "password"} value={value} onChange={event => setValue(event.target.value)} autoComplete="off" spellCheck={false} placeholder={`Paste your ${provider.label} key`} disabled={busy} aria-label={`${provider.label} API key`}/><Button variant="ghost" size="icon" aria-label={visible ? "Hide key" : "Show key"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={16}/> : <Eye size={16}/>}</Button></div>
          <div className="provider-key-actions"><Button size="sm" disabled={!value.trim() || busy} isLoading={busy} onClick={() => void save()}>{status?.present ? "Replace key" : "Save key"}</Button>{status?.source === "file" && <Button variant="ghost" size="sm" disabled={busy} leftIcon={<Trash2 size={14}/>} onClick={() => void remove()}>Remove key</Button>}</div>
        </>}
        {status?.present && <div className="provider-model-choice"><label htmlFor="provider-model" className="small-label">TUTORING MODEL</label>{availableModels.length ? <><Select id="provider-model" value={selectedModel} onChange={event => setModelId(event.target.value)} options={[{ value: "", label: "Choose a model", disabled: true }, ...availableModels.map(model => ({ value: model.id, label: model.name }))]} disabled={busy}/>{selectedDetails && <p className="provider-key-hint provider-model-cost">Catalog price: ${selectedDetails.cost.input}/M input tokens · ${selectedDetails.cost.output}/M output tokens.</p>}<div className="provider-key-actions"><Button variant="secondary" size="sm" disabled={busy || !selectedModel || (currentModel?.provider === provider.id && currentModel.id === selectedModel)} onClick={() => void useModel()}>{currentModel?.provider === provider.id && currentModel.id === selectedModel ? <><Check size={14}/> In use</> : "Use for tutoring"}</Button></div></> : <p className="provider-key-hint">No models are available for this provider in the current catalog.</p>}</div>}
      </>}
      {error && <p className="error-banner" role="alert">{error}</p>}
      {message && <p className="provider-key-message" role="status">{message}</p>}
    </SpotlightCard>
    <p className="provider-key-footnote">Keys are saved on this server. Provider usage may be billed by the provider. Other model roles can be configured in Preferences → Agent.</p>
  </section>;
}
