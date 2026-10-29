import assert from "node:assert/strict";
import test from "node:test";
import { transformMathDelimiters } from "@/lib/math-delims";
import { plainLine } from "@/features/learning/core/answer-summary";

test("money is a literal dollar, not the start of a formula", () => {
  assert.equal(
    transformMathDelimiters("A game pays $10 if a fair coin lands heads and $0 if it lands tails."),
    "A game pays \\$10 if a fair coin lands heads and \\$0 if it lands tails.",
  );
  assert.equal(transformMathDelimiters("It costs $3.50."), "It costs \\$3.50.");
  assert.equal(transformMathDelimiters("Raised $2M, then $5k."), "Raised \\$2M, then \\$5k.");
});

test("inline math still renders, next to money too", () => {
  assert.equal(transformMathDelimiters("Let $x$ be fixed."), "Let $x$ be fixed.");
  assert.equal(transformMathDelimiters("$5$ and $2x$"), "$5$ and $2x$");
  assert.equal(transformMathDelimiters("Pay $5 when $p = 0.5$ holds"), "Pay \\$5 when $p = 0.5$ holds");
  assert.equal(transformMathDelimiters("$E[X] = 0.5 \\cdot 10$ dollars"), "$E[X] = 0.5 \\cdot 10$ dollars");
  assert.equal(transformMathDelimiters("Already escaped \\$10"), "Already escaped \\$10");
});

test("a lone or spaced dollar is literal", () => {
  assert.equal(transformMathDelimiters("a $ b $ c"), "a \\$ b \\$ c");
  assert.equal(transformMathDelimiters("$x\n\nnext $"), "\\$x\n\nnext \\$");
});

test("display math and code are untouched", () => {
  assert.equal(transformMathDelimiters("$$\nx^2\n$$"), "$$\nx^2\n$$");
  assert.equal(transformMathDelimiters("`echo $10`"), "`echo $10`");
  assert.equal(transformMathDelimiters("```\ncost = $10\n```"), "```\ncost = $10\n```");
});

test("one-line rows keep the dollar sign on money", () => {
  assert.equal(plainLine("A game pays $10 if heads and \\$0 if tails"), "A game pays $10 if heads and $0 if tails");
  assert.equal(plainLine("What is $E[X]$?"), "What is E[X]?");
});
