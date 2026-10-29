import assert from "node:assert/strict";
import test from "node:test";
import {
  activeCompactionOf,
  calculateContextTokens,
  compactionCutIndex,
  estimateMessageTokens,
  estimateTokens,
  keptIndexFor,
  newCompactionMarker,
} from "@/features/learning/core/compaction";

const user = (id, chars) => ({ id, role: "user", content: "u".repeat(chars) });
const assistant = (id, chars) => ({ id, role: "assistant", content: [{ type: "text", text: "a".repeat(chars) }] });
const marker = (firstKeptMessageId) => newCompactionMarker("summary", { firstKeptMessageId, tokensBefore: 0, at: "2026-01-01T00:00:00.000Z" });

/** Eight 100-token messages: u0 a1 u2 a3 u4 a5 u6 a7. */
const conversation = () => Array.from({ length: 8 }, (_, i) => (i % 2 ? assistant : user)(`m${i}`, 400));

test("token estimates are chars/4 over text, thinking and tool calls", () => {
  assert.equal(estimateMessageTokens(user("u", 9)), 3);
  assert.equal(
    estimateMessageTokens({
      id: "a",
      role: "assistant",
      content: [
        { type: "text", text: "abcd" },
        { type: "thinking", thinking: "efgh" },
        { type: "toolCall", name: "quiz", arguments: { q: 1 } },
      ],
    }),
    Math.ceil((4 + 4 + 4 + JSON.stringify({ q: 1 }).length) / 4),
  );
  assert.equal(estimateTokens(conversation()), 800);
});

test("provider usage prefers totalTokens and otherwise sums its parts", () => {
  assert.equal(calculateContextTokens({ totalTokens: 900, input: 1 }), 900);
  assert.equal(calculateContextTokens({ input: 100, output: 20, cacheRead: 5, cacheWrite: 1 }), 126);
});

test("the cut keeps at least the recent-token budget", () => {
  // Walking back from the end, 300 tokens is reached at m5: keep m5 onwards.
  assert.equal(compactionCutIndex(conversation(), 250), 5);
});

test("a budget larger than the conversation drops nothing", () => {
  assert.equal(compactionCutIndex(conversation(), 10_000), 0);
});

test("a new cut never reaches back past the previous compaction", () => {
  const messages = [...conversation(), marker("m4")];
  assert.equal(compactionCutIndex(messages, 10_000), 4);
});

test("the newest marker is the active one; an unknown kept id reads as -1", () => {
  const first = marker("m2");
  const second = marker("m6");
  const messages = [...conversation(), first, second];
  assert.equal(activeCompactionOf(messages), second);
  assert.equal(keptIndexFor(messages, second), 6);
  assert.equal(keptIndexFor(messages, marker("gone")), -1);
  assert.equal(activeCompactionOf(conversation()), null);
});
