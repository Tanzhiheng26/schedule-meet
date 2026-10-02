"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { dayLabel, type Grid } from "@/lib/slots";

const LABEL_WIDTH_REM = 3.5;
const MIN_COLUMN_PX = 56;

/**
 * Shared day-by-time layout used by both the editable grid and the heatmap. Shows as many
 * days as fit the container's width and pages through the rest, so it never scrolls sideways
 * (sideways scrolling conflicts with drag-to-select on touch screens).
 */
export function SlotGrid({ grid, renderCell }: { grid: Grid; renderCell: (iso: string) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const total = grid.dates.length;
  // Show every day until the container has been measured, so server and client render the same.
  const [perPage, setPerPage] = useState(total);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const fit = Math.floor((entry.contentRect.width - LABEL_WIDTH_REM * rem) / MIN_COLUMN_PX);
      setPerPage(Math.max(1, Math.min(fit, total)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [total]);

  const pages = Math.ceil(total / perPage);
  const current = Math.min(page, pages - 1);
  const from = current * perPage;
  const to = Math.min(from + perPage, total);
  const columns = grid.slots.slice(from, to);

  return (
    <div ref={ref}>
      {pages > 1 && (
        <div className="grid-pager">
          <button type="button" className="small" disabled={current === 0} onClick={() => setPage(current - 1)}>
            ‹ Earlier
          </button>
          <span className="muted">
            Days {from + 1}–{to} of {total}
          </span>
          <button
            type="button"
            className="small"
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Later ›
          </button>
        </div>
      )}
      <div
        className="slot-grid"
        style={{ gridTemplateColumns: `${LABEL_WIDTH_REM}rem repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        <div />
        {grid.dates.slice(from, to).map((d) => {
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
            {columns.map((col) => (
              <Fragment key={col[ti]}>{renderCell(col[ti])}</Fragment>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
