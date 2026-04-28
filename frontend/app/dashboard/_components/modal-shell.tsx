"use client";

import type { ReactNode } from "react";

type ModalShellProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
  panelClassName?: string;
  bodyClassName?: string;
  scrollBody?: boolean;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  children,
  footer,
  maxWidthClassName = "max-w-3xl",
  panelClassName = "",
  bodyClassName = "px-6 py-5",
  scrollBody = false,
  titleClassName = "mt-1 text-2xl font-bold text-slate-900",
  subtitleClassName = "mt-2 text-sm leading-6 text-slate-500",
}: ModalShellProps) {
  if (!open) return null;

  const panelLayoutClassName = scrollBody
    ? "flex max-h-[92vh] flex-col overflow-hidden"
    : "max-h-[92vh] overflow-y-auto";
  const bodyLayoutClassName = scrollBody ? `min-h-0 flex-1 overflow-y-auto ${bodyClassName}` : bodyClassName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div
        className={`${panelLayoutClassName} w-full rounded-3xl border border-slate-200 bg-white shadow-2xl ${maxWidthClassName} ${panelClassName}`.trim()}
      >
        {(title || subtitle || eyebrow) && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div className="min-w-0">
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                  {eyebrow}
                </p>
              )}
              {title && <h2 className={titleClassName}>{title}</h2>}
              {subtitle && <p className={subtitleClassName}>{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-1.5 text-2xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        )}

        <div className={bodyLayoutClassName}>{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-slate-100 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
