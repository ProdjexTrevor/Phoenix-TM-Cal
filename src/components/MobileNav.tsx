type MobileTab = "calendar" | "filters";

type MobileNavProps = {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  eventsCount: number;
  filtersActive: boolean;
};

export function MobileNav({
  active,
  onChange,
  eventsCount,
  filtersActive,
}: MobileNavProps) {
  return (
    <nav className="mobile-nav" aria-label="Main">
      <button
        type="button"
        className={`mobile-nav__btn ${active === "calendar" ? "active" : ""}`}
        onClick={() => onChange("calendar")}
        aria-current={active === "calendar" ? "page" : undefined}
      >
        <span className="mobile-nav__icon mobile-nav__icon--calendar" aria-hidden />
        <span className="mobile-nav__label">Calendar</span>
        <span className="mobile-nav__meta">{eventsCount}</span>
      </button>
      <button
        type="button"
        className={`mobile-nav__btn ${active === "filters" ? "active" : ""}`}
        onClick={() => onChange("filters")}
        aria-current={active === "filters" ? "page" : undefined}
      >
        <span className="mobile-nav__icon mobile-nav__icon--filters" aria-hidden />
        <span className="mobile-nav__label">Filters</span>
        {filtersActive ? (
          <span className="mobile-nav__dot" aria-label="Filters active" />
        ) : null}
      </button>
    </nav>
  );
}

export type { MobileTab };
