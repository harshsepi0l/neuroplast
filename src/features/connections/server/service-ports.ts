import type { Connection, GrokModel } from "../core/connection";

export type Grant = { accessToken: string; refreshToken: string; expiresAt: number };
export interface ConnectionRepository {
  find(ownerId: string): Connection | undefined;
  save(connection: Connection, expectedRevision: number): boolean;
}
export interface SecretVault { seal(value: string, ownerId: string): string; open(value: string, ownerId: string): string }
export type PollResult = { kind: "pending" | "slow_down" } | { kind: "complete"; grant: Grant };
export interface SubscriptionAuthorization {
  configured: boolean;
  begin(): Promise<{ deviceCode: string; userCode: string; verificationUrl: string; expiresIn: number; interval: number }>;
  poll(deviceCode: string): Promise<PollResult>;
  refresh(refreshToken: string): Promise<Grant>;
  account(accessToken: string): Promise<{ id: string; label: string }>;
  models(accessToken: string): Promise<GrokModel[]>;
  revoke(refreshToken: string): Promise<boolean>;
}
