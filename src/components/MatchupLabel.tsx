import type { CalendarEvent } from "../types";
import { gameLocationLabel } from "../lib/events";

/** Matchup with home team bolded and venue appended. */
export function MatchupLabel({ event }: { event: CalendarEvent }) {
  const g = event.resource;
  const level = g.level === "JV" ? "JV" : "V";
  const location = gameLocationLabel(g);

  return (
    <span className="matchup-label">
      {g.home ? (
        <>
          <strong>{g.school}</strong> {level} vs {g.opponent}
        </>
      ) : (
        <>
          {g.school} {level} @ <strong>{g.opponent}</strong>
        </>
      )}
      {location ? <span className="matchup-label__loc"> - {location}</span> : null}
    </span>
  );
}
