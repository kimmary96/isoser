"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { cx, iso } from "@/components/ui/isoser-ui";
import type { ProgramSort } from "@/lib/types";

import { DEFAULT_PROGRAM_SORT, isProgramSort, PROGRAM_SORT_OPTIONS } from "./program-sort";

export type ProgramsFilterChip = {
  label: string;
  href: string;
};

export type ProgramCategoryMenuOption = {
  id: string;
  label: string;
  category: string;
  dotClassName: string;
};

type ProgramsFilterBarProps = {
  q: string;
  selectedCategoryId: string;
  categoryOptions?: readonly ProgramCategoryMenuOption[];
  selectedRegions: string[];
  selectedTeachingMethods: string[];
  selectedCostTypes: string[];
  selectedParticipationTimes: string[];
  selectedSources: string[];
  selectedTargets: string[];
  showClosedRecent: boolean;
  sort: ProgramSort;
  activeFilters: ProgramsFilterChip[];
  regionOptions: readonly string[];
  teachingMethodOptions: readonly string[];
  costTypeOptions: readonly NamedFilterOption[];
  participationTimeOptions: readonly NamedFilterOption[];
  sourceOptions: readonly NamedFilterOption[];
  targetOptions: readonly NamedFilterOption[];
};

type FilterMenuOption = {
  value: string;
  label: string;
  dotClassName: string;
  trailing?: string;
};

export type NamedFilterOption = {
  value: string;
  label: string;
};

const SORT_DOT_COLORS = [
  "bg-violet-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-blue-500",
  "bg-teal-500",
  "bg-indigo-500",
] as const;

const FALLBACK_CATEGORY_OPTION: ProgramCategoryMenuOption = {
  id: "all",
  label: "전체",
  category: "전체",
  dotClassName: "bg-slate-400",
};

