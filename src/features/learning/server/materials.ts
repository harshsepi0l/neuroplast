import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { resolveSourcePath } from "@/features/learning/server/agent/tools/fs-shared";
import { attachmentKind, MAX_PDF_BYTES, MAX_TEXT_BYTES, type Attachment } from "@/features/learning/core/attachments";
import { AppError } from "@/lib/errors";

/** Save a learner's upload into materials/uploads, where the tutor's file
 *  and pdf tools can read it. PDFs must start with the %PDF header. */
export async function saveMaterial(file: File): Promise<Attachment> {
	const kind = attachmentKind(file.name);
	if (!kind) throw new AppError("unsupported_file", "Attach a PDF, text or Markdown file.", 415);
	const limit = kind === "pdf" ? MAX_PDF_BYTES : MAX_TEXT_BYTES;
	if (file.size === 0) throw new AppError("empty_file", "That file is empty.", 400);
	if (file.size > limit) throw new AppError("too_large", kind === "pdf" ? "Choose a PDF under 25 MB." : "Choose a text file under 2 MB.", 413);
	const bytes = Buffer.from(await file.arrayBuffer());
	if (kind === "pdf" && bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new AppError("invalid_pdf", "That file is not a readable PDF.", 415);
	const directory = resolveSourcePath("uploads");
	fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
	const extension = path.extname(file.name).toLowerCase();
	const stem = path.basename(file.name, path.extname(file.name)).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file";
	const target = path.join(directory, `${stem}-${randomBytes(3).toString("hex")}${extension}`);
	fs.writeFileSync(target, bytes, { mode: 0o600 });
	return { name: file.name.slice(0, 120), kind, path: target };
}
