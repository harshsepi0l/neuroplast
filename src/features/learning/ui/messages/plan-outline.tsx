"use client";
import Link from "next/link";
import { useMemo } from "react";
import { CheckIcon } from "lucide-react";
import { derivedNodeStatus, derivePlanStatuses } from "@/features/learning/core/plan";
import { latestTree, topoFor, type PopupMessage } from "./plan-block";
import { cn } from "@/lib/utils";

/** This session's skill tree in Knowledge. */
export function knowledgeTreeHref(chatId: string): string {
	return `/knowledge?topic=${encodeURIComponent(`learn:${chatId}`)}`;
}

/**
 * The lesson plan as a numbered outline at the top of the page: visited
 * steps checked, the current one marked, upcoming ones dashed. Statuses
 * derive from the transcript. The full skill tree lives in Knowledge.
 */
export function PlanOutline({ messages, chatId }: { messages: readonly PopupMessage[]; chatId: string }) {
	const tree = useMemo(() => latestTree(messages), [messages]);
	const statuses = useMemo(
		() => (tree ? derivePlanStatuses(tree, messages as Parameters<typeof derivePlanStatuses>[1]) : null),
		[tree, messages],
	);
	const ordered = useMemo(() => (tree ? topoFor(tree.nodes, tree.edges).order : []), [tree]);
	if (!tree || ordered.length === 0) return null;
	return (
		<nav aria-label="Lesson plan" data-testid="plan-outline" className="neuroplast-print-keep rounded-2xl border bg-card px-5 py-4">
			<div className="mb-2 flex items-center justify-between font-ui text-xs font-medium uppercase tracking-wide text-muted-foreground">
				<span>Plan</span>
				<Link
					href={knowledgeTreeHref(chatId)}
					data-testid="plan-tree-link"
					className="neuroplast-print-hide rounded-md border border-border px-2.5 py-1 normal-case tracking-normal text-foreground hover:bg-accent"
				>
					Open the knowledge tree
				</Link>
			</div>
			<ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
				{ordered.map((node, i) => {
					const status = statuses ? derivedNodeStatus(statuses, node.id) : "upcoming";
					return (
						<li key={node.id} className={cn("flex items-center gap-2.5", status === "upcoming" && "text-muted-foreground", status === "current" && "font-semibold")}>
							<span
								aria-hidden
								className={cn(
									"grid size-[18px] shrink-0 place-items-center rounded-full",
									status === "visited" && "bg-foreground text-background",
									status === "current" && "border-[1.5px] border-foreground bg-primary",
									status === "upcoming" && "border-[1.5px] border-dashed border-muted-foreground",
								)}
							>
								{status === "visited" && <CheckIcon className="size-3" />}
							</span>
							<span>
								{i + 1}. {node.title}
								<span className="sr-only"> ({status})</span>
							</span>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