function FilterMenu({
  label,
  value,
  options,
  placeholder,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  options: readonly FilterMenuOption[];
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) || options[0];
  const displayLabel = selectedOption.value ? selectedOption.label : placeholder;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={label}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-12 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition hover:bg-slate-50 focus:border-orange-500"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${selectedOption.dotClassName}`} />
          <span className="truncate">{displayLabel}</span>
        </span>
        <span className={`ml-2 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {isOpen ? (
        <div className="absolute left-0 top-14 z-30 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
          <p className="px-4 pb-2 pt-1 text-xs font-semibold text-slate-500">{label}</p>
          {options.map((option) => {
            const isSelected = value === option.value;

            return (
              <button
                key={option.value || "all"}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-50 ${
                  isSelected ? "bg-orange-50 font-semibold text-orange-700" : "text-slate-700"
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${option.dotClassName}`} />
                <span className="min-w-0 flex-1 truncate text-left">{option.label}</span>
                {option.trailing ? <span className="text-slate-300">{option.trailing}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MultiFilterMenu({
  label,
  values,
  options,
  placeholder,
  onChange,
  columns = 1,
}: {
  label: string;
  values: string[];
  options: readonly NamedFilterOption[];
  placeholder: string;
  onChange: (values: string[]) => void;
  columns?: 1 | 2 | 3;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabels = options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);
  const displayLabel =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels[0]} 외 ${selectedLabels.length - 1}`;
  const gridClassName = columns === 3 ? "grid-cols-3" : columns === 2 ? "grid-cols-2" : "grid-cols-1";

  function toggleValue(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      setIsOpen(false);
      return;
    }
    onChange([...values, value]);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={label}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-12 w-full items-center justify-between rounded-2xl border bg-white px-3 text-sm font-medium outline-none transition hover:bg-slate-50 focus:border-orange-500 ${
          values.length ? "border-orange-300 text-orange-700" : "border-slate-200 text-slate-800"
        }`}
      >
        <span className="min-w-0 truncate">{displayLabel}</span>
        <span className={`ml-2 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {isOpen ? (
        <div className="absolute left-0 top-14 z-30 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white py-3 shadow-xl">
          <p className="px-4 pb-2 text-sm font-semibold text-slate-900">{label}</p>
          <div className={`grid ${gridClassName} gap-x-3 gap-y-1 px-3`}>
            {options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={values.includes(option.value)}
                  onChange={() => toggleValue(option.value)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="min-w-0 truncate">{option.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 border-t border-slate-100 px-3 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange([]);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <input
                type="checkbox"
                readOnly
                checked={values.length === 0}
                className="h-3.5 w-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              전체선택
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ProgramsFilterBar({
  q,
  selectedCategoryId,
  categoryOptions,
  selectedRegions,
  selectedTeachingMethods,
  selectedCostTypes,
  selectedParticipationTimes,
  selectedSources,
  selectedTargets,
  showClosedRecent,
  sort,
  activeFilters,
  regionOptions,
  teachingMethodOptions,
  costTypeOptions,
  participationTimeOptions,
  sourceOptions,
  targetOptions,
}: ProgramsFilterBarProps) {
  const [pendingCategoryId, setPendingCategoryId] = useState(selectedCategoryId);
  const [pendingTeachingMethod, setPendingTeachingMethod] = useState(selectedTeachingMethods[0] || "");
  const [pendingRegions, setPendingRegions] = useState<string[]>(selectedRegions);
  const [pendingCostTypes, setPendingCostTypes] = useState<string[]>(selectedCostTypes);
  const [pendingParticipationTimes, setPendingParticipationTimes] = useState<string[]>(selectedParticipationTimes);
  const [pendingSources, setPendingSources] = useState<string[]>(selectedSources);
  const [pendingTargets, setPendingTargets] = useState<string[]>(selectedTargets);
  const [pendingSort, setPendingSort] = useState<ProgramSort>(sort);
  const formRef = useRef<HTMLFormElement>(null);
  const sortInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPendingCategoryId(selectedCategoryId);
    setPendingTeachingMethod(selectedTeachingMethods[0] || "");
    setPendingRegions(selectedRegions);
    setPendingCostTypes(selectedCostTypes);
    setPendingParticipationTimes(selectedParticipationTimes);
    setPendingSources(selectedSources);
    setPendingTargets(selectedTargets);
    setPendingSort(sort);
  }, [
    selectedCategoryId,
    selectedTeachingMethods,
    selectedRegions,
    selectedCostTypes,
    selectedParticipationTimes,
    selectedSources,
    selectedTargets,
    sort,
  ]);

  const safeCategoryOptions =
    Array.isArray(categoryOptions) && categoryOptions.length ? categoryOptions : [FALLBACK_CATEGORY_OPTION];
  const selectedCategory =
    safeCategoryOptions.find((option) => option.id === pendingCategoryId) || safeCategoryOptions[0];
  const categoryMenuOptions: FilterMenuOption[] = safeCategoryOptions.map((option) => ({
    value: option.id === "all" ? "" : option.id,
    label: option.label,
    dotClassName: option.dotClassName,
    trailing: option.id !== "all" ? "›" : undefined,
  }));
  const teachingMenuOptions: FilterMenuOption[] = [
    { value: "", label: "온/오프라인 전체", dotClassName: "bg-slate-400" },
    ...teachingMethodOptions.map((method) => ({
      value: method,
      label: method,
      dotClassName: method === "온라인" ? "bg-blue-500" : method === "오프라인" ? "bg-sky-500" : "bg-cyan-500",
    })),
  ];
  const sortMenuOptions: FilterMenuOption[] = PROGRAM_SORT_OPTIONS.map((option, index) => ({
    value: option.value,
    label: option.label,
    dotClassName: SORT_DOT_COLORS[index] || "bg-slate-400",
  }));

  return (
    <section className={cx("rounded-3xl p-5 sm:p-6", iso.softPanel)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Program Search</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          지원 가능한 프로그램 찾기
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">핵심 조건을 먼저 고르고, 아래 검색창에서 키워드를 입력하세요.</p>
      </div>

      <form ref={formRef} method="GET" action="/programs" className="mt-6">
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-[repeat(8,minmax(116px,1fr))]">
          <input type="hidden" name="category_detail" value={pendingCategoryId === "all" ? "" : pendingCategoryId} />
          <input type="hidden" name="category" value={selectedCategory.category === "전체" ? "" : selectedCategory.category} />
          <FilterMenu
            label="카테고리"
            value={pendingCategoryId === "all" ? "" : pendingCategoryId}
            options={categoryMenuOptions}
            placeholder="카테고리"
            onChange={(value) => setPendingCategoryId(value || "all")}
          />

          <input type="hidden" name="teaching_methods" value={pendingTeachingMethod} />
          <FilterMenu
            label="수업 방식"
            value={pendingTeachingMethod}
            options={teachingMenuOptions}
            placeholder="온/오프라인 전체"
            onChange={setPendingTeachingMethod}
          />

          {pendingRegions.map((region) => (
            <input key={region} type="hidden" name="regions" value={region} />
          ))}
          <MultiFilterMenu
            label="지역"
            values={pendingRegions}
            options={regionOptions.map((region) => ({ value: region, label: region }))}
            placeholder="지역 전체"
            onChange={setPendingRegions}
            columns={3}
          />

          {pendingCostTypes.map((costType) => (
            <input key={costType} type="hidden" name="cost_types" value={costType} />
          ))}
          <MultiFilterMenu
            label="비용"
            values={pendingCostTypes}
            options={costTypeOptions}
            placeholder="비용 전체"
            onChange={setPendingCostTypes}
          />

          {pendingParticipationTimes.map((time) => (
            <input key={time} type="hidden" name="participation_times" value={time} />
          ))}
          <MultiFilterMenu
            label="참여 시간"
            values={pendingParticipationTimes}
            options={participationTimeOptions}
            placeholder="참여 시간 전체"
            onChange={setPendingParticipationTimes}
          />

          {pendingSources.map((source) => (
            <input key={source} type="hidden" name="sources" value={source} />
          ))}
          <MultiFilterMenu
            label="운영 기관"
            values={pendingSources}
            options={sourceOptions}
            placeholder="기관 전체"
            onChange={setPendingSources}
          />

          {pendingTargets.map((target) => (
            <input key={target} type="hidden" name="targets" value={target} />
          ))}
          <MultiFilterMenu
            label="추천 대상"
            values={pendingTargets}
            options={targetOptions}
            placeholder="대상 전체"
            onChange={setPendingTargets}
          />

          <input
            ref={sortInputRef}
            type="hidden"
            name={pendingSort === DEFAULT_PROGRAM_SORT ? undefined : "sort"}
            value={pendingSort}
            readOnly
          />
          <FilterMenu
            label="정렬"
            value={pendingSort}
            options={sortMenuOptions}
            placeholder="기본 정렬"
            onChange={(value) => {
              const nextSort: ProgramSort = isProgramSort(value) ? value : DEFAULT_PROGRAM_SORT;
              if (sortInputRef.current) {
                if (nextSort === DEFAULT_PROGRAM_SORT) {
                  sortInputRef.current.removeAttribute("name");
                } else {
                  sortInputRef.current.name = "sort";
                }
                sortInputRef.current.value = nextSort;
              }
              setPendingSort(nextSort);
              formRef.current?.requestSubmit();
            }}
          />
        </div>

        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-4 md:items-center lg:grid-cols-8">
          <label className="block md:col-span-2 lg:col-span-6">
            <span className="sr-only">검색</span>
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="제목, 기관, 설명, 지역, 태그 검색"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500"
            />
          </label>
          <button
            type="submit"
            className={cx("h-12 w-full rounded-2xl px-3 text-sm font-semibold", iso.primaryButton)}
          >
            검색
          </button>

          <Link
            href="/programs"
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
          >
            초기화
          </Link>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              추가 필터 펼치기
              <span className="ml-2 text-slate-400 group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                <input
                  type="checkbox"
                  name="closed"
                  value="true"
                  defaultChecked={showClosedRecent}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <span>
                  <span className="block font-semibold text-slate-900">마감된 공고 보기</span>
                  <span className="mt-1 block leading-5 text-slate-500">
                    기본값은 모집중 공고만 표시합니다. 체크하면 최근 3개월 내 마감된 공고까지 함께 보여줍니다.
                  </span>
                </span>
              </label>
            </div>
          </details>
        </div>
      </form>

      {activeFilters.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {activeFilters.map((chip) => (
            <Link
              key={`${chip.label}-${chip.href}`}
              href={chip.href}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {chip.label} ×
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
