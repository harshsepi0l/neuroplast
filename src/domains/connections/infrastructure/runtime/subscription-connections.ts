import { chatGPTBackgroundAllowed, chatGPTConnected, chatGPTScopeCurrent, onChatGPTChange } from "@/domains/connections/infrastructure/runtime/chatgpt-bridge";
import { nativeSubscriptionId, nativeSubscriptionConnected, nativeSubscriptionBackgroundAllowed, nativeAdmissionCurrent, onNativeSubscriptionChange } from "@/domains/connections/infrastructure/runtime/subscription-bridge";
import type { AdmissionScope } from "@/domains/connections/infrastructure/runtime/subscription-request-cycle";

export function isSubscriptionProvider(provider: string | undefined): boolean { return provider === "chatgpt" || !!(provider && nativeSubscriptionId(provider)); }
export function subscriptionConnected(provider: string): boolean {
	if (provider === "chatgpt") return chatGPTConnected();
	const native = nativeSubscriptionId(provider); return !!native && nativeSubscriptionConnected(native);
}
/** Ordinary API connections have no subscription background-consent gate. */
export function connectionBackgroundAllowed(provider: string | undefined): boolean {
	if (provider === "chatgpt") return chatGPTBackgroundAllowed();
	const native = provider ? nativeSubscriptionId(provider) : undefined;
	return native ? nativeSubscriptionBackgroundAllowed(native) : true;
}
export function connectionScopeCurrent(provider: string, scope: AdmissionScope): boolean {
	if (provider === "chatgpt") return chatGPTScopeCurrent(scope);
	const native = nativeSubscriptionId(provider); return !!native && nativeAdmissionCurrent(native, scope);
}
export function onSubscriptionChange(listener: () => void): () => void {
	const stopChatGPT = onChatGPTChange(listener), stopNative = onNativeSubscriptionChange(listener);
	return () => { stopChatGPT(); stopNative(); };
}
