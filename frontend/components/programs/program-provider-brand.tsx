import type { ProgramListRow } from "@/lib/types";

type ProviderBrandDefinition = {
  match: (program: ProgramListRow) => boolean;
  label: string;
  shortLabel: string;
  accentClassName: string;
  borderClassName: string;
  textClassName: string;
};

const BRAND_DEFINITIONS: ProviderBrandDefinition[] = [
  {
    match: (program) => {
      const text = [program.source, program.provider].filter(Boolean).join(" ").toLowerCase();
      return text.includes("고용24") || text.includes("work24");
    },
    label: "고용24",
    shortLabel: "24",
    accentClassName: "bg-sky-600",
    borderClassName: "border-sky-200",
    textClassName: "text-sky-700",
  },
  {
    match: (program) => {
      const text = [program.source, program.provider].filter(Boolean).join(" ").toLowerCase();
      return text.includes("k-startup") || text.includes("kstartup");
    },
    label: "K-Startup",
    shortLabel: "K",
    accentClassName: "bg-emerald-600",
    borderClassName: "border-emerald-200",
    textClassName: "text-emerald-700",
  },
  {
    match: (program) => {
      const text = [program.source, program.provider].filter(Boolean).join(" ").toLowerCase();
      return text.includes("sesac");
    },
    label: "SeSAC",
    shortLabel: "S",
    accentClassName: "bg-violet-600",
    borderClassName: "border-violet-200",
    textClassName: "text-violet-700",
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
  const label = brand?.label ?? normalizeFallbackLabel(program);
  const shortLabel = brand?.shortLabel ?? label.slice(0, 1).toUpperCase();

  return (
    <div
      className={`inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        brand?.borderClassName ?? "border-slate-200"
      } ${brand?.textClassName ?? "text-slate-700"}`}
      title={label}
    >
      <span
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white ${
          brand?.accentClassName ?? "bg-slate-500"
        }`}
      >
        {shortLabel}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}
