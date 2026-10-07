"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { impliedEndDate } from "@/lib/entry-dates";

const inputClass = "h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50";
const fieldError = (message?: string) => (message ? <p className="text-sm text-destructive">{message}</p> : null);

/**
 * Start date/time and end date/time. The end date follows the implied one (same day, or the next when the
 * end time is before the start) until the user picks one themselves; an existing entry that already
 * ends on a different day than implied keeps its date.
 */
export function EntryTimeFields({
  defaults,
  running,
  errors,
}: {
  defaults: { date: string; start: string; end: string; endDate?: string | null; isExisting: boolean };
  running: boolean;
  errors: Record<string, string>;
}) {
  const [date, setDate] = useState(defaults.date);
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [pickedEndDate, setPickedEndDate] = useState<string | null>(
    defaults.isExisting && defaults.endDate && defaults.endDate !== impliedEndDate(defaults.date, defaults.start, defaults.end) ? defaults.endDate : null,
  );
  const endDate = pickedEndDate ?? impliedEndDate(date, start, end);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="date">Data de início</Label>
          <input id="date" name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          {fieldError(errors.date)}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="start">Início</Label>
          <input id="start" name="start" type="time" required value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
          {fieldError(errors.start)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="endDate">Data de término</Label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required={!running}
            disabled={running}
            value={running ? "" : endDate}
            onChange={(e) => setPickedEndDate(e.target.value || null)}
            className={inputClass}
          />
          {fieldError(errors.endDate)}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="end">Fim</Label>
          <input id="end" name="end" type="time" required={!running} disabled={running} value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
          {running ? <p className="text-xs text-muted-foreground">Em andamento</p> : fieldError(errors.end)}
        </div>
      </div>
    </div>
  );
}
