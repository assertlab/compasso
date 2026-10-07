"use client";

import { useEffect, useRef, useState } from "react";
import { type Block, minutesToTime, snapMinutes, SNAP_MINUTES } from "@/lib/calendar-layout";
import { formatHms } from "@/lib/time";
import { cn } from "@/lib/utils";
import { EntryDialog, type EntryPrefill } from "../entry-dialog";
import type { CatalogView, EntryView } from "../types";

export type GridDay = {
  date: string;
  label: string;
  isToday: boolean;
  totalSeconds: number;
  blocks: Block<EntryView>[];
};

const HOUR_PX = 48;
const MINUTE_PX = HOUR_PX / 60;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Week grid (sm and up): click a block to edit it, drag on empty space to log a period. */
export function WeekGrid({ days, catalog, today }: { days: GridDay[]; catalog: CatalogView; today: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ date: string; anchor: number; current: number } | null>(null);
  const [draft, setDraft] = useState<EntryPrefill | null>(null);

  // Start the view around the working day instead of at midnight.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7 * HOUR_PX;
  }, []);

  const minuteAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(Math.max(e.clientY - rect.top, 0), 24 * HOUR_PX) / MINUTE_PX;
  };

  function finishDrag(date: string, anchor: number, current: number) {
    let start = Math.min(anchor, current);
    let end = Math.max(anchor, current);
    if (end - start < SNAP_MINUTES) end = start + 30; // a plain click proposes 30 minutes
    start = Math.min(start, 1440 - SNAP_MINUTES);
    end = Math.min(end, 1440);
    setDraft({ date, start: minutesToTime(start), end: minutesToTime(end) });
  }

  return (
    <div className="hidden overflow-hidden rounded-lg border bg-card sm:block">
      <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b bg-muted text-xs">
        <div />
        {days.map((day) => (
          <div key={day.date} className={cn("px-2 py-2", day.isToday && "font-semibold text-primary")}>
            <p>{day.label}</p>
            <p className="font-mono tabular-nums text-muted-foreground">{formatHms(day.totalSeconds)}</p>
          </div>
        ))}
      </div>

      <div ref={scroller} className="max-h-[65vh] overflow-y-auto">
        <div className="relative grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]" style={{ height: 24 * HOUR_PX }}>
          <div className="relative">
            {HOURS.map((h) => (
              <span key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: h * HOUR_PX }}>
                {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day.date}
              role="presentation"
              className={cn("relative touch-none select-none border-l", day.isToday && "bg-accent/30")}
              style={{ backgroundImage: "linear-gradient(to bottom, var(--border) 1px, transparent 1px)", backgroundSize: `100% ${HOUR_PX}px` }}
              onPointerDown={(e) => {
                if (e.target !== e.currentTarget || e.button !== 0) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                const m = snapMinutes(minuteAt(e));
                setDrag({ date: day.date, anchor: m, current: m });
              }}
              onPointerMove={(e) => {
                if (drag?.date === day.date) setDrag({ ...drag, current: snapMinutes(minuteAt(e)) });
              }}
              onPointerUp={(e) => {
                if (drag?.date !== day.date) return;
                const end = snapMinutes(minuteAt(e));
                setDrag(null);
                finishDrag(day.date, drag.anchor, end);
              }}
              onPointerCancel={() => setDrag(null)}
            >
              {drag?.date === day.date && (
                <div
                  className="pointer-events-none absolute inset-x-0.5 rounded bg-primary/30 ring-1 ring-primary"
                  style={{
                    top: Math.min(drag.anchor, drag.current) * MINUTE_PX,
                    height: Math.max(Math.abs(drag.current - drag.anchor), SNAP_MINUTES) * MINUTE_PX,
                  }}
                />
              )}

              {day.blocks.map((block) => {
                const e = block.entry;
                const project = catalog.projects.find((p) => p.id === e.projectId);
                const running = e.endedAt === null;
                return (
                  <div
                    key={`${e.id}-${block.startMin}`}
                    className="absolute px-0.5"
                    style={{
                      top: block.startMin * MINUTE_PX,
                      height: (block.endMin - block.startMin) * MINUTE_PX,
                      left: `${(block.lane / block.lanes) * 100}%`,
                      width: `${100 / block.lanes}%`,
                    }}
                  >
                    <EntryDialog
                      catalog={catalog}
                      entry={e}
                      today={today}
                      trigger={
                        <button
                          type="button"
                          className={cn(
                            "flex h-full w-full flex-col overflow-hidden rounded border-l-4 bg-secondary px-1.5 py-0.5 text-left text-xs hover:bg-accent",
                            running && "border-l-running",
                          )}
                          style={running ? undefined : { borderLeftColor: project?.color ?? "var(--primary)" }}
                          aria-label={`${e.description || "Sem descrição"}, ${e.startTime} a ${e.endTime ?? "agora"}`}
                        >
                          <span className="truncate font-medium">{e.description || "Sem descrição"}</span>
                          <span className="truncate text-muted-foreground">
                            {project?.name ?? "Sem projeto"} · {e.startTime}–{e.endTime ?? "…"}
                          </span>
                        </button>
                      }
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {draft && (
        <EntryDialog
          catalog={catalog}
          today={today}
          prefill={draft}
          open
          onOpenChange={(open) => {
            if (!open) setDraft(null);
          }}
        />
      )}
    </div>
  );
}
