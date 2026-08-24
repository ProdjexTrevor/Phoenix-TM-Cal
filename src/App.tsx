import { useMemo, useState, useCallback, type CSSProperties } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  type View,
} from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  parseISO,
} from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import schedule from "./data/games.json";
import type { CalendarEvent, GameLevel, ScheduleData } from "./types";
import {
  schoolMap,
  toCalendarEvents,
  contrastText,
  gameLocationLabel,
} from "./lib/events";
import { buildKidBusyMap, conflictsWithKid, buildPlayingByDate, isSchoolActive, schoolAllowsLevel, type SchoolLevelsMap } from "./lib/conflicts";
import { buildIcs, downloadIcs, googleEventUrl } from "./lib/ics";
import { WeekGamesView, DayGamesView } from "./components/GamesOnlyView";
import { MatchupLabel } from "./components/MatchupLabel";
import { ParentWatchProvider } from "./components/ParentWatchContext";
import "./App.css";

const data = schedule as ScheduleData;
const schoolsById = schoolMap(data);
const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

const ALL_SCHOOL_IDS = data.schools.map((s) => s.id);

function defaultSchoolLevels(both = true): SchoolLevelsMap {
  return Object.fromEntries(
    ALL_SCHOOL_IDS.map((id) => [id, { varsity: both, jv: both }])
  );
}

