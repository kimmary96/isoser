"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { getDashboardMe } from "@/lib/api/app";
import { DEFAULT_PUBLIC_LANDING, DASHBOARD_RECOMMEND_CALENDAR, getLoginHref } from "@/lib/routes";

type HeaderUser = {
  displayName: string;
  avatarUrl: string | null;
} | null;

type HeaderLink = {
  href: string;
  label: string;
  mobileLabel?: string;
};

const landingHeaderLinks: HeaderLink[] = [
  { href: "/programs", label: "프로그램 탐색", mobileLabel: "탐색" },
  { href: "/compare", label: "비교" },
  { href: DASHBOARD_RECOMMEND_CALENDAR, label: "대시보드" },
];

const headerVars = {
  "--ink": "#0A1325",
  "--sub": "#5B6E8A",
  "--sky": "#8FC2FF",
  "--blue": "#2B6FF2",
  "--fire": "#F97316",
  "--fire-lo": "#EA580C",
  "--surface": "#F4F7FB",
  "--border": "#D8E3F2",
} as CSSProperties;

function getHeaderInitial(name: string | null | undefined) {
  const initial = name?.trim()?.slice(0, 1);
  return initial ? initial.toUpperCase() : "U";
}

function useLandingUser() {
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

function UserAvatar({ user, size }: { user: NonNullable<HeaderUser>; size: 28 }) {
  if (user.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt={`${user.displayName} 프로필 이미지`}
        width={size}
        height={size}
        sizes={`${size}px`}
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-white">
      {getHeaderInitial(user.displayName)}
    </span>
  );
}

function AuthAction({ user, authChecked }: { user: HeaderUser; authChecked: boolean }) {
  if (authChecked && user) {
    return (
      <Link
        href="/dashboard/profile"
        className="inline-flex min-w-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-white sm:px-3 sm:py-2 sm:text-sm"
      >
        <UserAvatar user={user} size={28} />
        <span className="hidden max-w-24 truncate sm:inline">{user.displayName}</span>
      </Link>
    );
  }

  return (
    <Link
      href={getLoginHref(DASHBOARD_RECOMMEND_CALENDAR)}
      className="rounded-full bg-[var(--fire)] px-3 py-2 text-xs font-bold text-white shadow-[0_12px_32px_rgba(249,115,22,0.18)] transition hover:bg-[var(--fire-lo)] sm:px-4 sm:text-sm"
    >
      로그인
    </Link>
  );
}

export function LandingHeader() {
  const { user, authChecked } = useLandingUser();

  return (
    <header className="sticky top-0 z-[230] border-b border-[var(--border)] bg-white/92 px-3 py-3 backdrop-blur-xl sm:px-8 lg:px-12" style={headerVars}>
      <div className="mx-auto flex max-w-6xl items-center gap-2 sm:gap-4">
        <Link href={DEFAULT_PUBLIC_LANDING} className="shrink-0">
          <div className="text-xl font-extrabold tracking-[-0.04em] text-[var(--ink)]">
            이소<span className="text-[var(--sky)]">서</span>
          </div>
        </Link>

        <nav aria-label="공개 랜딩 주요 이동" className="ml-auto hidden items-center gap-6 text-sm font-semibold text-[var(--sub)] md:flex">
          {landingHeaderLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-[var(--ink)]">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2 md:ml-0">
          {landingHeaderLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-[var(--border)] bg-white px-2.5 py-2 text-xs font-semibold text-[var(--sub)] transition hover:border-[var(--blue)] hover:text-[var(--blue)] sm:px-3 md:hidden"
            >
              {link.mobileLabel ?? link.label}
            </Link>
          ))}

          <AuthAction user={user} authChecked={authChecked} />
        </div>
      </div>
    </header>
  );
}
