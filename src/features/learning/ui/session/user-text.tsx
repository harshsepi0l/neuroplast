import { FileTextIcon } from "lucide-react";
import { splitAttachments } from "@/features/learning/core/attachments";

/** A learner message: their words, then any attached files by name (the
 *  path lines the tutor reads stay out of sight). */
export function UserText({ text }: { text: string }) {
	const { text: words, files } = splitAttachments(text);
	return (
		<>
			{words && <div className="neuroplast-prose whitespace-pre-wrap text-foreground">{words}</div>}
			{files.length > 0 && (
				<div className="mt-1.5 flex flex-wrap gap-2">
					{files.map((file, i) => (
						<span key={`${file.name}-${i}`} data-testid="sent-attachment" className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-0.5 text-foreground">
							<FileTextIcon className="size-3.5 text-muted-foreground" />
							{file.name}
						</span>
					))}
				</div>
			)}
		</>
	);
}
