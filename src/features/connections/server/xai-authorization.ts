import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { Grant, PollResult, SubscriptionAuthorization } from "./service-ports";

const issuer = "https://auth.x.ai";
const deviceSchema = z.object({ device_code: z.string().min(1), user_code: z.string().min(1), verification_uri: z.string().url(), verification_uri_complete: z.string().url().optional(), expires_in: z.number().positive().max(86400), interval: z.number().nonnegative().optional() });
const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1).optional(), expires_in: z.number().positive(), scope: z.string().optional(), token_type: z.string().optional() });

export class XaiAuthorization implements SubscriptionAuthorization {
  private readonly clientId = process.env.XAI_OAUTH_CLIENT_ID?.trim() ?? "";
  private readonly secret = process.env.XAI_OAUTH_CLIENT_SECRET?.trim();
  private readonly scope = process.env.XAI_OAUTH_SCOPES?.trim() || "openid profile email offline_access api:access";
  readonly configured = Boolean(this.clientId);
  private async form(path: string, fields: Record<string, string>) {
    if (!this.configured) throw new AppError("setup_required", "Configure the xAI OAuth client before signing in.", 503);
    const response = await fetch(issuer + path, { method: "POST", body: new URLSearchParams({ client_id: this.clientId, ...(this.secret ? { client_secret: this.secret } : {}), ...fields }), headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const body: unknown = await response.json().catch(() => null);
    return { response, body };
  }
  private fail(status: number, code?: string): never {
    const known: Record<string, string> = {
      access_denied: "Grok sign-in was declined.", expired_token: "Your sign-in code expired. Start again.",
      invalid_grant: "Your Grok authorization expired or was revoked. Reconnect.",
      invalid_client: "xAI did not accept this application's OAuth registration.",
      invalid_scope: "xAI did not accept the configured permissions for this application.",
    };
    const mapped = code === "access_denied" ? "authorization_denied" : code === "expired_token" ? "expired_code" : code ?? "provider_error";
    throw new AppError(mapped, code && known[code] ? known[code] : status === 403 ? "xAI has not enabled this account or client for the requested access." : status === 429 ? "Grok's request limit was reached. Wait and retry." : "Grok could not complete the request. Please retry.", status === 429 ? 429 : 502);
  }
  async begin() {
    const { response, body } = await this.form("/oauth2/device/code", { scope: this.scope });
    if (!response.ok) this.fail(response.status, z.object({ error: z.string() }).safeParse(body).data?.error);
    const parsed = deviceSchema.safeParse(body);
    if (!parsed.success) throw new AppError("invalid_response", "xAI returned an invalid sign-in response.", 502);
    const data = parsed.data;
    const url = new URL(data.verification_uri_complete ?? data.verification_uri);
    if (url.protocol !== "https:" || !["auth.x.ai", "accounts.x.ai", "x.ai"].includes(url.hostname) || url.username || url.password) throw new AppError("invalid_response", "xAI returned an unexpected verification destination.", 502);
    return { deviceCode: data.device_code, userCode: data.user_code, verificationUrl: url.href, expiresIn: data.expires_in, interval: Math.max(data.interval ?? 5, 1) };
  }
  private grant(body: unknown, previousRefresh?: string): Grant {
    const parsed = tokenSchema.safeParse(body);
    if (!parsed.success) throw new AppError("invalid_response", "xAI returned an invalid token response.", 502);
    const token = parsed.data;
    if (token.token_type && token.token_type.toLowerCase() !== "bearer") throw new AppError("invalid_response", "xAI returned an unsupported token type.", 502);
    if (token.scope && !token.scope.split(/\s+/).includes("api:access")) throw new AppError("missing_scope", "Sign-in did not grant Grok model access. Check the client permissions.", 403);
    const refreshToken = token.refresh_token ?? previousRefresh;
    if (!refreshToken) throw new AppError("invalid_response", "xAI did not grant a renewable connection.", 502);
    return { accessToken: token.access_token, refreshToken, expiresAt: Date.now() + token.expires_in * 1000 };
  }
  async poll(deviceCode: string): Promise<PollResult> {
    const { response, body } = await this.form("/oauth2/token", { grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: deviceCode });
    const code = z.object({ error: z.string() }).safeParse(body).data?.error;
    if (code === "authorization_pending") return { kind: "pending" };
    if (code === "slow_down") return { kind: "slow_down" };
    if (!response.ok) this.fail(response.status, code);
    return { kind: "complete", grant: this.grant(body) };
  }
  async refresh(refreshToken: string) {
    const { response, body } = await this.form("/oauth2/token", { grant_type: "refresh_token", refresh_token: refreshToken });
    if (!response.ok) this.fail(response.status, z.object({ error: z.string() }).safeParse(body).data?.error);
    return this.grant(body, refreshToken);
  }
  async account(accessToken: string) {
    const response = await fetch(issuer + "/oauth2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) this.fail(response.status);
    const data = z.object({ sub: z.string().min(1), name: z.string().optional(), email: z.string().optional() }).parse(await response.json());
    return { id: data.sub, label: data.email || data.name || "Connected xAI account" };
  }
  async models(accessToken: string) {
    const response = await fetch("https://api.x.ai/v1/models", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) this.fail(response.status);
    const data = z.object({ data: z.array(z.object({ id: z.string().min(1) })) }).parse(await response.json());
    return data.data.filter(model => /^grok/i.test(model.id) && !/imagine|image|video|voice|tts/i.test(model.id)).map(model => ({ id: model.id, name: model.id }));
  }
  async revoke(refreshToken: string) {
    const { response } = await this.form("/oauth2/revoke", { token: refreshToken, token_type_hint: "refresh_token" });
    return response.ok;
  }
}
