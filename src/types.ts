export type GameLevel = "Varsity" | "JV" | "Freshman";

export interface School {
  id: string;
  name: string;
  shortName: string;
  city: string;
  primary: string;
  secondary: string;
  mashsaaId: number;
}

export interface Game {
  id: string;
  schoolId: string;
  school: string;
  opponent: string;
  level: GameLevel;
  date: string;
  endDate: string | null;
  time: string | null;
  start: string;
  home: boolean;
  location: string | null;
  tournament: boolean;
  canceled: boolean;
}

export interface ScheduleData {
  season: string;
  generatedAt: string;
  source: string;
  schools: School[];
  games: Game[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: Game & { schoolMeta: School };
}
