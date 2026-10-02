"use client";

import { useEffect, useRef, useState } from "react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const isoOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

/**
 * Month calendar for picking any set of days. Click to toggle, or drag across days.
 * Submits the selection as a comma-separated list of YYYY-MM-DD in a hidden input.
 */
export function DatePicker({
  name,
  today,
  max,
}: {
  name: string;
  today: string; // YYYY-MM-DD; earlier days can't be picked
  max: number;
}) {
  const [selected, setSelected] = useState(() => new Set<string>());
  const [view, setView] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  // While dragging, every day touched is set to the state the first day flipped to.
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

  const apply = (iso: string, on: boolean) =>
    setSelected((prev) => {
      if (prev.has(iso) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(iso);
      else next.delete(iso);
      return next;
    });

  const dayAt = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest("[data-day]")?.getAttribute("data-day") ?? null;

  const shiftMonth = (delta: number) =>
    setView(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }));

  const lead = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const isCurrentMonth = isoOf(view.y, view.m, 1) <= today;
  const sorted = [...selected].sort();

  return (
    <div className="datepicker">
      <input type="hidden" name={name} value={sorted.join(",")} />
      <div className="dp-head">
        <button type="button" className="small" onClick={() => shiftMonth(-1)} disabled={isCurrentMonth}>
          ‹ Prev
        </button>
        <strong>
          {MONTHS[view.m]} {view.y}
        </strong>
        <button type="button" className="small" onClick={() => shiftMonth(1)}>
          Next ›
        </button>
      </div>
      <div
        className="dp-grid"
        onPointerDown={(e) => {
          const iso = dayAt(e.clientX, e.clientY);
          if (!iso) return;
          e.preventDefault();
          drag.current = { on: !selected.has(iso) };
          apply(iso, drag.current.on);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const iso = dayAt(e.clientX, e.clientY);
          if (iso) apply(iso, drag.current.on);
        }}
      >
        {WEEKDAYS.map((d) => (
          <div key={d} className="dp-weekday">
            {d}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const iso = isoOf(view.y, view.m, i + 1);
          const past = iso < today;
          return (
            <button
              key={iso}
              type="button"
              className="dp-day"
              data-day={past ? undefined : iso}
              data-on={selected.has(iso) || undefined}
              data-today={iso === today || undefined}
              disabled={past}
              aria-pressed={selected.has(iso)}
              // Pointer input is handled above; this only handles keyboard (Enter/Space) presses.
              onClick={(e) => e.detail === 0 && apply(iso, !selected.has(iso))}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="row gap wrap">
        <span className={sorted.length > max ? "error" : "muted"}>
          {sorted.length === 0
            ? "Click or drag to pick days."
            : `${sorted.length} day${sorted.length === 1 ? "" : "s"} selected${sorted.length > max ? ` (max ${max})` : ""}`}
        </span>
        {sorted.length > 0 && (
          <button type="button" className="small" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
