import assert from "node:assert/strict";
import test from "node:test";
import { MAX_TITLE_CHARS, shortTitle, topicTitle } from "@/features/learning/core/titles";

test("a first message becomes a short title", () => {
  assert.equal(shortTitle("Can you teach me bayesian methods, stats and probability? I am not understanding anything in my class."), "Bayesian methods, stats and probability");
  assert.equal(shortTitle("I want to understand how transformers work"), "How transformers work");
  assert.equal(shortTitle("teach me the chain rule"), "Chain rule");
  assert.equal(shortTitle("What is a p-value?"), "P-value");
});

test("titles are capped at a word boundary and never empty", () => {
  const long = shortTitle("Explain the relationship between eigenvalues eigenvectors and principal component analysis in depth");
  assert.ok(long.length <= MAX_TITLE_CHARS, long);
  assert.ok(!long.endsWith(" "));
  assert.equal(shortTitle("   "), "Untitled session");
  assert.equal(shortTitle("hi! teach me\n[Attached PDF: s.pdf — path: /x — read it with the pdf tool.]"), "Untitled session");
});

test("the prober's topic title is cleaned or dropped", () => {
  assert.equal(topicTitle('"Bayesian inference basics."'), "Bayesian inference basics");
  assert.equal(topicTitle("   "), null);
  assert.equal(topicTitle(undefined), null);
});
