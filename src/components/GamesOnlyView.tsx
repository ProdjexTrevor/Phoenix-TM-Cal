import { useMemo, type CSSProperties } from "react";
import {
  addDays,
  addMinutes,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";
import type { NavigateAction, ViewProps } from "react-big-calendar";
import type { CalendarEvent } from "../types";
import { contrastText } from "../lib/events";
import { dateKey, teamsIdleOnDay } from "../lib/conflicts";
import { MatchupLabel } from "./MatchupLabel";
import { useParentWatch } from "./ParentWatchContext";

type RangeMode = "day" | "week";

function getRange(date: Date, mode: RangeMode) {
  if (mode === "day") {
    return { start: startOfDay(date), end: endOfDay(date) };
  }
  const start = startOfWeek(date, { weekStartsOn: 0 });
  const end = endOfWeek(date, { weekStartsOn: 0 });
  return { start, end };
}

function IdleTeamsNote({ dayKey }: { dayKey: string }) {
  const watch = useParentWatch();
  if (!watch || watch.watchSchoolIds.length === 0) return null;

  const idle = teamsIdleOnDay(
    dayKey,
    watch.schools,
    watch.schoolLevels,
    watch.playingByDate,
    watch.kidSchoolId,
    watch.kidLevels
  );

  if (idle.length === 0) {
    return (
      <p className="idle-teams">
        <span className="idle-teams__label">Not playing:</span> none — all
        selected teams have a game
      </p>
    );
  }

  const kidIdle = idle.some((t) => t.isKid);

  return (
    <p className={`idle-teams ${kidIdle ? "kid-free" : ""}`}>
      <span className="idle-teams__label">Not playing:</span>{" "}
      {idle.map((t, i) => (
        <span key={`${t.schoolId}-${t.level}`}>
          {i > 0 ? ", " : ""}
          <span
            className={`idle-teams__name ${t.isKid ? "is-kid" : ""}`}
            style={{ "--school": t.primary } as CSSProperties}
          >
            {t.shortName} {t.level}
          </span>
        </span>
      ))}
      {kidIdle ? (
        <span className="idle-teams__hint"> · your kid is free</span>
      ) : null}
    </p>
  );
}

function GamesOnlyView({
  mode,
  date,
  events = [],
  onSelectEvent,
}: ViewProps<CalendarEvent> & { mode: RangeMode }) {
  const anchor = date instanceof Date ? date : new Date(date);
  const { start, end } = getRange(anchor, mode);
  const watch = useParentWatch();

  const days = useMemo(() => {
    const toDate = (value: Date | string) =>
      value instanceof Date ? value : new Date(value);

    const inRange = (events as CalendarEvent[])
      .map((event) => ({
        ...event,
        start: toDate(event.start),
        end: toDate(event.end),
      }))
      .filter((event) => event.start <= end && event.end >= start)
      .sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? 1 : -1;
        return a.start.getTime() - b.start.getTime();
      });

    const byDay = new Map<string, CalendarEvent[]>();
    for (const event of inRange) {
      const key = format(event.start, "yyyy-MM-dd");
      const list = byDay.get(key) ?? [];
      list.push(event);
      byDay.set(key, list);
    }

    // Only days that have games
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, dayEvents]) => ({
        key,
        date: dayEvents[0].start,
        events: dayEvents,
      }));
  }, [events, start, end]);

  // For day view with no games in range, still show idle note for that day
  if (days.length === 0) {
    const emptyKey = dateKey(anchor);
    return (
      <div className="games-list-view">
        {mode === "day" && (
          <section className="games-day">
            <IdleTeamsNote dayKey={emptyKey} />
          </section>
        )}
        <p className="games-list-view__empty">
          {watch?.openTimesOnly
            ? "No open (non-conflict) games for this period."
            : `No games scheduled for this ${mode === "day" ? "day" : "week"}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="games-list-view">
      {days.map((day) => (
        <section key={day.key} className="games-day">
          <div className="games-day__header">
            {(mode === "week" || mode === "day") && (
              <h3 className="games-day__heading">
                {format(day.date, mode === "day" ? "EEEE, MMM d" : "EEEE, MMM d")}
              </h3>
            )}
            <IdleTeamsNote dayKey={day.key} />
          </div>
          <ul className="games-day__list">
            {day.events.map((event) => {
              const primary = event.resource.schoolMeta.primary;
              const secondary = event.resource.schoolMeta.secondary;
              const isJv = event.resource.level === "JV";
              const isKid =
                watch?.kidSchoolId === event.resource.schoolId &&
                watch.kidLevels.includes(event.resource.level);
              const timeLabel = event.resource.time
                ? `${format(event.start, "h:mm a")} – ${format(addMinutes(event.start, 120), "h:mm a")}`
                : event.allDay
                  ? "All day / TBD"
                  : format(event.start, "h:mm a");

              return (
                <li key={event.id}>
                  <button
                    type="button"
                    className={`game-row ${isJv ? "jv" : ""} ${isKid ? "is-kid" : ""}`}
                    onClick={() => onSelectEvent?.(event)}
                    style={
                      {
                        "--school": primary,
                        "--school-alt": secondary,
                        "--school-text": contrastText(primary),
                      } as CSSProperties
                    }
                  >
                    <span className="game-row__time">{timeLabel}</span>
                    <span className="game-row__body">
                      <span className="game-row__title">
                        <MatchupLabel event={event} />
                        {isKid ? (
                          <span className="kid-badge"> your kid</span>
                        ) : null}
                      </span>
                    </span>
                    <span className="game-row__swatch" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function createGamesOnlyView(mode: RangeMode) {
  function ViewComponent(props: ViewProps<CalendarEvent>) {
    return <GamesOnlyView {...props} mode={mode} />;
  }

  ViewComponent.range = (date: Date) => {
    const { start, end } = getRange(date, mode);
    if (mode === "day") return [start];
    const days: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    return days;
  };

  ViewComponent.navigate = (date: Date, action: NavigateAction) => {
    const step = mode === "day" ? 1 : 7;
    switch (action) {
      case "PREV":
        return addDays(date, -step);
      case "NEXT":
        return addDays(date, step);
      case "TODAY":
        return new Date();
      default:
        return date;
    }
  };

  ViewComponent.title = (date: Date) => {
    if (mode === "day") return format(date, "EEEE MMM d, yyyy");
    const { start, end } = getRange(date, "week");
    if (isSameDay(start, end)) return format(start, "MMM d, yyyy");
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`;
    }
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  };

  return ViewComponent;
}

export const WeekGamesView = createGamesOnlyView("week");
export const DayGamesView = createGamesOnlyView("day");
