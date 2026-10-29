import assert from "node:assert/strict";
import test from "node:test";
import { isBackgroundTool, toolActivityLabel } from "@/features/learning/core/pending";

test("the tutor's legwork is background; lesson tools are not", () => {
  for (const tool of ["read", "ls", "find", "grep", "list_sessions", "list_propositions"]) assert.equal(isBackgroundTool(tool), true, tool);
  for (const tool of ["quiz", "research", "plan_init", "problem"]) assert.equal(isBackgroundTool(tool), false, tool);
  assert.equal(toolActivityLabel("quiz"), "Writing a question…");
});
