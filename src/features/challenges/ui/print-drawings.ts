"use client";

/** The scratchpad's per-problem browser storage key (scratchpad-canvas.tsx saves under it). */
export function scratchpadKey(challengeId: string, questionId: string): string {
  return `neuroplast:scratchpad:v1:${challengeId}:${questionId}`;
}

/**
 * Fills every `[data-print-drawing]` slot on the page with that problem's
 * saved scratchpad as an SVG, so drawings appear in the printed PDF. Slots
 * without a drawing stay empty. Runs before the print dialog opens.
 */
export async function renderDrawingsForPrint(): Promise<void> {
  const slots = [...document.querySelectorAll<HTMLElement>("[data-print-drawing]")];
  const scenes = slots.map(slot => {
    try {
      const saved = window.localStorage.getItem(slot.dataset.printDrawing ?? "");
      const scene = saved ? JSON.parse(saved) as { elements?: { isDeleted?: boolean }[]; files?: unknown } : null;
      const elements = scene?.elements?.filter(element => !element.isDeleted) ?? [];
      return elements.length ? { elements, files: scene?.files ?? null } : null;
    } catch { return null; }
  });
  if (!scenes.some(Boolean)) return;
  const { exportToSvg } = await import("@excalidraw/excalidraw");
  await Promise.all(slots.map(async (slot, index) => {
    const scene = scenes[index];
    slot.replaceChildren();
    if (!scene) return;
    const svg = await exportToSvg({
      elements: scene.elements as never,
      appState: { exportBackground: false, viewBackgroundColor: "#ffffff" },
      files: scene.files as never,
    });
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Scratchpad drawing");
    slot.append(svg);
  }));
}
