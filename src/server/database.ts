import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export const dataDirectory = () => path.resolve(process.env.NEUROPLAST_DATA_DIR || ".neuroplast");
const processState = globalThis as typeof globalThis & { neuroplastDatabase?: DatabaseSync };
export function database() {
  if (processState.neuroplastDatabase) return processState.neuroplastDatabase;
  const directory = dataDirectory();
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(directory, "neuroplast.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS browser_sessions (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS connections (owner_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, record TEXT NOT NULL);`);
  processState.neuroplastDatabase = db;
  return db;
}
