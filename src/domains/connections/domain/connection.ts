export type GrokModel = { id: string; name: string };
export type ConnectionPhase = "disconnected" | "authorizing" | "pending" | "connected" | "reconnect_required";
export type DeviceAttempt = {
  id: string; deviceSecret: string; userCode: string; verificationUrl: string;
  expiresAt: number; nextPollAt: number; intervalMs: number;
};
export type Connection = {
  ownerId: string; revision: number; phase: ConnectionPhase; leaseUntil: number;
  attempt?: DeviceAttempt; credential?: string; expiresAt?: number;
  account?: { id: string; label: string }; models: GrokModel[];
  selectedModel?: string; message?: string;
  allowBackgroundUse?: boolean;
};
export type ConnectionView = {
  configured: boolean; phase: ConnectionPhase; account?: { label: string };
  models: GrokModel[]; selectedModel?: string; message?: string;
  allowBackgroundUse?: boolean;
  attempt?: { id: string; userCode: string; verificationUrl: string; expiresAt: number; nextPollAt: number };
};
export function emptyConnection(ownerId: string): Connection {
  return { ownerId, revision: 0, phase: "disconnected", leaseUntil: 0, models: [] };
}
export function connectionView(connection: Connection, configured: boolean): ConnectionView {
  const { phase, models, selectedModel, message, account, attempt } = connection;
  return {
    configured, phase, models, selectedModel, message, allowBackgroundUse: connection.allowBackgroundUse === true,
    account: account ? { label: account.label } : undefined,
    attempt: attempt ? { id: attempt.id, userCode: attempt.userCode, verificationUrl: attempt.verificationUrl, expiresAt: attempt.expiresAt, nextPollAt: attempt.nextPollAt } : undefined,
  };
}
