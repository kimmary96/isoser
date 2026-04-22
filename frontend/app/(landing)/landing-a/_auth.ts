"use client";

import { useEffect, useState } from "react";

import { getDashboardMe } from "@/lib/api/app";

export type HeaderUser = {
  displayName: string;
  avatarUrl: string | null;
} | null;

export function getHeaderInitial(name: string | null | undefined) {
  const initial = name?.trim()?.slice(0, 1);
  return initial ? initial.toUpperCase() : "U";
}

export function useLandingAUser() {
  const [user, setUser] = useState<HeaderUser>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const result = await getDashboardMe();
        if (!mounted) return;
        setUser(
          result.user
            ? {
                displayName: result.user.displayName,
                avatarUrl: result.user.avatarUrl,
              }
            : null
        );
      } catch {
        if (!mounted) return;
        setUser(null);
      } finally {
        if (mounted) {
          setAuthChecked(true);
        }
      }
    };

    void loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  return { user, authChecked };
}
