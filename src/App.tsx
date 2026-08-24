import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  type CSSProperties,
} from "react";
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
import {
  buildKidBusyMap,
  conflictsWithKid,
  buildPlayingByDate,
  isSchoolActive,
  schoolAllowsLevel,
  type SchoolLevelsMap,
} from "./lib/conflicts";
import { buildIcs, downloadIcs, googleEventUrl } from "./lib/ics";
import { WeekGamesView, DayGamesView } from "./components/GamesOnlyView";
import { FilterSidebar } from "./components/FilterSidebar";
import { MobileNav, type MobileTab } from "./components/MobileNav";
import { MatchupLabel } from "./components/MatchupLabel";
import { ParentWatchProvider } from "./components/ParentWatchContext";
import { MOBILE_QUERY, useMediaQuery } from "./hooks/useMediaQuery";
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
const STORAGE_KEY = "phoenix-big-dawgs-filters";

type StoredFilters = {
  schoolLevels?: SchoolLevelsMap;
  kidSchoolId?: string | null;
  kidVarsity?: boolean;
  kidJv?: boolean;
  openTimesOnly?: boolean;
  view?: View;
  date?: string;
};

function defaultSchoolLevels(both = true): SchoolLevelsMap {
  return Object.fromEntries(
    ALL_SCHOOL_IDS.map((id) => [id, { varsity: both, jv: both }])
  );
}

function loadStored(): StoredFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredFilters;
  } catch {
    return {};
  }
}

function mergeSchoolLevels(stored?: SchoolLevelsMap): SchoolLevelsMap {
  const base = defaultSchoolLevels(true);
  if (!stored) return base;
  for (const id of ALL_SCHOOL_IDS) {
    if (stored[id]) {
      base[id] = {
        varsity: Boolean(stored[id].varsity),
        jv: Boolean(stored[id].jv),
      };
    }
  }
  return base;
}

function App() {
  const stored = useMemo(() => loadStored(), []);

  const [schoolLevels, setSchoolLevels] = useState<SchoolLevelsMap>(() =>
    mergeSchoolLevels(stored.schoolLevels)
  );
  const [kidSchoolId, setKidSchoolId] = useState<string | null>(
    () => stored.kidSchoolId ?? null
  );
  const [kidVarsity, setKidVarsity] = useState(() => stored.kidVarsity ?? true);
  const [kidJv, setKidJv] = useState(() => stored.kidJv ?? true);
  const [openTimesOnly, setOpenTimesOnly] = useState(
    () => stored.openTimesOnly ?? false
  );
  const [view, setView] = useState<View>(() => stored.view ?? "month");
  const [date, setDate] = useState(() =>
    stored.date ? parseISO(stored.date) : parseISO("2026-08-24")
  );
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [mobileTab, setMobileTab] = useState<MobileTab>("calendar");

  const calendarView = isMobile && view === "month" ? "week" : view;

  // Persist kid + school filters across view changes and reloads
  useEffect(() => {
    const payload: StoredFilters = {
      schoolLevels,
      kidSchoolId,
      kidVarsity,
      kidJv,
      openTimesOnly,
      view,
      date: format(date, "yyyy-MM-dd"),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    schoolLevels,
    kidSchoolId,
    kidVarsity,
    kidJv,
    openTimesOnly,
    view,
    date,
  ]);

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

  const agendaComponents = useMemo(
    () => ({
      agenda: {
        event: ({ event }: { event: object }) => (
          <MatchupLabel event={event as CalendarEvent} />
        ),
      },
    }),
    []
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
      Object.fromEntries(ALL_SCHOOL_IDS.map((id) => [id, { varsity, jv }]))
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

  const calendarViews = useMemo(
    () =>
      isMobile
        ? ({
            week: WeekGamesView,
            day: DayGamesView,
            agenda: true,
          } as const)
        : ({
            month: true,
            week: WeekGamesView,
            day: DayGamesView,
            agenda: true,
          } as const),
    [isMobile]
  );

  const kidSchoolLabel = kidSchool
    ? `${kidSchool.shortName}${kidLevels.length === 1 ? ` ${kidLevels[0]}` : ""}`
    : null;

  const filtersActive = Boolean(kidSchoolId || openTimesOnly);

  const showCalendar = !isMobile || mobileTab === "calendar";
  const showFilters = !isMobile || mobileTab === "filters";

  return (
    <ParentWatchProvider value={parentWatchValue}>
      <div className={`app ${isMobile ? "is-mobile" : "is-desktop"}`}>
        <header className={`hero ${isMobile ? "hero--compact" : ""}`}>
          <div className="hero__bg" aria-hidden />
          <div className="hero__content">
            <p className="eyebrow">Fall 2026 · MSHSAA</p>
            <h1>Phoenix - Big Dawgs</h1>
            {!isMobile ? <div className="hero__rule" aria-hidden /> : null}
          </div>
          {isMobile && showCalendar ? (
            <button
              type="button"
              className="hero__filter-btn"
              onClick={() => setMobileTab("filters")}
              aria-label="Open filters"
            >
              Filters
              {filtersActive ? (
                <span className="hero__filter-dot" aria-hidden />
              ) : null}
            </button>
          ) : null}
        </header>

        <div
          className={`layout ${isMobile ? "layout--mobile" : ""} ${showCalendar ? "show-calendar" : ""} ${showFilters ? "show-filters" : ""}`}
        >
          {showFilters ? (
            <FilterSidebar
              data={data}
              schoolLevels={schoolLevels}
              setSchoolLevel={setSchoolLevel}
              setAllLevels={setAllLevels}
              kidSchoolId={kidSchoolId}
              setKidSchoolId={setKidSchoolId}
              kidVarsity={kidVarsity}
              setKidVarsity={setKidVarsity}
              kidJv={kidJv}
              setKidJv={setKidJv}
              openTimesOnly={openTimesOnly}
              setOpenTimesOnly={setOpenTimesOnly}
              openTimesReady={openTimesReady}
              kidSchoolLabel={kidSchoolLabel}
              eventsCount={events.length}
              openTimesOnlyActive={openTimesOnly}
              onExport={exportCalendar}
              onDone={isMobile ? () => setMobileTab("calendar") : undefined}
              isMobile={isMobile}
            />
          ) : null}

          {showCalendar ? (
            <main className="calendar-wrap">
              <Calendar
                localizer={localizer}
                events={events}
                view={calendarView}
                onView={setView}
                date={date}
                onNavigate={setDate}
                startAccessor="start"
                endAccessor="end"
                style={{ height: "100%" }}
                eventPropGetter={eventPropGetter}
                onSelectEvent={(event) => setSelected(event as CalendarEvent)}
                popup
                components={agendaComponents}
                views={calendarViews}
                tooltipAccessor={(event) => (event as CalendarEvent).title}
              />
            </main>
          ) : null}
        </div>

        {isMobile ? (
          <MobileNav
            active={mobileTab}
            onChange={setMobileTab}
            eventsCount={events.length}
            filtersActive={filtersActive}
          />
        ) : null}

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
