"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { tickerLoop, toneClassMap } from "./_content";
import { getHeaderInitial, type HeaderUser, useLandingAUser } from "./_auth";

type BrandMarkProps = {
  compact?: boolean;
  className?: string;
  subtitle?: string;
};

type AuthActionProps = {
  user: HeaderUser;
  authChecked: boolean;
  authenticatedHref: string;
  authenticatedLabel?: string;
  unauthenticatedLabel: string;
  compact?: boolean;
};

type HeaderLink = {
  href: string;
  label: string;
  mobileLabel?: string;
};

const landingAHeaderLinks: HeaderLink[] = [
  { href: "/programs", label: "프로그램 상세", mobileLabel: "상세" },
  { href: "/compare", label: "비교" },
  { href: "/dashboard#recommend-calendar", label: "대시보드" },
];

function BrandMark({ compact = false, className = "", subtitle }: BrandMarkProps) {
  return (
    <Link href="/landing-a" className={className}>
      <div>
        <div className={`${compact ? "text-xl tracking-[-0.04em]" : "text-xl tracking-[-0.05em]"} font-extrabold text-[var(--ink)]`}>
          이소<span className="text-[var(--sky)]">서</span>
        </div>
        {subtitle ? (
          <p className="hidden text-[10px] uppercase tracking-[0.28em] text-[var(--muted)] sm:block">{subtitle}</p>
        ) : null}
      </div>
    </Link>
  );
}

function UserAvatar({ user, size }: { user: NonNullable<HeaderUser>; size: 28 | 32 }) {
  const sizeClass = size === 32 ? "h-8 w-8" : "h-7 w-7";

  if (user.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt={`${user.displayName} 프로필 이미지`}
        width={size}
        height={size}
        sizes={`${size}px`}
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-white`}>
      {getHeaderInitial(user.displayName)}
    </span>
  );
}

function AuthAction({
  user,
  authChecked,
  authenticatedHref,
  authenticatedLabel,
  unauthenticatedLabel,
  compact = false,
}: AuthActionProps) {
  if (authChecked && user) {
    return (
      <Link
        href={authenticatedHref}
        className={
          compact
            ? "inline-flex min-w-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-white sm:px-3 sm:py-2 sm:text-sm"
            : "relative z-[1] inline-flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-white"
        }
      >
        <UserAvatar user={user} size={compact ? 28 : 32} />
        <span className={compact ? "hidden max-w-24 truncate sm:inline" : "hidden sm:inline"}>{user.displayName}</span>
        {authenticatedLabel ? <span className="text-[var(--sub)]">{authenticatedLabel}</span> : null}
      </Link>
    );
  }

  return (
    <Link
      href="/login"
      className={
        compact
          ? "rounded-full bg-[var(--fire)] px-3 py-2 text-xs font-bold text-white shadow-[0_12px_32px_rgba(249,115,22,0.18)] transition hover:bg-[var(--fire-lo)] sm:px-4 sm:text-sm"
          : "relative z-[1] rounded-full bg-[var(--fire)] px-4 py-2 text-sm font-bold text-white shadow-[0_12px_32px_rgba(249,115,22,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--fire-lo)]"
      }
    >
      {unauthenticatedLabel}
    </Link>
  );
}

export function LandingATickerBar() {
  return (
    <div className="sticky top-0 z-[220] h-9 overflow-hidden bg-[var(--red)] text-white">
      <div className="ticker-track flex h-full min-w-max items-center">
        {tickerLoop.map((item, index) => (
          <div key={`${item.text}-${index}`} className="ticker-item inline-flex items-center gap-3 px-6">
            <span className={`h-2 w-2 rounded-full ${toneClassMap[item.tone]}`} />
            <span className="text-[11px] font-bold tracking-[0.02em] sm:text-xs">{item.text}</span>
            <span className="opacity-50">|</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingANavBar() {
  const pathname = usePathname();
  const { user, authChecked } = useLandingAUser();

  const isCompareActive = pathname.startsWith("/compare");
  const isProgramsActive = pathname.startsWith("/programs") && !isCompareActive;
  const isDashboardActive = pathname.startsWith("/dashboard");

  return (
    <nav className="sticky top-9 z-[230] isolate border-b border-[var(--border)] bg-white/92 px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <BrandMark className="relative z-[1] flex items-center gap-3" subtitle="Public Program Finder" />

        <div className="ml-auto hidden items-center gap-7 text-sm text-[var(--sub)] md:flex">
          <Link href="/programs" className={`relative z-[1] transition hover:text-[var(--ink)] ${isProgramsActive ? "text-[var(--ink)]" : ""}`}>
            프로그램 탐색
          </Link>
          <Link href="/compare" className={`relative z-[1] transition hover:text-[var(--ink)] ${isCompareActive ? "text-[var(--ink)]" : ""}`}>
            비교
          </Link>
          <Link href="/dashboard" className={`relative z-[1] transition hover:text-[var(--ink)] ${isDashboardActive ? "text-[var(--ink)]" : ""}`}>
            워크스페이스
          </Link>
        </div>

        <AuthAction
          user={user}
          authChecked={authChecked}
          authenticatedHref="/dashboard"
          authenticatedLabel="워크스페이스"
          unauthenticatedLabel="무료로 시작하기"
        />
      </div>
    </nav>
  );
}

export function LandingAHeader() {
  const { user, authChecked } = useLandingAUser();

  return (
    <header className="sticky top-0 z-[230] border-b border-[var(--border)] bg-white/92 px-3 py-3 backdrop-blur-xl sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl items-center gap-2 sm:gap-4">
        <BrandMark compact className="shrink-0" />

        <nav aria-label="랜딩 A 주요 이동" className="ml-auto hidden items-center gap-6 text-sm font-semibold text-[var(--sub)] md:flex">
          {landingAHeaderLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-[var(--ink)]">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2 md:ml-0">
          {landingAHeaderLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-[var(--border)] bg-white px-2.5 py-2 text-xs font-semibold text-[var(--sub)] transition hover:border-[var(--blue)] hover:text-[var(--blue)] sm:px-3 md:hidden"
            >
              {link.mobileLabel ?? link.label}
            </Link>
          ))}

          <AuthAction
            user={user}
            authChecked={authChecked}
            authenticatedHref="/dashboard/profile"
            unauthenticatedLabel="로그인"
            compact
          />
        </div>
      </div>
    </header>
  );
}
