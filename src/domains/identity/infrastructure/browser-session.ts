import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { database } from "@/platform/database/database";

export async function browserOwner() {
  const jar = await cookies();
  const production = process.env.NODE_ENV === "production";
  const name = production ? "__Host-neuroplast-session" : "neuroplast-session";
  const token = jar.get(name)?.value;
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const ownerId = hash(token);
    const session = database().prepare("SELECT expires_at FROM browser_sessions WHERE id = ?").get(ownerId) as { expires_at: number } | undefined;
    if (session && session.expires_at > Date.now()) return ownerId;
  }
  const fresh = randomBytes(32).toString("base64url");
  const ownerId = hash(fresh);
  const maxAge = 60 * 60 * 24 * 30;
  database().prepare("INSERT INTO browser_sessions(id, expires_at) VALUES (?, ?)").run(ownerId, Date.now() + maxAge * 1000);
  jar.set(name, fresh, { httpOnly: true, secure: production, sameSite: "lax", path: "/", maxAge });
  return ownerId;
}
