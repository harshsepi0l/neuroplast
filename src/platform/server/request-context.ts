import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { browserOwner } from "@/domains/identity/infrastructure/browser-session";
import { services } from "./container";

const state = globalThis as typeof globalThis & { neuroplastRequestOwner?: AsyncLocalStorage<string> };
const ownerContext = state.neuroplastRequestOwner ??= new AsyncLocalStorage<string>();
export async function withRequestOwner<T>(operation: () => Promise<T> | T): Promise<T> {
  return ownerContext.run(await browserOwner(), operation);
}
export function runWithRequestOwner<T>(ownerId: string, operation: () => T): T { return ownerContext.run(ownerId, operation); }
export function activeGrokOwner() { return ownerContext.getStore(); }
export function workspaceGrokConnected() {
  const owner = activeGrokOwner();
  return Boolean(owner && services().connections.status(owner).phase === "connected");
}
export async function workspaceGrokToken(background = false) {
  const owner = activeGrokOwner();
  if (!owner) return undefined;
  const status = services().connections.status(owner);
  if (status.phase !== "connected") return undefined;
  if (background && !status.allowBackgroundUse) throw new Error("Grok background use is disabled. Enable it in Connections or choose another configured model for this task.");
  return (await services().connections.authorize(owner)).accessToken;
}
