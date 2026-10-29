import assert from "node:assert/strict";
import test from "node:test";
import {
  IS_MAC,
  KEYBOARD_ACTIONS,
  actionForBinding,
  bindingForAction,
  effectiveKeymap,
  eventBinding,
  formatBinding,
} from "@/features/settings/core/keyboard";

const key = (k, mods = {}) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods });

test("key events map to canonical binding strings", () => {
  assert.equal(eventBinding(key("?", { shiftKey: true })), "?");
  assert.equal(eventBinding(key("F", { metaKey: true, shiftKey: true })), "mod+shift+f");
  assert.equal(eventBinding(key("d", { ctrlKey: true })), "mod+d");
  assert.equal(eventBinding(key("Tab", { shiftKey: true })), "shift+tab");
  assert.equal(eventBinding(key("ArrowUp", { altKey: true })), "alt+arrowup");
});

test("every dispatched default binding is unique", () => {
  const dispatched = KEYBOARD_ACTIONS.filter((a) => !a.displayOnly && a.binding);
  const seen = new Map();
  for (const action of dispatched) {
    assert.ok(!seen.has(action.binding), `"${action.binding}" is bound to both ${seen.get(action.binding)} and ${action.id}`);
    seen.set(action.binding, action.id);
  }
  assert.equal(effectiveKeymap().size, dispatched.length);
});

test("bindings and actions round-trip through the default keymap", () => {
  assert.equal(actionForBinding("mod+d"), "toggle-dictation");
  assert.equal(bindingForAction("toggle-dictation"), "mod+d");
  assert.equal(actionForBinding("mod+shift+z"), undefined);
});

test("bindings format with platform glyphs", () => {
  assert.equal(formatBinding("mod+shift+f"), IS_MAC ? "⌘⇧F" : "Ctrl+Shift+F");
  assert.equal(formatBinding("shift+tab"), IS_MAC ? "⇧⇥" : "Shift+⇥");
  assert.equal(formatBinding("?"), "?");
});
