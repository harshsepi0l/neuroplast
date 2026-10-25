/* A draft-to-session handoff within this tab. Notes never travel in the URL. */
const pending = new Map<string, string>();
const key = (chatId: string) => `neuroplast:opening-message:${chatId}`;
export function stageOpeningMessage(chatId: string, text: string) {
  pending.set(chatId, text);
  try { sessionStorage.setItem(key(chatId), text); } catch { /* in-memory handoff remains available */ }
}
export function openingMessage(chatId: string): string | undefined {
  if (pending.has(chatId)) return pending.get(chatId);
  try { return sessionStorage.getItem(key(chatId)) || undefined; } catch { return undefined; }
}
export function clearOpeningMessage(chatId: string) {
  pending.delete(chatId);
  try { sessionStorage.removeItem(key(chatId)); } catch { /* storage may be unavailable */ }
}
