import { AppError } from "@/shared/kernel/errors";
import { connectionView, emptyConnection, type Connection } from "../domain/connection";
import type { ConnectionRepository, Grant, SecretVault, SubscriptionAuthorization } from "./ports";

export class ConnectionService {
  constructor(private readonly repository: ConnectionRepository, private readonly vault: SecretVault, private readonly provider: SubscriptionAuthorization) {}

  private read(ownerId: string) { return this.repository.find(ownerId) ?? emptyConnection(ownerId); }
  private save(record: Connection, previous: Connection) {
    const next = { ...record, revision: previous.revision + 1 };
    if (!this.repository.save(next, previous.revision)) throw new AppError("connection_changed", "The connection changed. Please try again.", 409);
    return next;
  }
  status(ownerId: string) {
    let record = this.read(ownerId);
    if (record.attempt && record.attempt.expiresAt <= Date.now()) {
      record = this.save({ ...emptyConnection(ownerId), message: "The sign-in code expired. Start again." }, record);
    }
    return connectionView(record, this.provider.configured);
  }
  async begin(ownerId: string) {
    if (!this.provider.configured) throw new AppError("setup_required", "Grok sign-in needs an xAI OAuth client registration. See the project setup guide.", 503);
    const current = this.read(ownerId);
    if (current.phase === "connected") return this.status(ownerId);
    if ((current.phase === "pending" && (current.attempt?.expiresAt ?? 0) > Date.now()) || (current.phase === "authorizing" && current.leaseUntil > Date.now())) return this.status(ownerId);
    const starting = this.save({ ...emptyConnection(ownerId), phase: "authorizing", leaseUntil: Date.now() + 30_000 }, current);
    try {
      const device = await this.provider.begin();
      const next = this.save({ ...starting, phase: "pending", leaseUntil: 0, attempt: {
        id: `${starting.revision}`, deviceSecret: this.vault.seal(device.deviceCode, ownerId),
        userCode: device.userCode, verificationUrl: device.verificationUrl,
        expiresAt: Date.now() + device.expiresIn * 1000,
        nextPollAt: Date.now() + device.interval * 1000, intervalMs: device.interval * 1000,
      } }, starting);
      return connectionView(next, true);
    } catch (error) {
      if (this.read(ownerId).revision === starting.revision) this.save({ ...emptyConnection(ownerId), message: error instanceof AppError ? error.message : "Grok sign-in could not be started." }, starting);
      throw error;
    }
  }
  async poll(ownerId: string, attemptId: string) {
    let current = this.read(ownerId);
    if (!current.attempt || current.attempt.id !== attemptId || current.phase !== "pending") return this.status(ownerId);
    if (current.attempt.expiresAt <= Date.now()) return this.status(ownerId);
    if (current.leaseUntil > Date.now() || current.attempt.nextPollAt > Date.now()) return this.status(ownerId);
    current = this.save({ ...current, leaseUntil: Date.now() + 60_000 }, current);
    const attempt = current.attempt!;
    let issuedGrant: Grant | undefined;
    try {
      const result = await this.provider.poll(this.vault.open(attempt.deviceSecret, ownerId));
      if (result.kind !== "complete") {
        const intervalMs = attempt.intervalMs + (result.kind === "slow_down" ? 5000 : 0);
        const next = this.save({ ...current, leaseUntil: 0, attempt: { ...attempt, intervalMs, nextPollAt: Date.now() + intervalMs } }, current);
        return connectionView(next, true);
      }
      issuedGrant = result.grant;
      const account = await this.provider.account(result.grant.accessToken);
      let models: Connection["models"] = []; let message: string | undefined;
      try { models = await this.provider.models(result.grant.accessToken); }
      catch (error) { message = error instanceof AppError ? error.message : "Signed in, but model availability could not be checked. Refresh models to retry."; }
      if (this.read(ownerId).revision !== current.revision) {
        await this.provider.revoke(result.grant.refreshToken).catch(() => false);
        return this.status(ownerId);
      }
      const next = this.save({ ...emptyConnection(ownerId), phase: "connected", account, models,
        credential: this.vault.seal(JSON.stringify(result.grant), ownerId), expiresAt: result.grant.expiresAt,
        selectedModel: models[0]?.id, message: message ?? (models.length ? undefined : "Signed in, but no usable Grok text models were returned."),
      }, current);
      return connectionView(next, true);
    } catch (error) {
      if (issuedGrant) await this.provider.revoke(issuedGrant.refreshToken).catch(() => false);
      if (this.read(ownerId).revision !== current.revision) return this.status(ownerId);
      if (issuedGrant) return connectionView(this.save({ ...emptyConnection(ownerId), message: "Grok sign-in could not be verified. Start a new connection to try again." }, current), true);
      if (error instanceof AppError && ["authorization_denied", "expired_code", "invalid_grant"].includes(error.code)) {
        return connectionView(this.save({ ...emptyConnection(ownerId), message: error.message }, current), true);
      }
      this.save({ ...current, leaseUntil: 0, attempt: { ...attempt, nextPollAt: Date.now() + Math.max(5000, attempt.intervalMs) } }, current);
      throw error;
    }
  }
  async authorize(ownerId: string) {
    let current = this.read(ownerId);
    if (current.phase !== "connected" || !current.credential) throw new AppError("not_connected", "Connect your Grok subscription first.", 401);
    let grant = JSON.parse(this.vault.open(current.credential, ownerId)) as Grant;
    if (grant.expiresAt <= Date.now() + 60_000) {
      if (current.leaseUntil > Date.now()) throw new AppError("refresh_busy", "Your connection is refreshing. Please retry in a moment.", 409);
      current = this.save({ ...current, leaseUntil: Date.now() + 30_000 }, current);
      try {
        grant = await this.provider.refresh(grant.refreshToken);
        if (this.read(ownerId).revision !== current.revision) {
          await this.provider.revoke(grant.refreshToken).catch(() => false);
          throw new AppError("connection_changed", "The connection was disconnected or changed.", 409);
        }
        current = this.save({ ...current, leaseUntil: 0, credential: this.vault.seal(JSON.stringify(grant), ownerId), expiresAt: grant.expiresAt }, current);
      } catch (error) {
        if (this.read(ownerId).revision === current.revision) this.save({ ...current, leaseUntil: 0, phase: error instanceof AppError && error.code === "invalid_grant" ? "reconnect_required" : "connected", message: "The connection could not refresh. Retry or reconnect." }, current);
        throw error;
      }
    }
    return { accessToken: grant.accessToken, revision: current.revision, modelId: current.selectedModel };
  }
  isCurrent(ownerId: string, revision: number) { const current = this.read(ownerId); return current.phase === "connected" && current.revision === revision; }
  async refreshModels(ownerId: string) {
    const access = await this.authorize(ownerId);
    const models = await this.provider.models(access.accessToken);
    const current = this.read(ownerId);
    if (current.revision !== access.revision) throw new AppError("connection_changed", "The connection changed. Please retry.", 409);
    return connectionView(this.save({ ...current, models, selectedModel: models.some(m => m.id === current.selectedModel) ? current.selectedModel : models[0]?.id, message: models.length ? undefined : "No usable Grok text models were returned." }, current), true);
  }
  selectModel(ownerId: string, modelId: string) {
    const current = this.read(ownerId);
    if (current.phase !== "connected" || !current.models.some(model => model.id === modelId)) throw new AppError("model_unavailable", "Choose a model available on your connected account.");
    return connectionView(this.save({ ...current, selectedModel: modelId }, current), this.provider.configured);
  }
  setBackgroundUse(ownerId: string, enabled: boolean) {
    const current = this.read(ownerId);
    return connectionView(this.save({ ...current, allowBackgroundUse: enabled }, current), this.provider.configured);
  }
  async disconnect(ownerId: string) {
    const current = this.read(ownerId);
    const grant = current.credential ? JSON.parse(this.vault.open(current.credential, ownerId)) as Grant : undefined;
    const next = this.save(emptyConnection(ownerId), current);
    if (grant && !await this.provider.revoke(grant.refreshToken).catch(() => false)) {
      if (this.read(ownerId).revision === next.revision) this.save({ ...next, message: "Disconnected from Neuroplast. Provider-side revocation could not be confirmed; review connected apps in your xAI account." }, next);
    }
    return this.status(ownerId);
  }
}
