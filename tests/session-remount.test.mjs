import assert from "node:assert/strict";
import test from "node:test";
import { SessionModel } from "@/features/learning/ui/session/session-core";

const t = Date.parse("2026-10-29T22:03:03Z");
const record = [
	{ id: "u1", role: "user", content: "chemistry", timestamp: t },
	{ id: "a1", role: "assistant", content: [{ type: "text", text: "Nothing on the map yet." }], api: "x", provider: "xai", model: "grok", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: "stop", timestamp: t },
];

/** A server whose POST ack waits until `ack()`; the record and a settled stream answer at once. */
function fakeServer() {
	const calls = [];
	let ack;
	const acked = new Promise((resolve) => { ack = resolve; });
	const fetch = async (url, init) => {
		calls.push(`${init?.method ?? "GET"} ${url}`);
		if (url === "/api/chat") { await acked; return new Response("ok"); }
		if (url.endsWith("/stream")) return new Response('data: {"type":"turn-settled"}\n\ndata: [DONE]\n\n', { headers: { "Content-Type": "text/event-stream" } });
		return Response.json({ messages: record });
	};
	return { fetch, calls, ack: () => ack() };
}

test("a first send survives StrictMode's release-and-remount and shows the turn", async () => {
	const server = fakeServer();
	const model = new SessionModel({ chatId: "c1", initialMessages: [], fetch: server.fetch });
	const sent = model.send({ type: "text", text: "chemistry" });
	model.release(); // StrictMode's simulated unmount…
	model.mount(); // …and the remount, before the ack lands
	server.ack();
	await sent;
	await new Promise((r) => setTimeout(r, 20));
	assert.ok(server.calls.includes("GET /api/chats/c1/stream"), server.calls.join(", "));
	const texts = model.getState().nativeMessages.map((m) => m.role);
	assert.deepEqual(texts, ["user", "assistant"]);
});

test("a page that is really gone does not attach", async () => {
	const server = fakeServer();
	const model = new SessionModel({ chatId: "c1", initialMessages: [], fetch: server.fetch });
	const sent = model.send({ type: "text", text: "chemistry" });
	model.release();
	server.ack();
	await sent;
	assert.ok(!server.calls.some((c) => c.endsWith("/stream")), server.calls.join(", "));
});
