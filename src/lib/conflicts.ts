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

export type IdleTeamLevel = {
  schoolId: string;
  shortName: string;
  level: "V" | "JV";
  primary: string;
  isKid: boolean;
};

export function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function playingKey(schoolId: string, level: GameLevel) {
  return `${schoolId}:${level === "JV" ? "JV" : "V"}`;
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

/**
 * Selected school+level combos with no game that day.
 * Example: Liberty North V playing, JV not → lists "Liberty North JV".
 */
export function teamsIdleOnDay(
  dayKey: string,
  schools: School[],
  schoolLevels: SchoolLevelsMap,
  playingByDate: Map<string, Set<string>>,
  kidSchoolId: string | null,
  kidLevels: GameLevel[]
): IdleTeamLevel[] {
  const playing = playingByDate.get(dayKey) ?? new Set();
  const idle: IdleTeamLevel[] = [];
  const kidLevelSet = new Set(kidLevels);

  for (const school of schools) {
    const filter = schoolLevels[school.id];
    if (!isSchoolActive(filter)) continue;

    const candidates: Array<{ level: GameLevel; label: "V" | "JV" }> = [];
    if (filter.varsity) candidates.push({ level: "Varsity", label: "V" });
    if (filter.jv) candidates.push({ level: "JV", label: "JV" });

    for (const c of candidates) {
      const key = playingKey(school.id, c.level);
      if (playing.has(key)) continue;
      idle.push({
        schoolId: school.id,
        shortName: school.shortName,
        level: c.label,
        primary: school.primary,
        isKid:
          school.id === kidSchoolId && kidLevelSet.has(c.level),
      });
    }
  }

  return idle;
}

/** Map date → set of "schoolId:V" / "schoolId:JV" that have a game. */
export function buildPlayingByDate(
  events: CalendarEvent[],
  schoolLevels: SchoolLevelsMap
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const event of events) {
    if (
      !schoolAllowsLevel(
        schoolLevels[event.resource.schoolId],
        event.resource.level
      )
    ) {
      continue;
    }
    const key = dateKey(event.start);
    const set = map.get(key) ?? new Set();
    set.add(playingKey(event.resource.schoolId, event.resource.level));
    map.set(key, set);
  }
  return map;
}
