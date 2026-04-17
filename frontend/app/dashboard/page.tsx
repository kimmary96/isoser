"use client";

import { useEffect, useState } from "react";

import { DashboardCalendarSection } from "@/app/dashboard/_components/dashboard-calendar-section";
import { getDashboardMe } from "@/lib/api/app";

function formatUserName(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || "사용자";
}

export default function DashboardPage() {
  const [userName, setUserName] = useState("사용자");

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const meResult = await getDashboardMe();
        if (!mounted) return;
        setUserName(formatUserName(meResult.user?.displayName));
      } catch {
        if (!mounted) return;
        setUserName("사용자");
      }
    };

    void loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            안녕하세요, {userName}님
          </h1>
        </header>

        <DashboardCalendarSection />
      </div>
    </div>
  );
}
