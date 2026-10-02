"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Grid } from "@/lib/slots";
import { SlotGrid } from "./SlotGrid";

type Status = "idle" | "saved" | "error";

export function AvailabilityEditor({
  grid,
  initial,
  save,
}: {
  grid: Grid;
  initial: string[];
  save: (slots: string[]) => Promise<void>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(initial));
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [pending, startTransition] = useTransition();
  // While dragging, every cell touched is set to the state the first cell flipped to.
  const drag = useRef<{ on: boolean } | null>(null);

  useEffect(() => {
    const stop = () => (drag.current = null);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const apply = (iso: string, on: boolean) => {
    setSelected((prev) => {
      if (prev.has(iso) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(iso);
      else next.delete(iso);
      return next;
    });
    setDirty(true);
    setStatus("idle");
  };

  // elementFromPoint works for touch too, where pointer events stay on the first cell.
  const slotAt = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest("[data-slot]")?.getAttribute("data-slot") ?? null;

  const setAll = (on: boolean) => {
    setSelected(on ? new Set(grid.slots.flat()) : new Set());
    setDirty(true);
    setStatus("idle");
  };

  const onSave = () =>
    startTransition(async () => {
      try {
        await save([...selected]);
        setDirty(false);
        setStatus("saved");
        router.refresh();
      } catch {
        setStatus("error");
      }
    });

  return (
    <div>
      <div
        className="editor"
        onPointerDown={(e) => {
          const iso = slotAt(e.clientX, e.clientY);
          if (!iso) return;
          e.preventDefault();
          drag.current = { on: !selected.has(iso) };
          apply(iso, drag.current.on);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const iso = slotAt(e.clientX, e.clientY);
          if (iso) apply(iso, drag.current.on);
        }}
      >
        <SlotGrid
          grid={grid}
          renderCell={(iso) => <div className="cell" data-slot={iso} data-on={selected.has(iso) || undefined} />}
        />
      </div>
      <div className="row gap wrap mt">
        <button className="primary" onClick={onSave} disabled={pending}>
          {pending ? "Saving…" : "Save availability"}
        </button>
        <button onClick={() => setAll(true)} disabled={pending}>
          Select all
        </button>
        <button onClick={() => setAll(false)} disabled={pending}>
          Clear
        </button>
        <span className="muted" role="status">
          {status === "saved" && "Saved ✓ You can come back and change it any time."}
          {status === "error" && "Couldn't save. Please try again."}
          {status === "idle" && dirty && "You have unsaved changes."}
        </span>
      </div>
    </div>
  );
}
