"use client";
import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/ui/easyui/Button";

/** Opens the browser's print dialog (where "Save as PDF" lives), after an
 *  optional async step that fills print-only content such as drawings. */
export function PrintButton({ prepare, label = "Print / Save PDF", className }: {
	prepare?: () => Promise<void>;
	label?: string;
	className?: string;
}) {
	const [busy, setBusy] = useState(false);
	async function print() {
		setBusy(true);
		try { await prepare?.(); }
		catch (error) { console.error("print preparation failed:", error); }
		finally { setBusy(false); }
		window.print();
	}
	return <Button variant="secondary" size="sm" className={`neuroplast-print-hide ${className ?? ""}`} isLoading={busy} leftIcon={<Printer size={15}/>} onClick={() => void print()}>{label}</Button>;
}

/** Today's date for printed headers. */
export function printedOn(): string {
	return new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
