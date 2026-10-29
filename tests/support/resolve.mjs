import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../../src/", import.meta.url);
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function withExtension(url) {
	if (existsSync(fileURLToPath(url))) return null;
	for (const ext of EXTENSIONS) {
		const candidate = new URL(url.href + ext);
		if (existsSync(fileURLToPath(candidate))) return candidate.href;
	}
	return null;
}

export async function resolve(specifier, context, next) {
	if (specifier.startsWith("@/")) {
		const url = new URL(specifier.slice(2), SRC);
		return { url: withExtension(url) ?? url.href, shortCircuit: true };
	}
	if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
		const resolved = withExtension(new URL(specifier, context.parentURL));
		if (resolved) return { url: resolved, shortCircuit: true };
	}
	return next(specifier, context);
}
