import { parseISO, addHours, addDays, addMinutes } from "date-fns";
import type { CalendarEvent, Game, ScheduleData, School } from "../types";

export type GameResource = Game & { schoolMeta: School };

export function schoolMap(data: ScheduleData): Record<string, School> {
  return Object.fromEntries(data.schools.map((s) => [s.id, s]));
}

/** Human-readable venue for a game. */
export function gameLocationLabel(g: GameResource): string {
  const tidy = (value: string) =>
    value
      .replace(/\bHS\b/g, "High School")
      .replace(/\s+/g, " ")
      .replace(/,\s*$/, "")
      .trim();

  if (g.location) return tidy(g.location);

  if (g.home) return g.schoolMeta.name;

  // Away: played at opponent unless it's clearly a tournament name
  if (g.tournament || /tournament|invite|jamboree|classic/i.test(g.opponent)) {
    return tidy(g.opponent);
  }

  if (/high school/i.test(g.opponent)) return tidy(g.opponent);
  return tidy(`${g.opponent} High School`);
}

export function toCalendarEvents(
  games: Game[],
  schools: Record<string, School>
): CalendarEvent[] {
  return games
    .filter((g) => schools[g.schoolId])
    .map((g) => {
      const schoolMeta = schools[g.schoolId];
      const ha = g.home ? "vs" : "@";
      const title = `${g.school} ${g.level === "JV" ? "JV" : "V"} ${ha} ${g.opponent}`;

      let start: Date;
      let end: Date;
      let allDay = false;

      if (g.time) {
        start = parseISO(g.start.includes("T") ? g.start : `${g.date}T${g.time}:00`);
        end = addMinutes(start, 120);
      } else if (g.endDate && g.endDate !== g.date) {
        start = parseISO(g.date);
        end = addDays(parseISO(g.endDate), 1);
        allDay = true;
      } else {
        start = parseISO(g.date);
        end = addHours(start, 3);
        allDay = true;
      }

      return {
        id: g.id,
        title,
        start,
        end,
        allDay,
        resource: { ...g, schoolMeta },
      };
    });
}

export function contrastText(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#0d1117" : "#ffffff";
}

