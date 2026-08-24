import type { CSSProperties } from "react";
import type { ScheduleData } from "../types";
import { isSchoolActive, type SchoolLevelsMap } from "../lib/conflicts";

type FilterSidebarProps = {
  data: ScheduleData;
  schoolLevels: SchoolLevelsMap;
  setSchoolLevel: (id: string, key: "varsity" | "jv", value: boolean) => void;
  setAllLevels: (varsity: boolean, jv: boolean) => void;
  kidSchoolId: string | null;
  setKidSchoolId: (id: string | null) => void;
  kidVarsity: boolean;
  setKidVarsity: (value: boolean) => void;
  kidJv: boolean;
  setKidJv: (value: boolean) => void;
  openTimesOnly: boolean;
  setOpenTimesOnly: (value: boolean) => void;
  openTimesReady: boolean;
  kidSchoolLabel: string | null;
  eventsCount: number;
  openTimesOnlyActive: boolean;
  onExport: () => void;
  onDone?: () => void;
  isMobile?: boolean;
};

export function FilterSidebar({
  data,
  schoolLevels,
  setSchoolLevel,
  setAllLevels,
  kidSchoolId,
  setKidSchoolId,
  kidVarsity,
  setKidVarsity,
  kidJv,
  setKidJv,
  openTimesOnly,
  setOpenTimesOnly,
  openTimesReady,
  kidSchoolLabel,
  eventsCount,
  openTimesOnlyActive,
  onExport,
  onDone,
  isMobile,
}: FilterSidebarProps) {
  return (
    <aside className="sidebar">
      {isMobile && onDone ? (
        <div className="mobile-filters-header">
          <h2>Filters</h2>
          <button type="button" className="btn done-btn" onClick={onDone}>
            Done
          </button>
        </div>
      ) : null}

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
          {openTimesOnly && kidSchoolLabel
            ? `Showing games that don’t conflict with ${kidSchoolLabel}.`
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
                          setSchoolLevel(school.id, "varsity", e.target.checked)
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
          Download an <code>.ics</code> file, then in Google Calendar choose{" "}
          <strong>Settings → Import &amp; export → Import</strong>.
        </p>
        <button type="button" className="btn primary" onClick={onExport}>
          Download .ics ({eventsCount} events)
        </button>
      </section>

      <p className="meta">
        {eventsCount} games shown
        {openTimesOnlyActive ? " · open times" : ""} · Source {data.source}
      </p>
    </aside>
  );
}
