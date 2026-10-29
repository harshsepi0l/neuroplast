/** A file the learner attached to a message: saved to the study-materials
 *  folder, referenced by path in the message the tutor reads. */
export interface Attachment {
	name: string;
	kind: "pdf" | "text";
	/** Absolute path inside the materials folder. */
	path: string;
}

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_TEXT_BYTES = 2 * 1024 * 1024;
export const ATTACH_ACCEPT = ".pdf,.txt,.md,.markdown";

/** Which kind a filename is, or null when it can't be attached. */
export function attachmentKind(name: string): Attachment["kind"] | null {
	const lower = name.toLowerCase();
	if (lower.endsWith(".pdf")) return "pdf";
	if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".markdown")) return "text";
	return null;
}

/** The line appended to the message so the tutor knows where the file is. */
export function attachmentLine(file: Attachment): string {
	return file.kind === "pdf"
		? `[Attached PDF: ${file.name} — path: ${file.path} — read it with the pdf tool.]`
		: `[Attached file: ${file.name} — path: ${file.path} — read it with the read tool.]`;
}

/** The message as sent: the learner's words, then one line per attachment. */
export function withAttachments(text: string, files: readonly Attachment[]): string {
	return [text.trim(), ...files.map(attachmentLine)].filter(Boolean).join("\n\n");
}

/** Strip the attachment lines back out for display, returning the files. */
export function splitAttachments(text: string): { text: string; files: { name: string; kind: Attachment["kind"] }[] } {
	const files: { name: string; kind: Attachment["kind"] }[] = [];
	const rest = text.replace(/\n*\[Attached (PDF|file): (.+?) — path: .+? — read it with the (?:pdf|read) tool\.\]/g, (_m, kind: string, name: string) => {
		files.push({ name, kind: kind === "PDF" ? "pdf" : "text" });
		return "";
	});
	return { text: rest.trim(), files };
}
