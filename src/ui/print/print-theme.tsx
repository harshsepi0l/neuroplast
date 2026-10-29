"use client";
import { useEffect } from "react";

/** Prints in the light theme: dark mode is switched off for the print and
 *  restored afterwards, whichever way printing started (button or ⌘P). */
export function PrintTheme() {
	useEffect(() => {
		const root = document.documentElement;
		let wasDark = false;
		const before = () => {
			wasDark = root.classList.contains("dark");
			if (wasDark) root.classList.remove("dark");
		};
		const after = () => {
			if (wasDark) root.classList.add("dark");
			wasDark = false;
		};
		window.addEventListener("beforeprint", before);
		window.addEventListener("afterprint", after);
		return () => {
			window.removeEventListener("beforeprint", before);
			window.removeEventListener("afterprint", after);
		};
	}, []);
	return null;
}
