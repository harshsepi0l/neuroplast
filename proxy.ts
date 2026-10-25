import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "@/platform/server/request-origin";

/** The current file-backed learning domains share one private workspace. */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const api = pathname.startsWith("/api/");
  const workspace = api || ["/", "/learn", "/practice", "/knowledge", "/sessions", "/connections", "/settings"].includes(pathname) || pathname.startsWith("/chat/") || pathname.startsWith("/challenge/") || pathname.startsWith("/challenges/") || pathname.startsWith("/knowledge/");
  if (!workspace) return NextResponse.next();
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
export const config = { matcher: ["/api/:path*", "/", "/learn", "/practice", "/knowledge", "/knowledge/:path*", "/sessions", "/connections", "/chat/:path*", "/challenge/:path*", "/challenges/:path*", "/settings"] };
