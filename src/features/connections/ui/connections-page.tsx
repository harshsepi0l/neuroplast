"use client";
import { ConnectionPanel } from "./connection-panel";
import { useConnection } from "./connection-context";
import { ProviderKeysPanel } from "./provider-keys-panel";
export function ConnectionsPage() {
  const { connection, busy, error, action } = useConnection();
  return <div className="integrated-page"><div className="integrated-scroll">
    {error && <p role="alert" className="error-banner">{error}</p>}
    <ConnectionPanel connection={connection} busy={busy} action={action}/>
    <ProviderKeysPanel />
  </div></div>;
}
