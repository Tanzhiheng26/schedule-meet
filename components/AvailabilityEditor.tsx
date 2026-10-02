"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  // Dragging paints the rectangle between the first cell and the current one, all set to the
  // state the first cell flipped to. Filling the rectangle means fast swipes can't skip cells.
  const drag = useRef<{ on: boolean; anchor: [number, number]; base: Set<string> } | null>(null);
  const position = useMemo(() => {
    const m = new Map<string, [number, number]>();
    grid.slots.forEach((col, di) => col.forEach((iso, ti) => m.set(iso, [di, ti])));
    return m;
  }, [grid]);

  useEffect(() => {
    const stop = () => (drag.current = null);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const paintTo = (iso: string) => {
    const d = drag.current;
    const p = position.get(iso);
    if (!d || !p) return;
    const next = new Set(d.base);
    for (let di = Math.min(d.anchor[0], p[0]); di <= Math.max(d.anchor[0], p[0]); di++) {
      for (let ti = Math.min(d.anchor[1], p[1]); ti <= Math.max(d.anchor[1], p[1]); ti++) {
        if (d.on) next.add(grid.slots[di][ti]);
        else next.delete(grid.slots[di][ti]);
      }
    }
    setSelected(next);
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
          const anchor = iso && position.get(iso);
          if (!iso || !anchor) return;
          e.preventDefault();
          drag.current = { on: !selected.has(iso), anchor, base: selected };
          paintTo(iso);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const iso = slotAt(e.clientX, e.clientY);
          if (iso) paintTo(iso);
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
