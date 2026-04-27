import Link from "next/link";

import {
  getProgramDeadline,
  getProgramDeadlineTone,
  getProgramDetailHref,
} from "@/components/landing/program-card-helpers";
import { cx, iso } from "@/components/ui/isoser-ui";
import { DASHBOARD_RECOMMEND_CALENDAR, ONBOARDING_RESUME_IMPORT, getLoginHref } from "@/lib/routes";
import type { ProgramListRow } from "@/lib/types";

import { sourceLabel } from "./_program-utils";

type LandingCHeroSectionProps = {
  heroPrograms: ProgramListRow[];
};

export function LandingCHeroSection({ heroPrograms }: LandingCHeroSectionProps) {
  return (
    <section className={cx("px-5 py-14 sm:px-8 lg:px-12 lg:py-20", iso.headerBand)}>
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_504px] lg:items-center">
        <div>
          <div className="inline-flex rounded-lg bg-[var(--surface-strong)] px-4 py-2 text-sm font-extrabold text-[var(--indigo)]">
            <span className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--teal)]" />
            PUBLIC SUPPORT PROGRAMS
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[1.04] tracking-[-0.06em] text-[var(--ink)] sm:text-6xl">
            흩어진 국비 지원 정보,<br />
            <span className="text-[var(--indigo)]">
              내 상황에 맞는 것만<br />골라드립니다
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-[var(--sub)]">
            고용24, HRD넷, K-디지털, 서울시 일자리까지 한곳에 모았습니다.
            <br />
            이력과 활동을 등록하면 나에게 맞는 프로그램을 추천하고,
            <br />
            지원에 필요한 이력서·포트폴리오까지 바로 준비합니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/programs" className={cx("rounded-full px-6 py-3 text-sm font-black", iso.primaryButton)}>
              지금 지원 가능한 프로그램 보기
            </Link>
            <Link
              href={getLoginHref(ONBOARDING_RESUME_IMPORT)}
              className={cx("rounded-full px-6 py-3 text-sm font-black", iso.secondaryButton)}
            >
              내 이력 등록
            </Link>
          </div>
        </div>

        <aside className={cx("rounded-[28px] p-5", iso.glassPanel)}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--muted)]">Live Board</div>
              <div className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--ink)]">추천 공고 {heroPrograms.length}건</div>
            </div>
            <Link href={DASHBOARD_RECOMMEND_CALENDAR} className="rounded-full bg-[var(--fire)] px-3 py-1.5 text-xs font-black text-white">
              워크스페이스 →
            </Link>
          </div>
          <div className="space-y-3 border-t border-[var(--border)] pt-3">
            {heroPrograms.map((program) => (
              <Link key={`${program.id}-${program.title}`} href={getProgramDetailHref(program)} className="block rounded-[18px] border border-[var(--border)] bg-white/80 p-4 transition hover:border-[var(--indigo)] hover:bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{sourceLabel(program)}</div>
                    <div className="mt-2 text-sm font-black leading-6 text-[var(--ink)]">{program.title || "추천 프로그램"}</div>
                    <div className="mt-2 text-xs font-bold text-[var(--sub)]">{program.category || "카테고리 미분류"}</div>
                  </div>
                  <div className={`min-w-[3.25rem] shrink-0 whitespace-nowrap text-right text-lg font-black ${getProgramDeadlineTone(program)}`}>
                    {getProgramDeadline(program)}
                  </div>
                </div>
              </Link>
            ))}
            {heroPrograms.length === 0 && (
              <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 text-sm font-bold text-[var(--sub)]">
                이번 주 안에 마감하는 모집중 공고가 있으면 이 영역에 표시됩니다.
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
