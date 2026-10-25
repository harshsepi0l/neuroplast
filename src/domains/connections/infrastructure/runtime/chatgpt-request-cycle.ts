/** Compatibility surface: ChatGPT keeps its scope/behavior while all subscription
 * connections share the same provider-neutral request-admission state machine. */
export { SubscriptionRequestCycle as ChatGPTRequestCycle } from "@/domains/connections/infrastructure/runtime/subscription-request-cycle";
export type { AdmissionScope, NoDispatchKind, SubscriptionDispatchLifecycle as ChatGPTDispatchLifecycle } from "@/domains/connections/infrastructure/runtime/subscription-request-cycle";
