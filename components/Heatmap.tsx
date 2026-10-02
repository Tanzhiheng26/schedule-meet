import type { CSSProperties } from "react";
import type { BySlot, Grid } from "@/lib/slots";
import { SlotGrid } from "./SlotGrid";

/** Group availability. Pass `names` to show who is free on hover (host view only). */
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
  return (
    <div>
      <SlotGrid
        grid={grid}
        renderCell={(iso) => {
          const ids = bySlot[iso] ?? [];
          const pct = total ? Math.round((ids.length / total) * 100) : 0;
          const who = names && ids.length ? `: ${ids.map((id) => names[id]).join(", ")}` : "";
          return (
            <div
              className="cell heat"
              data-all={(total > 0 && ids.length === total) || undefined}
              style={{ "--pct": `${pct}%` } as CSSProperties}
              title={`${ids.length}/${total} available${who}`}
            />
          );
        }}
      />
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
