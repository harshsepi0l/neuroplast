import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDirectory } from "@/server/database";
import type { SecretVault } from "./service-ports";

function encryptionKey() {
  const configured = process.env.NEUROPLAST_CREDENTIAL_KEY;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32) throw new Error("NEUROPLAST_CREDENTIAL_KEY must contain 32 base64-encoded bytes.");
    return key;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Configure NEUROPLAST_CREDENTIAL_KEY before connecting accounts in production.");
  const directory = dataDirectory();
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, "development.key");
  if (!existsSync(file)) {
    try { writeFileSync(file, randomBytes(32), { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
  const key = readFileSync(file);
  if (key.length !== 32) throw new Error("The development credential key is invalid.");
  return key;
}
export class EncryptedVault implements SecretVault {
  seal(value: string, ownerId: string) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
    cipher.setAAD(Buffer.from(`neuroplast:grok:${ownerId}`));
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
  }
  open(value: string, ownerId: string) {
    const [version, nonce, tag, ciphertext] = value.split(".");
    if (version !== "v1" || !nonce || !tag || !ciphertext) throw new Error("Invalid credential envelope.");
    const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(nonce, "base64url"));
    cipher.setAAD(Buffer.from(`neuroplast:grok:${ownerId}`));
    cipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([cipher.update(Buffer.from(ciphertext, "base64url")), cipher.final()]).toString("utf8");
  }
}
