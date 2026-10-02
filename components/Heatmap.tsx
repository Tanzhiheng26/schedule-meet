"use client";

import { useState, type CSSProperties } from "react";
import { dayLabel, type BySlot, type Grid } from "@/lib/slots";
import { SlotGrid } from "./SlotGrid";

/** Group availability. Pass `names` to show who is free (host view only). Tap or click a cell for details. */
export function Heatmap({
  grid,
  bySlot,
  total,
  names,
}: {
  grid: Grid;
  bySlot: BySlot;
  total: number;
  names?: Record<string, string>;
}) {
  const [picked, setPicked] = useState<string | null>(null);

  const describe = (iso: string) => {
    const di = grid.slots.findIndex((col) => col.includes(iso));
    if (di === -1) return null;
    const { weekday, day } = dayLabel(grid.dates[di]);
    const ids = bySlot[iso] ?? [];
    const who = names && ids.length ? `: ${ids.map((id) => names[id]).join(", ")}` : "";
    return `${weekday} ${day}, ${grid.times[grid.slots[di].indexOf(iso)]}: ${ids.length}/${total} free${who}`;
  };

  return (
    <div>
      <SlotGrid
        grid={grid}
        renderCell={(iso) => {
          const ids = bySlot[iso] ?? [];
          const pct = total ? Math.round((ids.length / total) * 100) : 0;
          return (
            <div
              className="cell heat"
              data-all={(total > 0 && ids.length === total) || undefined}
              data-picked={iso === picked || undefined}
              style={{ "--pct": `${pct}%` } as CSSProperties}
              title={describe(iso) ?? undefined}
              onClick={() => setPicked(iso === picked ? null : iso)}
            />
          );
        }}
      />
      <p className="muted heat-detail" aria-live="polite">
        {(picked && describe(picked)) ||
          `Tap or click a time to see ${names ? "who's" : "how many people are"} free.`}
      </p>
      <div className="legend">
        <span>0/{total}</span>
        <span className="legend-bar" />
        <span>
          {total}/{total} available
        </span>
      </div>
    </div>
  );
}
