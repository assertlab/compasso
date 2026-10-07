"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { type Block, MIN_BLOCK_MINUTES, minutesToTime, snapMinutes, SNAP_MINUTES } from "@/lib/calendar-layout";
import { formatHms } from "@/lib/time";
import { moveEntryAction, resizeEntryAction } from "../actions";
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

type BlockDrag = {
  key: string;
  mode: "move" | "start" | "end";
  originX: number;
  originY: number;
  /** Width of one day column in px, measured when the drag starts. */
  colWidth: number;
  /** Snapped minutes the pointer moved vertically, and whole columns it moved horizontally. */
  minutes: number;
  columns: number;
  moved: boolean;
};

const DRAG_THRESHOLD_PX = 4;
const HANDLE_PX = 6;

/**
 * Week grid (sm and up): click a block to edit it, drag it to move (also across days), drag its top or bottom
 * edge to resize, and drag on empty space to log a new period. Running timers are not draggable.
 */
export function WeekGrid({ days, catalog, today }: { days: GridDay[]; catalog: CatalogView; today: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ date: string; anchor: number; current: number } | null>(null);
  const [draft, setDraft] = useState<EntryPrefill | null>(null);
  const [blockDrag, setBlockDrag] = useState<BlockDrag | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  // The empty-space drag lives in a ref too: handlers must not depend on a stale render's closure.
  const createRef = useRef<{ date: string; anchor: number; current: number } | null>(null);
  const [, startTransition] = useTransition();
  const body = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);

  // Start the view around the working day instead of at midnight.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7 * HOUR_PX;
  }, []);

  const minuteAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(Math.max(e.clientY - rect.top, 0), 24 * HOUR_PX) / MINUTE_PX;
  };

  function beginBlockDrag(e: React.PointerEvent<HTMLElement>, key: string, mode: BlockDrag["mode"]) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    suppressClick.current = false;
    setDragError(null);
    const colWidth = ((body.current?.getBoundingClientRect().width ?? 0) - GUTTER_PX) / 7;
    setBlockDrag({ key, mode, originX: e.clientX, originY: e.clientY, colWidth, minutes: 0, columns: 0, moved: false });
  }

  function updateBlockDrag(e: React.PointerEvent<HTMLElement>, index: number) {
    if (!blockDrag) return;
    const dx = e.clientX - blockDrag.originX;
    const dy = e.clientY - blockDrag.originY;
    const moved = blockDrag.moved || Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX;
    const columns = blockDrag.mode === "move" ? Math.max(-index, Math.min(6 - index, Math.round(dx / (blockDrag.colWidth || 1)))) : 0;
    setBlockDrag({ ...blockDrag, moved, minutes: snapMinutes(dy / MINUTE_PX), columns });
  }

  function endBlockDrag(block: Block<EntryView>, date: string) {
    const drag = blockDrag;
    if (!drag) return;
    if (!drag.moved) {
      setBlockDrag(null);
      if (drag.mode === "move") setEditing(block.entry.id); // a plain click opens the editor
      return;
    }
    suppressClick.current = true;
    const { top, height } = previewBox(block, drag);
    const unchanged = drag.mode === "move" ? drag.minutes === 0 && drag.columns === 0 : top === block.startMin && top + height === block.endMin;
    if (unchanged) {
      setBlockDrag(null);
      return;
    }
    startTransition(async () => {
      const result =
        drag.mode === "move"
          ? await moveEntryAction({ id: block.entry.id, shiftMinutes: drag.minutes + drag.columns * 1440 })
          : await resizeEntryAction({
              id: block.entry.id,
              edge: drag.mode,
              date,
              minute: snapMinutes(drag.mode === "start" ? top : top + height),
            });
      if (!result.ok) setDragError(result.message ?? Object.values(result.fieldErrors ?? {})[0] ?? "Não foi possível ajustar o registro.");
      setBlockDrag(null);
    });
  }

  function finishDrag(date: string, anchor: number, current: number) {
    let start = Math.min(anchor, current);
    let end = Math.max(anchor, current);
    if (end - start < SNAP_MINUTES) end = start + 30; // a plain click proposes 30 minutes
    start = Math.min(start, 1440 - SNAP_MINUTES);
    end = Math.min(end, 1440);
    setDraft({ date, start: minutesToTime(start), end: minutesToTime(end) });
  }

  const editingEntry = editing ? days.flatMap((d) => d.blocks).find((b) => b.entry.id === editing)?.entry : undefined;

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

      {dragError && (
        <p role="alert" className="border-b bg-muted px-3 py-2 text-sm text-destructive">
          {dragError}
        </p>
      )}

      <div ref={scroller} style={{ maxHeight: "65vh", overflowY: "auto" }}>
        <div ref={body} style={{ ...columns, position: "relative", height: 24 * HOUR_PX }}>
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
                createRef.current = { date: day.date, anchor: m, current: m };
                setDrag(createRef.current);
              }}
              onPointerMove={(e) => {
                const d = createRef.current;
                if (!d || d.date !== day.date) return;
                createRef.current = { ...d, current: snapMinutes(minuteAt(e)) };
                setDrag(createRef.current);
              }}
              onPointerUp={(e) => {
                const d = createRef.current;
                if (!d || d.date !== day.date) return;
                createRef.current = null;
                setDrag(null);
                finishDrag(day.date, d.anchor, snapMinutes(minuteAt(e)));
              }}
              onPointerCancel={() => {
                createRef.current = null;
                setDrag(null);
              }}
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
                const key = `${e.id}-${block.startMin}`;
                const project = catalog.projects.find((p) => p.id === e.projectId);
                const running = e.endedAt === null;
                const active = blockDrag?.key === key ? blockDrag : null;
                const box = active ? previewBox(block, active) : { top: block.startMin, height: block.endMin - block.startMin };
                const dayIndex = days.indexOf(day);
                return (
                  <div
                    key={key}
                    style={{
                      position: "absolute",
                      padding: "0 2px",
                      top: box.top * MINUTE_PX,
                      height: box.height * MINUTE_PX,
                      left: `${(block.lane / block.lanes) * 100}%`,
                      width: `${100 / block.lanes}%`,
                      zIndex: active ? 20 : undefined,
                      opacity: active?.moved ? 0.85 : undefined,
                      transform: active?.mode === "move" ? `translateX(${active.columns * active.colWidth}px)` : undefined,
                      touchAction: running ? undefined : "none",
                      cursor: running ? undefined : active?.moved ? "grabbing" : "grab",
                    }}
                    onPointerDown={running ? undefined : (ev) => beginBlockDrag(ev, key, "move")}
                    onPointerMove={(ev) => updateBlockDrag(ev, dayIndex)}
                    onPointerUp={() => endBlockDrag(block, day.date)}
                    onPointerCancel={() => setBlockDrag(null)}
                    onClickCapture={(ev) => {
                      if (suppressClick.current) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        suppressClick.current = false;
                      }
                    }}
                  >
                        <button
                          type="button"
                          onClick={() => setEditing(e.id)}
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
                            cursor: "inherit",
                            borderLeft: `4px solid ${running ? "var(--running)" : (project?.color ?? "var(--primary)")}`,
                          }}
                          aria-label={`${e.description || "Sem descrição"}, ${e.startTime} a ${e.endTime ?? "agora"}`}
                          title={`${e.description || "Sem descrição"} · ${project?.name ?? "Sem projeto"} · ${e.startTime}–${e.endTime ?? "agora"}`}
                        >
                          <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {e.description || "Sem descrição"}
                          </span>
                          <span className="text-muted-foreground" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {active?.moved ? previewLabel(box) : (project?.name ?? "Sem projeto")}
                          </span>
                          {e.durationSeconds !== null && !active?.moved && (
                            <span className="font-mono tabular-nums" style={{ marginTop: "auto", textAlign: "right" }}>
                              {formatHms(e.durationSeconds)}
                            </span>
                          )}
                        </button>
                    {!running && !block.continuesBefore && (
                      <div
                        aria-hidden
                        style={{ position: "absolute", left: 2, right: 2, top: 0, height: HANDLE_PX, cursor: "ns-resize", touchAction: "none" }}
                        onPointerDown={(ev) => beginBlockDrag(ev, key, "start")}
                      />
                    )}
                    {!running && !block.continuesAfter && (
                      <div
                        aria-hidden
                        style={{ position: "absolute", left: 2, right: 2, bottom: 0, height: HANDLE_PX, cursor: "ns-resize", touchAction: "none" }}
                        onPointerDown={(ev) => beginBlockDrag(ev, key, "end")}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {editingEntry && (
        <EntryDialog
          catalog={catalog}
          today={today}
          entry={editingEntry}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}

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

/** Where a block is drawn while being dragged: minutes from midnight and height in minutes. */
function previewBox(block: Block<EntryView>, drag: Pick<BlockDrag, "mode" | "minutes">): { top: number; height: number } {
  const height = block.endMin - block.startMin;
  if (drag.mode === "move") return { top: Math.min(Math.max(block.startMin + drag.minutes, 0), 1440 - height), height };
  if (drag.mode === "start") {
    const top = Math.min(Math.max(block.startMin + drag.minutes, 0), block.endMin - MIN_BLOCK_MINUTES);
    return { top, height: block.endMin - top };
  }
  const end = Math.min(Math.max(block.endMin + drag.minutes, block.startMin + MIN_BLOCK_MINUTES), 1440);
  return { top: block.startMin, height: end - block.startMin };
}

const previewLabel = ({ top, height }: { top: number; height: number }) => `${minutesToTime(top)}–${minutesToTime(top + height)}`;
