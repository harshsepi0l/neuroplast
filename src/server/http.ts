import "server-only";
import { AppError } from "@/lib/errors";
import { requestOrigin } from "./request-origin";

export function requireSameOrigin(request: Request) {
  const origin = requestOrigin(request);
  if (request.headers.get("origin") !== origin || request.headers.get("x-neuroplast-client") !== "web") throw new AppError("forbidden", "This action must start from Neuroplast.", 403);
}
export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AppError("invalid_content", "Expected a JSON request.", 415);
  if (Number(request.headers.get("content-length") || 0) > 180_000) throw new AppError("too_large", "The request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("invalid_json", "The request is empty.");
  let bytes = 0; const decoder = new TextDecoder(); let text = "";
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength;
      if (bytes > 180_000) { await reader.cancel(); throw new AppError("too_large", "The request is too large.", 413); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError("invalid_json", "The request could not be read."); }
}
export function errorResponse(error: unknown) {
  const known = error instanceof AppError;
  return Response.json({ error: known ? error.message : "The request could not be completed. Please retry.", code: known ? error.code : "unexpected" }, { status: known ? error.status : 500, headers: { "Cache-Control": "no-store" } });
}
