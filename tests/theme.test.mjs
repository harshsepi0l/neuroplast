import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeMode, isDark, toggleMode, THEME_STORAGE_KEY } from "../src/domains/preferences/domain/theme.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Pull the body of a top-level CSS block (`selector { ... }`). */
function cssBlock(css, selector) {
	const start = css.indexOf(`${selector} {`);
	if (start === -1) return null;
	const open = css.indexOf("{", start);
	let depth = 0;
	for (let i = open; i < css.length; i++) {
		if (css[i] === "{") depth += 1;
		else if (css[i] === "}") {
			depth -= 1;
			if (depth === 0) return css.slice(open + 1, i);
		}
	}
	return null;
}

/** Read a single `--name: value;` from a CSS block body. */
function token(block, name) {
	const match = block?.match(new RegExp(`--${name}:\\s*([^;]+);`));
	return match ? match[1].trim() : null;
}

const themeCss = () => readFileSync(join(root, "src/shared/ui/theme.css"), "utf8");

test("mode helpers normalize, default to dark, and toggle", () => {
	assert.equal(THEME_STORAGE_KEY, "neuroplast:mode");
	assert.equal(normalizeMode("dark"), "dark");
	assert.equal(normalizeMode("light"), "light");
	assert.equal(normalizeMode("banana"), null);
	assert.equal(normalizeMode(undefined), null);
	// Unset or invalid falls back to dark — the factory default.
	assert.equal(isDark("dark"), true);
	assert.equal(isDark("light"), false);
	assert.equal(isDark(undefined), true);
	assert.equal(isDark("banana"), true);
	assert.equal(toggleMode("dark"), "light");
	assert.equal(toggleMode("light"), "dark");
});

test("theme.css defines the yellow light (white) and dark (black) palettes", () => {
	const css = themeCss();
	const light = cssBlock(css, ":root");
	const dark = cssBlock(css, ".dark");
	assert.ok(light, ":root block present");
	assert.ok(dark, ".dark block present");

	// The one bold yellow accent, identical in both modes.
	assert.equal(token(light, "brand"), "#ffd43b");
	assert.equal(token(dark, "brand"), "#ffd43b");
	assert.equal(token(light, "primary"), "var(--brand)");
	assert.equal(token(dark, "primary"), "var(--brand)");

	// Light = white canvas; dark = near-black canvas.
	assert.equal(token(light, "bg"), "#ffffff");
	assert.equal(token(dark, "bg"), "#0b0b08");
	assert.equal(token(light, "background"), "var(--bg)");
	assert.equal(token(dark, "background"), "var(--bg)");

	// Dark ink on the yellow primary in both modes.
	assert.equal(token(light, "primary-foreground"), "#1e1e1e");
	assert.equal(token(dark, "primary-foreground"), "#171300");

	// The UI/prose face is Cascadia Mono in both modes.
	assert.match(token(light, "font-sans3"), /Cascadia Mono/);
	assert.match(token(dark, "font-sans3"), /Cascadia Mono/);

	// Semantic status inks exist with mode-aware variants.
	for (const name of ["success", "warning", "danger"]) {
		assert.ok(token(light, name), `--${name} in :root`);
		assert.ok(token(dark, name), `--${name} in .dark`);
		assert.notEqual(token(light, name), token(dark, name), `--${name} differs by mode`);
	}
});

test("the purple premium palette is gone from the skin", () => {
	const purple = [
		"#b9adfa", "#65548e", "#aca2c2", "#c0bacc", "#c8c3d6", "#d7c9f6",
		"#e5dcff", "#cbbcf0", "#d6c7ec", "#c9b9ef", "#c8b0f4", "#c3b2dd",
		"#bdb3da", "#aea6ba", "#9c95a8", "#9785b8", "#8d79b8", "#776b90",
		"#726482", "#736096", "#6e5b9c", "#645477", "#554b65",
	];
	const globals = readFileSync(join(root, "app/globals.css"), "utf8").toLowerCase();
	const theme = themeCss().toLowerCase();
	for (const hex of purple) {
		assert.equal(globals.includes(hex), false, `globals.css still contains ${hex}`);
		assert.equal(theme.includes(hex), false, `theme.css still contains ${hex}`);
	}
});

test("the Cascadia Mono face is bundled and referenced", () => {
	const theme = themeCss();
	assert.match(theme, /@font-face/);
	assert.match(theme, /font-family:\s*"Cascadia Mono"/);
	assert.match(theme, /\/fonts\/CascadiaMono-Regular\.ttf/);
	assert.match(theme, /\/fonts\/CascadiaMono-Bold\.ttf/);
	assert.ok(readFileSync(join(root, "public/fonts/CascadiaMono-Regular.ttf")).length > 1000, "CascadiaMono-Regular.ttf is a real font file");
	assert.ok(readFileSync(join(root, "public/fonts/CascadiaMono-Bold.ttf")).length > 1000, "CascadiaMono-Bold.ttf is a real font file");
});
