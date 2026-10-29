"use client";

import { useRef, useState } from "react";
import { FileTextIcon, Loader2Icon, PaperclipIcon, XIcon } from "lucide-react";
import { ATTACH_ACCEPT, attachmentKind, type Attachment } from "@/features/learning/core/attachments";

async function upload(file: File): Promise<Attachment> {
	const form = new FormData();
	form.append("file", file);
	const response = await fetch("/api/materials", { method: "POST", headers: { "x-neuroplast-client": "web" }, body: form });
	const body = (await response.json().catch(() => ({}))) as Partial<Attachment> & { error?: string };
	if (!response.ok || !body.path) throw new Error(body.error || "The file could not be attached.");
	return body as Attachment;
}

/** Files attached to the message being written: uploaded as soon as they
 *  are picked, so sending only adds their paths. */
export function useAttachments() {
	const [files, setFiles] = useState<Attachment[]>([]);
	const [uploading, setUploading] = useState(0);
	const [error, setError] = useState("");
	async function add(picked: FileList | null) {
		for (const file of Array.from(picked ?? [])) {
			if (!attachmentKind(file.name)) {
				setError("Attach a PDF, text or Markdown file.");
				continue;
			}
			setUploading((n) => n + 1);
			setError("");
			try {
				const saved = await upload(file);
				setFiles((current) => [...current, saved]);
			} catch (failure) {
				setError((failure as Error).message);
			} finally {
				setUploading((n) => n - 1);
			}
		}
	}
	return {
		files,
		uploading: uploading > 0,
		error,
		add,
		remove: (path: string) => setFiles((current) => current.filter((f) => f.path !== path)),
		clear: () => { setFiles([]); setError(""); },
		restore: (previous: Attachment[]) => setFiles(previous),
	};
}

export type Attachments = ReturnType<typeof useAttachments>;

export function AttachButton({ attachments, disabled, className, label }: { attachments: Attachments; disabled?: boolean; className?: string; label?: string }) {
	const picker = useRef<HTMLInputElement>(null);
	return (
		<>
			<button
				type="button"
				aria-label="Attach a file"
				title="Attach a PDF, text or Markdown file"
				disabled={disabled || attachments.uploading}
				onClick={() => picker.current?.click()}
				className={className ?? "grid size-10 shrink-0 place-items-center rounded-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"}
			>
				{attachments.uploading ? <Loader2Icon className="size-4 animate-spin" /> : <PaperclipIcon className="size-4" />}
				{label}
			</button>
			<input
				ref={picker}
				type="file"
				multiple
				className="sr-only"
				tabIndex={-1}
				accept={ATTACH_ACCEPT}
				onChange={(event) => {
					const picked = event.target.files;
					void attachments.add(picked).finally(() => { event.target.value = ""; });
				}}
			/>
		</>
	);
}

/** The picked files above the text box, each removable, plus any error. */
export function AttachmentChips({ attachments }: { attachments: Attachments }) {
	if (attachments.files.length === 0 && !attachments.error) return null;
	return (
		<div className="flex flex-wrap items-center gap-2 px-2 pt-2">
			{attachments.files.map((file) => (
				<span key={file.path} data-testid="attachment-chip" className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-xs">
					<FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
					<span className="truncate">{file.name}</span>
					<button type="button" aria-label={`Remove ${file.name}`} onClick={() => attachments.remove(file.path)} className="text-muted-foreground hover:text-foreground">
						<XIcon className="size-3.5" />
					</button>
				</span>
			))}
			{attachments.error && <span role="alert" className="text-xs text-[var(--danger)]">{attachments.error}</span>}
		</div>
	);
}
