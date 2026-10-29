import assert from "node:assert/strict";
import test from "node:test";
import { toolActivityLabel, toolDoneLabel } from "@/features/learning/core/pending";

test("background steps read as plain words, not tool names", () => {
  assert.equal(toolDoneLabel("list_sessions"), "Looked over your past sessions");
  assert.equal(toolDoneLabel("list_propositions"), "Checked what you learned before");
  assert.equal(toolDoneLabel("grep"), "Searched your files");
  assert.equal(toolDoneLabel("some_new_tool"), "some new tool");
  assert.equal(toolActivityLabel("list_sessions"), "Looking over your past sessions…");
  assert.equal(toolActivityLabel("quiz"), "Writing a question…");
});
