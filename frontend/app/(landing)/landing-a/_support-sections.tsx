"use client";

import Image from "next/image";
import Link from "next/link";

import { featurePreviews, workspaceStages } from "./_content";

export function LandingAComparisonSection() {
  return (
    <section className="px-5 pb-14 sm:px-8 lg:px-12">
      <div className="section-shell soft-panel mx-auto max-w-6xl rounded-[32px] px-6 py-8 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--blue)]">Circular flow</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-[var(--ink)]">
            탐색한 프로그램은 다음 지원 준비로 이어집니다
          </h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {workspaceStages.map((stage) => (
            <div key={stage.step} className="rounded-[24px] border border-[var(--border)] bg-white px-4 py-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-white">
                {stage.step}
              </span>
              <h3 className="mt-4 text-base font-bold tracking-[-0.03em] text-[var(--ink)]">{stage.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--sub)]">{stage.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingAPreviewSection() {
  return (
    <section className="px-5 pb-14 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--blue)]">Product preview</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-[var(--ink)]">
            AI를 통해 이력서를 준비하고, 공고 매칭과 출력까지
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--sub)]">
            대시보드에서 이어질 핵심 기능을 미리 확인할 수 있습니다.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {featurePreviews.map((preview) => (
            <article
              key={preview.title}
              className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_16px_44px_rgba(10,19,37,0.05)]"
            >
              <div className="relative aspect-[16/10] bg-[var(--surface)]">
                <Image
                  src={preview.imageSrc}
                  alt={preview.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="px-6 py-5">
                <h3 className="text-xl font-bold tracking-[-0.04em] text-[var(--ink)]">{preview.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--sub)]">{preview.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingACtaSection() {
  return (
    <section className="px-5 pb-14 sm:px-8 lg:px-12">
      <div className="compare-shell mx-auto flex max-w-6xl flex-col gap-6 overflow-hidden rounded-[32px] px-6 py-10 text-[var(--ink)] sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Final CTA</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.05em] text-[var(--ink)] sm:text-4xl">
            준비가 되었다면
            <br />
            이력서를 준비해 보세요.
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--sub)]">
            흩어진 경력 한 번에 정리하고, 원하는 공고에 맞춰 작성해 보세요
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-[var(--fire)] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[var(--fire-lo)]"
          >
            무료로 시작하기
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white px-6 py-3.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--blue)] hover:text-[var(--blue)]"
          >
            대시보드 미리 보기
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LandingAFooter() {
  return (
    <footer className="bg-white px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 border-t border-[var(--border)] pt-8 text-sm text-[var(--sub)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-lg font-extrabold tracking-[-0.04em] text-[var(--ink)]">
            이소<span className="text-[var(--sky)]">서</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--sub)]">
            공공 취업 지원 탐색을 시작점으로, 개인화 추천과 문서 워크플로우까지 연결하는 커리어 SaaS.
          </p>
        </div>
        <div className="text-sm text-[var(--muted)]">© 2026 Isoser. Career support workspace.</div>
      </div>
    </footer>
  );
}
