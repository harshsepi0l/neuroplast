import { withRequestOwner } from "@/server/request-context";
import { handleChatRequest } from "@/features/learning/server/chat-handler";

async function handlePOST(req: Request) {
	return handleChatRequest(req);
}

export async function POST(...args: Parameters<typeof handlePOST>) { return withRequestOwner(() => handlePOST(...args)); }
