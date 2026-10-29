import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "@/server/request-origin";

/** The current file-backed learning domains share one private workspace.
 * Every route is gated unless the matcher below exempts it, so new pages
 * are private by default. */
export async function proxy(request: NextRequest) {
  const api = request.nextUrl.pathname.startsWith("/api/");
  const origin = requestOrigin(request);
  if (api && !["GET", "HEAD", "OPTIONS"].includes(request.method) && request.headers.get("origin") !== origin) return NextResponse.json({ error: "Workspace actions must start from this site." }, { status: 403 });
  if (process.env.NODE_ENV !== "production" && ["127.0.0.1", "localhost", "[::1]"].includes(request.nextUrl.hostname)) return NextResponse.next();
  const password = process.env.NEUROPLAST_WORKSPACE_PASSWORD;
  if (!password) return NextResponse.json({ error: "Configure NEUROPLAST_WORKSPACE_PASSWORD before exposing the private learning workspace." }, { status: 503 });
  let supplied = "";
  try { const header = request.headers.get("authorization") || ""; if (header.startsWith("Basic ")) supplied = atob(header.slice(6)).split(":").slice(1).join(":"); } catch { /* prompt again */ }
  const digest = (value: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [expected, actual] = await Promise.all([digest(password), digest(supplied)]);
  const a = new Uint8Array(expected), b = new Uint8Array(actual); let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  if (difference) return new NextResponse("Sign in to your private Neuroplast workspace.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="neuroplast", charset="UTF-8"', "Cache-Control": "no-store" } });
  return NextResponse.next();
}
// Public exceptions: build output and the static files under public/.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon\\.ico|fonts/|worklets/|siwc/|neuroplast\\.svg).*)"] };
