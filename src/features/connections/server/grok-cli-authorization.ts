import "server-only";
import { randomUUID } from "node:crypto";
import { xaiProvider } from "@earendil-works/pi-ai/providers/xai";
import { AppError } from "@/lib/errors";
import { XaiAuthorization } from "./xai-authorization";
import type { Grant, PollResult, SubscriptionAuthorization } from "./service-ports";

/**
 * Grok subscription sign-in through pi-ai's own xAI OAuth (the SuperGrok /
 * X Premium device-code login pi ships, the same route the ChatGPT
 * connection takes through pi's OpenAI login). Used when no
 * XAI_OAUTH_CLIENT_ID registration is configured.
 *
 * pi's login is one long call (show code → poll until approved). The
 * connection service polls in steps, so begin() starts the login in the
 * background and hands back an opaque handle; poll(handle) reports whether
 * it finished. Attempts live in memory: a restart mid-sign-in means
 * starting again.
 */
interface Attempt {
	controller: AbortController;
	grant?: Grant;
	error?: unknown;
	done: boolean;
}

const key = Symbol.for("neuroplast.grok-cli.attempts");
function attempts(): Map<string, Attempt> {
	const global = globalThis as typeof globalThis & { [key]?: Map<string, Attempt> };
	return (global[key] ??= new Map());
}

function oauth() {
	const auth = xaiProvider().auth.oauth;
	if (!auth) throw new AppError("setup_required", "This version of the model runtime has no Grok sign-in.", 503);
	return auth;
}

function toGrant(credential: { access: string; refresh: string; expires: number }): Grant {
	return { accessToken: credential.access, refreshToken: credential.refresh, expiresAt: credential.expires };
}

function signInError(error: unknown): AppError {
	if (error instanceof AppError) return error;
	const message = error instanceof Error ? error.message : "";
	if (/denied/i.test(message)) return new AppError("authorization_denied", "Grok sign-in was declined.", 502);
	if (/expired/i.test(message)) return new AppError("expired_code", "Your sign-in code expired. Start again.", 502);
	if (/429|rate/i.test(message)) return new AppError("rate_limited", "Grok's request limit was reached. Wait and retry.", 429);
	return new AppError("provider_error", "Grok could not complete the sign-in. Please retry.", 502);
}

/** The account behind a token: xAI's userinfo, else the token's own claims. */
function claims(accessToken: string): { id: string; label: string } | null {
	try {
		const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { sub?: string; email?: string; name?: string };
		return payload.sub ? { id: payload.sub, label: payload.email || payload.name || "Grok account" } : null;
	} catch {
		return null;
	}
}

export class GrokCliAuthorization implements SubscriptionAuthorization {
	readonly configured = true;
	private readonly http = new XaiAuthorization();

	async begin() {
		const controller = new AbortController();
		const handle = randomUUID();
		const attempt: Attempt = { controller, done: false };
		attempts().set(handle, attempt);
		const device = new Promise<{ userCode: string; verificationUri: string; intervalSeconds?: number; expiresInSeconds?: number }>((resolve, reject) => {
			oauth()
				.login({
					signal: controller.signal,
					prompt: async () => { throw new Error("Grok sign-in asked for input this app cannot give."); },
					notify: (event) => { if (event.type === "device_code") resolve(event); },
				})
				.then(
					(credential) => { attempt.grant = toGrant(credential); attempt.done = true; },
					(error: unknown) => { attempt.error = error; attempt.done = true; reject(error); },
				);
			setTimeout(() => reject(new Error("xAI did not answer the sign-in request.")), 20_000);
		});
		let info;
		try {
			info = await device;
		} catch (error) {
			controller.abort();
			attempts().delete(handle);
			throw signInError(error);
		}
		const url = new URL(info.verificationUri);
		if (url.protocol !== "https:" || !["auth.x.ai", "accounts.x.ai", "x.ai"].includes(url.hostname) || url.username || url.password) {
			controller.abort();
			attempts().delete(handle);
			throw new AppError("invalid_response", "xAI returned an unexpected verification destination.", 502);
		}
		const expiresIn = info.expiresInSeconds ?? 900;
		// Forget the attempt once its code can no longer be approved.
		setTimeout(() => { controller.abort(); attempts().delete(handle); }, (expiresIn + 60) * 1000).unref?.();
		return { deviceCode: handle, userCode: info.userCode, verificationUrl: url.href, expiresIn, interval: Math.max(info.intervalSeconds ?? 5, 1) };
	}

	async poll(handle: string): Promise<PollResult> {
		const attempt = attempts().get(handle);
		if (!attempt) throw new AppError("expired_code", "Your sign-in code expired. Start again.", 502);
		if (!attempt.done) return { kind: "pending" };
		attempts().delete(handle);
		if (!attempt.grant) throw signInError(attempt.error);
		return { kind: "complete", grant: attempt.grant };
	}

	async refresh(refreshToken: string): Promise<Grant> {
		try {
			return toGrant(await oauth().refresh({ type: "oauth", refresh: refreshToken, access: "", expires: 0 }, AbortSignal.timeout(15_000)));
		} catch {
			throw new AppError("invalid_grant", "Your Grok authorization expired or was revoked. Reconnect.", 502);
		}
	}

	async account(accessToken: string) {
		try {
			return await this.http.account(accessToken);
		} catch (error) {
			const fromToken = claims(accessToken);
			if (fromToken) return fromToken;
			throw error;
		}
	}

	models(accessToken: string) {
		return this.http.models(accessToken);
	}

	/** pi's login has no revoke call; disconnecting removes the local credential. */
	async revoke() {
		return false;
	}
}
