import Image from "next/image";

import type { ProgramListRow } from "@/lib/types";

type ProviderBrandDefinition = {
  match: (program: ProgramListRow) => boolean;
  label: string;
  src: string;
  width: number;
  height: number;
  imageClassName?: string;
};

function getProviderSearchText(program: ProgramListRow): string {
  return [program.source, program.provider].filter(Boolean).join(" ").toLowerCase();
}

const BRAND_DEFINITIONS: ProviderBrandDefinition[] = [
  {
    match: (program) => {
      const text = getProviderSearchText(program);
      return text.includes("고용24") || text.includes("work24");
    },
    label: "고용24",
    src: "/program-logos/work24.svg",
    width: 106,
    height: 33,
    imageClassName: "max-h-7 w-auto",
  },
  {
    match: (program) => {
      const text = getProviderSearchText(program);
      return text.includes("k-startup") || text.includes("kstartup");
    },
    label: "K-Startup",
    src: "/program-logos/kstartup.svg",
    width: 300,
    height: 72,
    imageClassName: "max-h-7 w-auto",
  },
  {
    match: (program) => {
      const text = getProviderSearchText(program);
      return text.includes("sesac");
    },
    label: "SeSAC",
    src: "/program-logos/sesac.svg",
    width: 360,
    height: 88,
    imageClassName: "max-h-8 w-auto",
  },
];

function normalizeFallbackLabel(program: ProgramListRow): string {
  return (
    program.provider?.trim() ||
    program.source?.trim() ||
    "기관 정보"
  );
}

export function ProgramProviderBrand({ program }: { program: ProgramListRow }) {
  const brand = BRAND_DEFINITIONS.find((candidate) => candidate.match(program));
  if (brand) {
    return (
      <div
        className="inline-flex min-h-10 min-w-0 items-center rounded-xl border border-slate-200 bg-white px-3 py-2"
        title={brand.label}
      >
        <Image
          src={brand.src}
          alt={brand.label}
          width={brand.width}
          height={brand.height}
          className={`block object-contain ${brand.imageClassName ?? "max-h-7 w-auto"}`}
          loading="lazy"
        />
      </div>
    );
  }

  const label = normalizeFallbackLabel(program);

  return (
    <div
      className="inline-flex min-w-0 items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
      title={label}
    >
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-500 text-[11px] font-black text-white">
        {label.slice(0, 1).toUpperCase()}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}
