/**
 * Theme mode — the light/dark switch (yellow skin wave).
 *
 * Pure helpers only (no React, no DOM): the mode flows through the
 * appearance settings record, while these helpers normalize it for the
 * `<html class="dark">` toggle and the no-flash localStorage cache.
 */

export type ThemeMode = "dark" | "light";

/** localStorage key for the no-flash mode cache (layout's inline script). */
export const THEME_STORAGE_KEY = "neuroplast:mode";

/** Parse an untrusted value (settings record, localStorage, query) into a
 *  valid mode, or null when it is neither. */
export function normalizeMode(value: unknown): ThemeMode | null {
	return value === "dark" || value === "light" ? value : null;
}

/** Whether a mode renders the dark class on `<html>`. Unset or invalid
 *  values fall back to dark — the factory default. */
export function isDark(mode: unknown): boolean {
	return (normalizeMode(mode) ?? "dark") === "dark";
}

/** Flip a mode for a toggle control. */
export function toggleMode(mode: unknown): ThemeMode {
	return isDark(mode) ? "light" : "dark";
}
