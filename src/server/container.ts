import "server-only";
import { ConnectionService } from "@/features/connections/server/connection-service";
import { SqliteConnectionRepository } from "@/features/connections/server/sqlite-connection-repository";
import { EncryptedVault } from "@/features/connections/server/encrypted-vault";
import { XaiAuthorization } from "@/features/connections/server/xai-authorization";

const processState = globalThis as typeof globalThis & { neuroplastServices?: ReturnType<typeof createServices> };
function createServices() {
  const connections = new ConnectionService(new SqliteConnectionRepository(), new EncryptedVault(), new XaiAuthorization());
  return { connections };
}
export function services() { return processState.neuroplastServices ??= createServices(); }
