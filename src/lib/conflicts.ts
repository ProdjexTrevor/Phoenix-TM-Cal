import { format, areIntervalsOverlapping } from "date-fns";
import type { CalendarEvent, GameLevel, School } from "../types";

export type BusyBlock = {
  start: Date;
  end: Date;
  allDay: boolean;
};

export type SchoolLevelFilter = {
  varsity: boolean;
  jv: boolean;
};

export type SchoolLevelsMap = Record<string, SchoolLevelFilter>;

export function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function isSchoolActive(filter: SchoolLevelFilter | undefined) {
  return Boolean(filter?.varsity || filter?.jv);
}

export function schoolAllowsLevel(
  filter: SchoolLevelFilter | undefined,
  level: GameLevel
) {
  if (!filter) return false;
  if (level === "Varsity") return filter.varsity;
  if (level === "JV") return filter.jv;
  return false;
}

/** Kid's games → busy blocks keyed by date. */
export function buildKidBusyMap(
  events: CalendarEvent[],
  kidSchoolId: string,
  kidLevels: GameLevel[]
): Map<string, BusyBlock[]> {
  const map = new Map<string, BusyBlock[]>();
  const levelSet = new Set(kidLevels);

  for (const event of events) {
    if (event.resource.schoolId !== kidSchoolId) continue;
    if (!levelSet.has(event.resource.level)) continue;

    const key = dateKey(event.start);
    const list = map.get(key) ?? [];
    list.push({
      start: event.start,
      end: event.end,
      allDay: event.allDay || !event.resource.time,
    });
    map.set(key, list);
  }
  return map;
}

export function conflictsWithKid(
  event: CalendarEvent,
  busyByDate: Map<string, BusyBlock[]>
): boolean {
  const key = dateKey(event.start);
  const busy = busyByDate.get(key);
  if (!busy || busy.length === 0) return false;

  if (busy.some((b) => b.allDay)) return true;
  if (event.allDay || !event.resource.time) return true;

  return busy.some((b) =>
    areIntervalsOverlapping(
      { start: event.start, end: event.end },
      { start: b.start, end: b.end },
      { inclusive: false }
    )
  );
}

/** Schools (from the watch list) with no games that day at their selected levels. */
export function schoolsIdleOnDay(
  dayKey: string,
  watchSchoolIds: string[],
  schools: School[],
  playingByDate: Map<string, Set<string>>
): School[] {
  const playing = playingByDate.get(dayKey) ?? new Set();
  return schools.filter(
    (s) => watchSchoolIds.includes(s.id) && !playing.has(s.id)
  );
}

export function buildPlayingByDate(
  events: CalendarEvent[],
  schoolLevels: SchoolLevelsMap
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const event of events) {
    if (!schoolAllowsLevel(schoolLevels[event.resource.schoolId], event.resource.level)) {
      continue;
    }
    const key = dateKey(event.start);
    const set = map.get(key) ?? new Set();
    set.add(event.resource.schoolId);
    map.set(key, set);
  }
  return map;
}

