"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

type ProgramBookmarkStateContextValue = {
  isBookmarked: (programId: string) => boolean;
  setBookmarked: (programId: string, bookmarked: boolean) => void;
};

const ProgramBookmarkStateContext = createContext<ProgramBookmarkStateContextValue | null>(null);

type ProgramBookmarkStateProviderProps = {
  initialBookmarkedProgramIds: string[];
  children: ReactNode;
};

function normalizeProgramIds(programIds: string[]): Set<string> {
  return new Set(programIds.map((programId) => String(programId).trim()).filter(Boolean));
}

export function ProgramBookmarkStateProvider({
  initialBookmarkedProgramIds,
  children,
}: ProgramBookmarkStateProviderProps) {
  const [bookmarkedProgramIds, setBookmarkedProgramIds] = useState(() =>
    normalizeProgramIds(initialBookmarkedProgramIds)
  );

  const isBookmarked = useCallback(
    (programId: string) => bookmarkedProgramIds.has(programId),
    [bookmarkedProgramIds]
  );

  const setBookmarked = useCallback((programId: string, bookmarked: boolean) => {
    const normalizedProgramId = String(programId).trim();
    if (!normalizedProgramId) return;

    setBookmarkedProgramIds((currentProgramIds) => {
      const nextProgramIds = new Set(currentProgramIds);
      if (bookmarked) {
        nextProgramIds.add(normalizedProgramId);
      } else {
        nextProgramIds.delete(normalizedProgramId);
      }
      return nextProgramIds;
    });
  }, []);

  const value = useMemo(
    () => ({
      isBookmarked,
      setBookmarked,
    }),
    [isBookmarked, setBookmarked]
  );

  return <ProgramBookmarkStateContext.Provider value={value}>{children}</ProgramBookmarkStateContext.Provider>;
}

export function useProgramBookmarkState() {
  return useContext(ProgramBookmarkStateContext);
}
