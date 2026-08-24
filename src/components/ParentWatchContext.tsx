import { createContext, useContext, type ReactNode } from "react";
import type { GameLevel, School } from "../types";
import type { BusyBlock, SchoolLevelsMap } from "../lib/conflicts";

export type ParentWatchState = {
  watchSchoolIds: string[];
  schools: School[];
  schoolLevels: SchoolLevelsMap;
  kidSchoolId: string | null;
  kidLevels: GameLevel[];
  openTimesOnly: boolean;
  kidBusyByDate: Map<string, BusyBlock[]>;
  /** "schoolId:V" / "schoolId:JV" playing on each date. */
  playingByDate: Map<string, Set<string>>;
};

const ParentWatchContext = createContext<ParentWatchState | null>(null);

export function ParentWatchProvider({
  value,
  children,
}: {
  value: ParentWatchState;
  children: ReactNode;
}) {
  return (
    <ParentWatchContext.Provider value={value}>
      {children}
    </ParentWatchContext.Provider>
  );
}

export function useParentWatch() {
  return useContext(ParentWatchContext);
}
