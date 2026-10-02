import { Fragment, type ReactNode } from "react";
import { dayLabel, type Grid } from "@/lib/slots";

/** Shared day-by-time layout used by both the editable grid and the heatmap. */
export function SlotGrid({ grid, renderCell }: { grid: Grid; renderCell: (iso: string) => ReactNode }) {
  return (
    <div className="grid-scroll">
      <div
        className="slot-grid"
        style={{ gridTemplateColumns: `3.5rem repeat(${grid.dates.length}, minmax(3.25rem, 1fr))` }}
      >
        <div />
        {grid.dates.map((d) => {
          const { weekday, day } = dayLabel(d);
          return (
            <div key={d} className="col-head">
              <strong>{weekday}</strong>
              <span>{day}</span>
            </div>
          );
        })}
        {grid.times.map((t, ti) => (
          <Fragment key={t}>
            <div className="row-head">{ti === 0 || t.endsWith(":00") ? t : ""}</div>
            {grid.slots.map((col) => (
              <Fragment key={col[ti]}>{renderCell(col[ti])}</Fragment>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
