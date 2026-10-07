"use client";

import { useEffect, useRef, useState } from "react";
import { type Block, minutesToTime, snapMinutes, SNAP_MINUTES } from "@/lib/calendar-layout";
import { formatHms } from "@/lib/time";
import { EntryDialog, type EntryPrefill } from "../entry-dialog";
import type { CatalogView, EntryView } from "../types";

export type GridDay = {
  date: string;
  label: string;
  isToday: boolean;
  isWeekend: boolean;
  totalSeconds: number;
  blocks: Block<EntryView>[];
};

const HOUR_PX = 56;
const MINUTE_PX = HOUR_PX / 60;
const GUTTER_PX = 52;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

// Layout-critical sizes are inline styles on purpose: the grid must not depend on utility classes being generated.
const columns = { display: "grid", gridTemplateColumns: `${GUTTER_PX}px repeat(7, minmax(0, 1fr))` } as const;
const weekendTint = "color-mix(in srgb, var(--muted) 60%, transparent)";
const todayTint = "color-mix(in srgb, var(--accent) 45%, transparent)";

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
    <div className="hidden rounded-lg border bg-card sm:block" style={{ overflow: "hidden" }}>
      <div className="border-b bg-muted text-xs" style={columns}>
        <div />
        {days.map((day) => (
          <div key={day.date} className="border-l px-2 py-2" style={day.isToday ? { color: "var(--primary)", fontWeight: 600 } : undefined}>
            <div>{day.label}</div>
            <div className="font-mono tabular-nums" style={{ opacity: day.totalSeconds > 0 ? 1 : 0.4 }}>
              {day.totalSeconds > 0 ? formatHms(day.totalSeconds) : "—"}
            </div>
          </div>
        ))}
      </div>

      <div ref={scroller} style={{ maxHeight: "65vh", overflowY: "auto" }}>
        <div style={{ ...columns, position: "relative", height: 24 * HOUR_PX }}>
          <div style={{ position: "relative" }}>
            {HOURS.slice(1).map((h) => (
              <span
                key={h}
                className="text-muted-foreground"
                style={{ position: "absolute", right: 6, top: h * HOUR_PX - 7, fontSize: 11, lineHeight: "14px" }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day.date}
              role="presentation"
              className="border-l"
              style={{
                position: "relative",
                touchAction: "none",
                userSelect: "none",
                background: day.isToday ? todayTint : day.isWeekend ? weekendTint : undefined,
                backgroundImage: "linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
                backgroundSize: `100% ${HOUR_PX}px`,
              }}
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
                  style={{
                    position: "absolute",
                    left: 2,
                    right: 2,
                    pointerEvents: "none",
                    borderRadius: 4,
                    background: "color-mix(in srgb, var(--primary) 30%, transparent)",
                    outline: "1px solid var(--primary)",
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
                    style={{
                      position: "absolute",
                      padding: "0 2px",
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
                          className="bg-secondary text-xs hover:bg-accent"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            width: "100%",
                            height: "100%",
                            overflow: "hidden",
                            textAlign: "left",
                            padding: "2px 6px",
                            borderRadius: 4,
                            borderLeft: `4px solid ${running ? "var(--running)" : (project?.color ?? "var(--primary)")}`,
                          }}
                          aria-label={`${e.description || "Sem descrição"}, ${e.startTime} a ${e.endTime ?? "agora"}`}
                          title={`${e.description || "Sem descrição"} · ${project?.name ?? "Sem projeto"} · ${e.startTime}–${e.endTime ?? "agora"}`}
                        >
                          <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {e.description || "Sem descrição"}
                          </span>
                          <span className="text-muted-foreground" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {project?.name ?? "Sem projeto"}
                          </span>
                          {e.durationSeconds !== null && (
                            <span className="font-mono tabular-nums" style={{ marginTop: "auto", textAlign: "right" }}>
                              {formatHms(e.durationSeconds)}
                            </span>
                          )}
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
