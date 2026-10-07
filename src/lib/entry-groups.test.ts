import { describe, expect, it } from "vitest";
import { formatDayLabel, formatWeekLabel, groupEntries, type Groupable, weekStart } from "./entry-groups";

let n = 0;
const entry = (date: string, time: string, seconds: number | null, over: Partial<Groupable> = {}): Groupable => ({
  id: `e${++n}`,
  description: "Discovery",
  projectId: "p1",
  taskId: null,
  date,
  startedAt: `${date}T${time}:00Z`,
  durationSeconds: seconds,
  ...over,
});

describe("weekStart", () => {
  it("returns the Monday of the week, for every weekday", () => {
    expect(weekStart("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(weekStart("2026-10-07")).toBe("2026-10-05"); // Wednesday
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // Sunday belongs to the week that started on Monday
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
  });

  it("crosses month and year boundaries", () => {
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
    expect(weekStart("2026-03-01")).toBe("2026-02-23");
  });
});

describe("groupEntries", () => {
  it("nests week > day > group, newest first, with totals at every level", () => {
    const entries = [
      entry("2026-09-30", "09:01", 12_815), // Wed, previous week
      entry("2026-09-30", "16:04", 7_680),
      entry("2026-09-30", "08:10", 2_280, { description: "Organização" }),
      entry("2026-10-05", "15:00", 4_567, { description: "Reunião" }),
    ];
    const weeks = groupEntries(entries);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-10-05", "2026-09-28"]);
    expect(weeks[0].totalSeconds).toBe(4_567);

    const prev = weeks[1];
    expect(prev.totalSeconds).toBe(12_815 + 7_680 + 2_280);
    expect(prev.days).toHaveLength(1);
    const [discovery, org] = prev.days[0].groups;
    expect(discovery.entries).toHaveLength(2);
    expect(discovery.totalSeconds).toBe(12_815 + 7_680);
    expect(discovery.entries[0].startedAt).toBe("2026-09-30T16:04:00Z"); // newest first inside the group
    expect(org.entries).toHaveLength(1);
    expect(prev.days[0].totalSeconds).toBe(prev.totalSeconds);
  });

  it("groups only within the same day, and only when description, project and task match", () => {
    const weeks = groupEntries([
      entry("2026-10-05", "08:00", 60),
      entry("2026-10-05", "10:00", 60),
      entry("2026-10-05", "11:00", 60, { projectId: "p2" }),
      entry("2026-10-05", "12:00", 60, { taskId: "t1" }),
      entry("2026-10-06", "08:00", 60),
    ]);
    const monday = weeks[0].days.find((d) => d.date === "2026-10-05")!;
    expect(monday.groups.map((g) => g.entries.length).sort()).toEqual([1, 1, 2]);
    expect(weeks[0].days.map((d) => d.date)).toEqual(["2026-10-06", "2026-10-05"]);
  });

  it("ignores case and surrounding spaces in descriptions", () => {
    const weeks = groupEntries([entry("2026-10-05", "08:00", 60, { description: " discovery" }), entry("2026-10-05", "09:00", 60)]);
    expect(weeks[0].days[0].groups).toHaveLength(1);
  });

  it("counts a running entry as zero in totals but keeps it in the list", () => {
    const [week] = groupEntries([entry("2026-10-05", "08:00", 3_600), entry("2026-10-05", "09:00", null)]);
    expect(week.totalSeconds).toBe(3_600);
    expect(week.days[0].groups[0].entries).toHaveLength(2);
  });

  it("returns nothing for no entries and does not mutate the input", () => {
    expect(groupEntries([])).toEqual([]);
    const input = [entry("2026-10-05", "08:00", 1), entry("2026-10-05", "09:00", 1)];
    const copy = [...input];
    groupEntries(input);
    expect(input).toEqual(copy);
  });
});

describe("labels", () => {
  it("formats days in Portuguese", () => {
    expect(formatDayLabel("2026-10-05")).toBe("Seg, 5 out");
    expect(formatDayLabel("2026-09-30")).toBe("Qua, 30 set");
  });

  it("names the current and previous week, and ranges for older ones", () => {
    expect(formatWeekLabel("2026-10-05", "2026-10-05")).toBe("Esta semana");
    expect(formatWeekLabel("2026-09-28", "2026-10-05")).toBe("Semana anterior");
    expect(formatWeekLabel("2026-09-21", "2026-10-05")).toBe("21 set – 27 set");
    expect(formatWeekLabel("2026-12-28", "2027-02-01")).toBe("28 dez – 3 jan");
  });
});
