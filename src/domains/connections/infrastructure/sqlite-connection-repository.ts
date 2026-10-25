import "server-only";
import { database } from "@/platform/database/database";
import type { Connection } from "../domain/connection";
import type { ConnectionRepository } from "../application/ports";

export class SqliteConnectionRepository implements ConnectionRepository {
  find(ownerId: string) {
    const row = database().prepare("SELECT record FROM connections WHERE owner_id = ?").get(ownerId) as { record: string } | undefined;
    return row ? JSON.parse(row.record) as Connection : undefined;
  }
  save(connection: Connection, expectedRevision: number) {
    const result = expectedRevision === 0
      ? database().prepare("INSERT OR IGNORE INTO connections(owner_id, revision, record) VALUES (?, ?, ?)").run(connection.ownerId, connection.revision, JSON.stringify(connection))
      : database().prepare("UPDATE connections SET revision = ?, record = ? WHERE owner_id = ? AND revision = ?").run(connection.revision, JSON.stringify(connection), connection.ownerId, expectedRevision);
    return Number(result.changes) === 1;
  }
}
