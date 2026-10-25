import { withRequestOwner } from "@/platform/server/request-context";
import { handleChatRequest } from "@/domains/learning/application/chat-handler";

async function handlePOST(req: Request) {
	return handleChatRequest(req);
}

export async function POST(...args: Parameters<typeof handlePOST>) { return withRequestOwner(() => handlePOST(...args)); }
