import "server-only";
import { ConnectionService } from "@/features/connections/server/connection-service";
import { SqliteConnectionRepository } from "@/features/connections/server/sqlite-connection-repository";
import { EncryptedVault } from "@/features/connections/server/encrypted-vault";
import { XaiAuthorization } from "@/features/connections/server/xai-authorization";
import { GrokCliAuthorization } from "@/features/connections/server/grok-cli-authorization";

const processState = globalThis as typeof globalThis & { neuroplastServices?: ReturnType<typeof createServices> };
function createServices() {
  const connections = new ConnectionService(new SqliteConnectionRepository(), new EncryptedVault(),
    // An own xAI registration wins; otherwise pi's built-in SuperGrok sign-in.
    process.env.XAI_OAUTH_CLIENT_ID?.trim() ? new XaiAuthorization() : new GrokCliAuthorization());
  return { connections };
}
export function services() { return processState.neuroplastServices ??= createServices(); }