function App() {
  const [schoolLevels, setSchoolLevels] = useState<SchoolLevelsMap>(() =>
    defaultSchoolLevels(true)
  );
  const [kidSchoolId, setKidSchoolId] = useState<string | null>(null);
  const [kidVarsity, setKidVarsity] = useState(true);
  const [kidJv, setKidJv] = useState(true);
  const [openTimesOnly, setOpenTimesOnly] = useState(false);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(() => parseISO("2026-08-24"));
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  const watchSchoolIds = useMemo(
    () => ALL_SCHOOL_IDS.filter((id) => isSchoolActive(schoolLevels[id])),
    [schoolLevels]
  );

  const kidLevels = useMemo(() => {
    const levels: GameLevel[] = [];
    if (kidVarsity) levels.push("Varsity");
    if (kidJv) levels.push("JV");
    return levels;
  }, [kidVarsity, kidJv]);

  /** All non-canceled games for busy-map / kid schedule (ignore school filter). */
  const allLevelEvents = useMemo(() => {
    const games = data.games.filter((g) => !g.canceled);
    return toCalendarEvents(games, schoolsById);
  }, []);

  const kidBusyByDate = useMemo(() => {
    if (!kidSchoolId || kidLevels.length === 0) return new Map();
    return buildKidBusyMap(allLevelEvents, kidSchoolId, kidLevels);
  }, [allLevelEvents, kidSchoolId, kidLevels]);

  const playingByDate = useMemo(
    () => buildPlayingByDate(allLevelEvents, schoolLevels),
    [allLevelEvents, schoolLevels]
  );

  const filteredGames = useMemo(() => {
    return data.games.filter((g) => {
      if (g.canceled) return false;
      return schoolAllowsLevel(schoolLevels[g.schoolId], g.level as GameLevel);
    });
  }, [schoolLevels]);

  const events = useMemo(() => {
    let list = toCalendarEvents(filteredGames, schoolsById);

    if (openTimesOnly && kidSchoolId && kidLevels.length > 0) {
      list = list.filter((event) => {
        if (
          event.resource.schoolId === kidSchoolId &&
          kidLevels.includes(event.resource.level)
        ) {
          return false;
        }
        return !conflictsWithKid(event, kidBusyByDate);
      });
    }

    return list;
  }, [
    filteredGames,
    openTimesOnly,
    kidSchoolId,
    kidLevels,
    kidBusyByDate,
  ]);

  const parentWatchValue = useMemo(
    () => ({
      watchSchoolIds,
      schools: data.schools,
      schoolLevels,
      kidSchoolId,
      kidLevels,
      openTimesOnly,
      kidBusyByDate,
      playingByDate,
    }),
    [
      watchSchoolIds,
      schoolLevels,
      kidSchoolId,
      kidLevels,
      openTimesOnly,
      kidBusyByDate,
      playingByDate,
    ]
  );

  const setSchoolLevel = (
    id: string,
    key: "varsity" | "jv",
    value: boolean
  ) => {
    setSchoolLevels((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  };

  const setAllLevels = (varsity: boolean, jv: boolean) => {
    setSchoolLevels(
      Object.fromEntries(
        ALL_SCHOOL_IDS.map((id) => [id, { varsity, jv }])
      )
    );
  };

  const eventPropGetter = useCallback(
    (event: CalendarEvent) => {
      const primary = event.resource.schoolMeta.primary;
      const secondary = event.resource.schoolMeta.secondary;
      const isJv = event.resource.level === "JV";
      const isKid =
        kidSchoolId === event.resource.schoolId &&
        kidLevels.includes(event.resource.level);
      return {
        style: {
          backgroundColor: primary,
          borderColor: isKid ? "#b894c9" : secondary,
          borderWidth: isKid ? 3 : isJv ? 2 : 0,
          borderStyle: isJv && !isKid ? "dashed" : "solid",
          color: contrastText(primary),
          opacity: isJv ? 0.88 : 1,
          borderRadius: 4,
          fontSize: "0.72rem",
          fontWeight: 600,
        },
      };
    },
    [kidSchoolId, kidLevels]
  );

  const exportCalendar = () => {
    const ics = buildIcs(events, "Phoenix - Big Dawgs");
    downloadIcs(ics, "softball-combined-2026.ics");
  };

  const kidSchool = kidSchoolId ? schoolsById[kidSchoolId] : null;
  const openTimesReady = Boolean(kidSchoolId && kidLevels.length > 0);

  return (
    <ParentWatchProvider value={parentWatchValue}>
      <div className="app">
        <header className="hero">
          <div className="hero__bg" aria-hidden />
          <div className="hero__content">
            <p className="eyebrow">Fall 2026 · MSHSAA</p>
            <h1>Phoenix - Big Dawgs</h1>
            <div className="hero__rule" aria-hidden />
          </div>
        </header>

        <div className="layout">
          <aside className="sidebar">
            <section className="panel parent-panel">
              <h2>My kid&apos;s team</h2>
              <p className="panel-help">
                Set your school team, then turn on open times to only see other
                schools when your kid isn&apos;t playing.
              </p>
              <label className="field-label" htmlFor="kid-school">
                School
              </label>
              <select
                id="kid-school"
                className="select"
                value={kidSchoolId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setKidSchoolId(v || null);
                  if (!v) setOpenTimesOnly(false);
                }}
              >
                <option value="">Select school…</option>
                {data.schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shortName}
                  </option>
                ))}
              </select>

              <div className="kid-levels">
                <span className="field-label">Kid plays</span>
                <div className="toggles compact">
                  <label className={`toggle ${kidVarsity ? "on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={kidVarsity}
                      onChange={(e) => setKidVarsity(e.target.checked)}
                      disabled={!kidSchoolId}
                    />
                    <span className="toggle__mark">V</span>
                    Varsity
                  </label>
                  <label className={`toggle ${kidJv ? "on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={kidJv}
                      onChange={(e) => setKidJv(e.target.checked)}
                      disabled={!kidSchoolId}
                    />
                    <span className="toggle__mark dashed">JV</span>
                    JV
                  </label>
                </div>
              </div>

              <label
                className={`toggle open-times ${openTimesOnly ? "on" : ""} ${!openTimesReady ? "disabled" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={openTimesOnly}
                  disabled={!openTimesReady}
                  onChange={(e) => setOpenTimesOnly(e.target.checked)}
                />
                <span className="toggle__mark open">OT</span>
                Open times only
              </label>
              <p className="panel-help tight">
                {openTimesOnly && kidSchool
                  ? `Showing games that don’t conflict with ${kidSchool.shortName}${kidLevels.length === 1 ? ` ${kidLevels[0]}` : ""}.`
                  : "Hides anything that overlaps your kid’s games."}
              </p>
            </section>

            <section className="panel">
              <div className="panel__row">
                <h2>Schools</h2>
                <div className="mini-actions">
                  <button type="button" onClick={() => setAllLevels(true, true)}>
                    All
                  </button>
                  <button type="button" onClick={() => setAllLevels(true, false)}>
                    V only
                  </button>
                  <button type="button" onClick={() => setAllLevels(false, true)}>
                    JV only
                  </button>
                  <button type="button" onClick={() => setAllLevels(false, false)}>
                    None
                  </button>
                </div>
              </div>
              <p className="panel-help tight school-help">
                Check Varsity and/or JV for each school.
              </p>
              <ul className="school-list">
                {data.schools.map((school) => {
                  const levels = schoolLevels[school.id] ?? {
                    varsity: false,
                    jv: false,
                  };
                  const on = isSchoolActive(levels);
                  const isKid = school.id === kidSchoolId;
                  return (
                    <li key={school.id}>
                      <div
                        className={`school-card ${on ? "on" : ""} ${isKid ? "kid" : ""}`}
                        style={
                          {
                            "--school": school.primary,
                            "--school-alt": school.secondary,
                          } as CSSProperties
                        }
                      >
                        <div className="school-card__top">
                          <span className="swatch" />
                          <span className="school-chip__text">
                            <strong>
                              {school.shortName}
                              {isKid ? " · kid" : ""}
                            </strong>
                            <small>{school.city}</small>
                          </span>
                        </div>
                        <div className="school-card__levels">
                          <label
                            className={`level-check ${levels.varsity ? "on" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={levels.varsity}
                              onChange={(e) =>
                                setSchoolLevel(
                                  school.id,
                                  "varsity",
                                  e.target.checked
                                )
                              }
                            />
                            <span>Varsity</span>
                          </label>
                          <label
                            className={`level-check ${levels.jv ? "on" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={levels.jv}
                              onChange={(e) =>
                                setSchoolLevel(school.id, "jv", e.target.checked)
                              }
                            />
                            <span>JV</span>
                          </label>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="panel export">
              <h2>Google Calendar</h2>
              <p>
                Download an <code>.ics</code> file, then in Google Calendar
                choose <strong>Settings → Import &amp; export → Import</strong>.
              </p>
              <button
                type="button"
                className="btn primary"
                onClick={exportCalendar}
              >
                Download .ics ({events.length} events)
              </button>
            </section>

            <p className="meta">
              {events.length} games shown
              {openTimesOnly ? " · open times" : ""} · Source {data.source}
            </p>
          </aside>

          <main className="calendar-wrap">
            <Calendar
              localizer={localizer}
              events={events}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              startAccessor="start"
              endAccessor="end"
              style={{ height: "100%" }}
              eventPropGetter={eventPropGetter}
              onSelectEvent={(event) => setSelected(event as CalendarEvent)}
              popup
              components={{
                agenda: {
                  event: ({ event }) => (
                    <MatchupLabel event={event as CalendarEvent} />
                  ),
                },
              }}
              views={{
                month: true,
                week: WeekGamesView,
                day: DayGamesView,
                agenda: true,
              }}
              tooltipAccessor={(event) => (event as CalendarEvent).title}
            />
          </main>
        </div>

        {selected && (
          <div
            className="modal-backdrop"
            onClick={() => setSelected(null)}
            role="presentation"
          >
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              style={
                {
                  "--school": selected.resource.schoolMeta.primary,
                } as CSSProperties
              }
            >
              <button
                type="button"
                className="modal__close"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                ×
              </button>
              <div className="modal__bar" />
              <p className="modal__level">
                {selected.resource.school} · {selected.resource.level}
              </p>
              <h3>
                {selected.resource.home ? "vs" : "@"}{" "}
                {selected.resource.opponent}
              </h3>
              <dl className="modal__facts">
                <div>
                  <dt>Date</dt>
                  <dd>
                    {format(selected.start, "EEEE, MMM d, yyyy")}
                    {selected.resource.endDate
                      ? ` – ${format(parseISO(selected.resource.endDate), "MMM d")}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>
                    {selected.resource.time
                      ? format(selected.start, "h:mm a")
                      : "TBD / all day"}
                  </dd>
                </div>
                <div>
                  <dt>Site</dt>
                  <dd>{gameLocationLabel(selected.resource)}</dd>
                </div>
              </dl>
              <div className="modal__actions">
                <a
                  className="btn primary"
                  href={googleEventUrl(selected)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Add to Google Calendar
                </a>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ParentWatchProvider>
  );
}

export default App;
