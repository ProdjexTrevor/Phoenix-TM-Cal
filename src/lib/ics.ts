import type { CalendarEvent } from "../types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Format as floating local time for ICS (no Z) so Google keeps Central time. */
function formatLocal(dt: Date, allDay: boolean) {
  if (allDay) {
    return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
  }
  return (
    `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}` +
    `T${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`
  );
}

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function buildIcs(events: CalendarEvent[], calendarName: string) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Phoenix - Big Dawgs//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-WR-TIMEZONE:America/Chicago",
  ];

  for (const event of events) {
    const g = event.resource;
    const stamp = formatLocal(new Date(), false);
    const start = formatLocal(event.start, event.allDay);
    const end = formatLocal(event.end, event.allDay);
    const loc =
      g.location ||
      (g.home ? `${g.school} (Home)` : `${g.opponent} (Away)`);
    const desc = [
      `${g.school} Softball — ${g.level}`,
      g.home ? `vs ${g.opponent}` : `@ ${g.opponent}`,
      g.canceled ? "CANCELED" : null,
      g.tournament ? "Tournament / special event" : null,
      `Source: MSHSAA ${g.school}`,
    ]
      .filter(Boolean)
      .join("\\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@softball-combined`,
      `DTSTAMP:${stamp}`,
      event.allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
      event.allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(desc.replace(/\\n/g, "\n")).replace(/\n/g, "\\n")}`,
      `LOCATION:${escapeText(loc)}`,
      `CATEGORIES:${escapeText(g.school)},${escapeText(g.level)}`,
      g.canceled ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(ics: string, filename: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Opens Google Calendar with a single event (best-effort deep link). */
export function googleEventUrl(event: CalendarEvent) {
  const g = event.resource;
  const format = (d: Date, allDay: boolean) => {
    if (allDay) {
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    }
    const y = d.getUTCFullYear();
    const m = pad(d.getUTCMonth() + 1);
    const day = pad(d.getUTCDate());
    const h = pad(d.getUTCHours());
    const min = pad(d.getUTCMinutes());
    const s = pad(d.getUTCSeconds());
    return `${y}${m}${day}T${h}${min}${s}Z`;
  };

  const dates = `${format(event.start, event.allDay)}/${format(event.end, event.allDay)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    details: `${g.school} ${g.level} softball`,
    location: g.location || (g.home ? `${g.school} Home` : g.opponent),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
