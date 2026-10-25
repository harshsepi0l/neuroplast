"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";

type InitialData = ComponentProps<typeof Excalidraw>["initialData"];
type Scene = { elements: unknown; appState: { viewBackgroundColor: string }; files: unknown };

export default function ScratchpadCanvas({ storageKey }: { storageKey: string }) {
  const [saveError, setSaveError] = useState(false);
  const scene = useRef<Scene | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialData = useRef<InitialData>(undefined);

  if (initialData.current === undefined) {
    try {
      const saved = window.localStorage.getItem(storageKey);
      initialData.current = saved ? JSON.parse(saved) as InitialData : null;
    } catch {
      initialData.current = null;
    }
  }

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!scene.current) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(scene.current));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [storageKey]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (scene.current) {
      try { window.localStorage.setItem(storageKey, JSON.stringify(scene.current)); } catch { /* storage may be full or disabled */ }
    }
  }, [storageKey]);

  return <div className="scratchpad-body">
    <div className="scratchpad-canvas"><Excalidraw
      initialData={initialData.current}
      theme="light"
      autoFocus={false}
      handleKeyboardGlobally={false}
      UIOptions={{ tools: { image: false }, canvasActions: { loadScene: false, saveToActiveFile: false } }}
      onChange={(elements, appState, files) => {
        scene.current = { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor }, files };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, 450);
      }}
    /></div>
    <p className={`scratchpad-save-note${saveError ? " error" : ""}`}>{saveError ? "Could not save this drawing. Browser storage may be full or disabled." : "Saved on this device for this problem."}</p>
  </div>;
}
