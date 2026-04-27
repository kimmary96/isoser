"use client";

import { useEffect, useState } from "react";

import type { CareerEntry, EducationEntry, SkillEntry, SkillLevel } from "../_lib/profile-page";
import {
  normalizeSkillLevel,
  parseCareerLine,
  parseEducationLine,
  parseSkillLine,
  serializeCareerEntry,
  serializeEducationEntry,
  serializeSkillEntry,
} from "../_lib/profile-page";

const SKILL_LEVELS: Array<{ label: SkillLevel; value: number }> = [
  { label: "하", value: 1 },
  { label: "중", value: 2 },
  { label: "상", value: 3 },
];

function skillLevelToRangeValue(level: SkillLevel): number {
  if (level === "상") return 3;
  if (level === "중") return 2;
  return 1;
}

function rangeValueToSkillLevel(value: string): SkillLevel {
  if (value === "3") return "상";
  if (value === "1") return "하";
  return "중";
}

export function PencilButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
      aria-label={label}
      title={label}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" />
      </svg>
    </button>
  );
}

function ModalFrame({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-4xl rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="닫기"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ListEditorModal({
  open,
  title,
  initialItems,
  onClose,
  onSave,
  placeholder,
  saving,
}: {
  open: boolean;
  title: string;
  initialItems: string[];
  onClose: () => void;
  onSave: (items: string[]) => Promise<void>;
  placeholder: string;
  saving: boolean;
}) {
  const [items, setItems] = useState<string[]>(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems, open]);

  const updateItem = (index: number, value: string) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const deleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addItem = () => {
    setItems((prev) => [...prev, ""]);
  };

  const handleSave = async () => {
    const cleaned = items.map((item) => item.trim()).filter(Boolean);
    await onSave(cleaned);
    onClose();
  };

  return (
    <ModalFrame open={open} title={title} onClose={onClose}>
      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-gray-400">등록된 항목이 없습니다.</p>}
        {items.map((item, idx) => (
          <div key={`${title}-${idx}`} className="flex gap-2">
            <input
              value={item}
              onChange={(e) => updateItem(idx, e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
            />
            <button
              type="button"
              onClick={() => deleteItem(idx)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + 항목 추가
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

export function CareerEditorModal({
  open,
  initialItems,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initialItems: string[];
  onClose: () => void;
  onSave: (items: string[]) => Promise<void>;
  saving: boolean;
}) {
  const [entries, setEntries] = useState<CareerEntry[]>([]);

  useEffect(() => {
    const parsed = initialItems.map(parseCareerLine);
    setEntries(parsed.length > 0 ? parsed : [{ company: "", position: "", start: "", end: "" }]);
  }, [initialItems, open]);

  const updateEntry = (index: number, patch: Partial<CareerEntry>) => {
    setEntries((prev) => prev.map((entry, idx) => (idx === index ? { ...entry, ...patch } : entry)));
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, { company: "", position: "", start: "", end: "" }]);
  };

  const deleteEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    const serialized = entries
      .map(serializeCareerEntry)
      .map((line) => line.trim())
      .filter(Boolean);

    await onSave(serialized);
    onClose();
  };

  return (
    <ModalFrame open={open} title="경력 수정" onClose={onClose}>
      <div className="space-y-3">
        {entries.map((entry, idx) => (
          <div key={`career-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_1.9fr_auto] lg:items-end">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">재직 기간</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={entry.start}
                    onChange={(e) => updateEntry(idx, { start: e.target.value })}
                    placeholder="2024.09"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                  <input
                    value={entry.end}
                    onChange={(e) => updateEntry(idx, { end: e.target.value })}
                    placeholder="2025.12 또는 현재"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">회사 정보</label>
                  <input
                    value={entry.company}
                    onChange={(e) => updateEntry(idx, { company: e.target.value })}
                    placeholder="회사명"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">직무명</label>
                  <input
                    value={entry.position}
                    onChange={(e) => updateEntry(idx, { position: e.target.value })}
                    placeholder="Game Designer/PM"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => deleteEntry(idx)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={addEntry}
          className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          + 추가하기
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

export function EducationEditorModal({
  open,
  initialItems,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initialItems: string[];
  onClose: () => void;
  onSave: (items: string[]) => Promise<void>;
  saving: boolean;
}) {
  const [entries, setEntries] = useState<EducationEntry[]>([]);

  useEffect(() => {
    const parsed = initialItems.map(parseEducationLine);
    setEntries(
      parsed.length > 0
        ? parsed
        : [{ school: "", department: "", period: "", graduationStatus: "", gpa: "" }]
    );
  }, [initialItems, open]);

  const updateEntry = (index: number, patch: Partial<EducationEntry>) => {
    setEntries((prev) => prev.map((entry, idx) => (idx === index ? { ...entry, ...patch } : entry)));
  };

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      { school: "", department: "", period: "", graduationStatus: "", gpa: "" },
    ]);
  };

  const deleteEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    const serialized = entries
      .map(serializeEducationEntry)
      .map((line) => line.trim())
      .filter(Boolean);

    await onSave(serialized);
    onClose();
  };

  return (
    <ModalFrame open={open} title="학력 수정" onClose={onClose}>
      <div className="space-y-3">
        {entries.map((entry, idx) => (
          <div key={`education-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_0.85fr_0.75fr_auto] xl:items-end">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">학교명</label>
                <input
                  value={entry.school}
                  onChange={(e) => updateEntry(idx, { school: e.target.value })}
                  placeholder="한국대학교"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">학과</label>
                <input
                  value={entry.department}
                  onChange={(e) => updateEntry(idx, { department: e.target.value })}
                  placeholder="컴퓨터공학과"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">기간</label>
                <input
                  value={entry.period}
                  onChange={(e) => updateEntry(idx, { period: e.target.value })}
                  placeholder="2020.03 ~ 2024.02"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">졸업구분</label>
                <input
                  value={entry.graduationStatus}
                  onChange={(e) => updateEntry(idx, { graduationStatus: e.target.value })}
                  placeholder="졸업"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">학점</label>
                <input
                  value={entry.gpa}
                  onChange={(e) => updateEntry(idx, { gpa: e.target.value })}
                  placeholder="4.1/4.5"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={() => deleteEntry(idx)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={addEntry}
          className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          + 추가하기
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

export function SkillEditorModal({
  open,
  initialItems,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initialItems: string[];
  onClose: () => void;
  onSave: (items: string[]) => Promise<void>;
  saving: boolean;
}) {
  const [entries, setEntries] = useState<SkillEntry[]>([]);

  useEffect(() => {
    const parsed = initialItems.map(parseSkillLine);
    setEntries(parsed.length > 0 ? parsed : [{ name: "", level: "중" }]);
  }, [initialItems, open]);

  const updateEntry = (index: number, patch: Partial<SkillEntry>) => {
    setEntries((prev) =>
      prev.map((entry, idx) =>
        idx === index
          ? {
              ...entry,
              ...patch,
              level: normalizeSkillLevel(patch.level ?? entry.level),
            }
          : entry
      )
    );
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, { name: "", level: "중" }]);
  };

  const deleteEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    const serialized = entries
      .map(serializeSkillEntry)
      .map((line) => line.trim())
      .filter(Boolean);

    await onSave(serialized);
    onClose();
  };

  return (
    <ModalFrame open={open} title="스킬 수정" onClose={onClose}>
      <div className="space-y-3">
        {entries.map((entry, idx) => (
          <div key={`skill-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,1fr)_auto] lg:items-end">
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-slate-500">키워드</label>
                <input
                  value={entry.name}
                  onChange={(e) => updateEntry(idx, { name: e.target.value })}
                  placeholder="Unity, Figma, Python"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-slate-500">숙련도</label>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    {entry.level}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={1}
                  value={skillLevelToRangeValue(entry.level)}
                  onChange={(e) => updateEntry(idx, { level: rangeValueToSkillLevel(e.target.value) })}
                  aria-label={`${entry.name || "스킬"} 숙련도`}
                  className="w-full accent-slate-900"
                />
                <div className="mt-1 grid grid-cols-3 text-[11px] font-medium text-slate-400">
                  {SKILL_LEVELS.map((level) => (
                    <span
                      key={level.label}
                      className={`${level.value === 2 ? "text-center" : ""} ${
                        level.value === 3 ? "text-right" : ""
                      } ${level.label === entry.level ? "text-slate-900" : ""}`}
                    >
                      {level.label}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => deleteEntry(idx)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={addEntry}
          className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          + 추가하기
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

export function SelfIntroEditorModal({
  open,
  initialValue,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initialValue: string;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
  saving: boolean;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, open]);

  const handleSave = async () => {
    await onSave(value.trim());
    onClose();
  };

  return (
    <ModalFrame open={open} title="자기소개 수정" onClose={onClose}>
      <div>
        <label className="mb-2 block text-xs font-medium text-slate-500">자기소개</label>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="나의 경험, 강점, 목표를 자유롭게 작성하세요."
          className="min-h-[320px] w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-slate-400"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </ModalFrame>
  );
}

export function ReadonlyListSection({
  title,
  items,
  onEdit,
  emptyMessage,
}: {
  title: string;
  items: string[];
  onEdit: () => void;
  emptyMessage: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight text-slate-950">{title}</h3>
        <PencilButton onClick={onEdit} label={`${title} 수정`} />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2 text-sm text-slate-700">
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`} className="break-words rounded-xl bg-slate-50 px-3 py-2.5 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
