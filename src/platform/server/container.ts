import "server-only";
import { ConnectionService } from "@/domains/connections/application/connection-service";
import { SqliteConnectionRepository } from "@/domains/connections/infrastructure/sqlite-connection-repository";
import { EncryptedVault } from "@/domains/connections/infrastructure/encrypted-vault";
import { XaiAuthorization } from "@/domains/connections/infrastructure/xai-authorization";

const processState = globalThis as typeof globalThis & { neuroplastServices?: ReturnType<typeof createServices> };
function createServices() {
  const connections = new ConnectionService(new SqliteConnectionRepository(), new EncryptedVault(), new XaiAuthorization());
  return { connections };
}
export function services() { return processState.neuroplastServices ??= createServices(); }
