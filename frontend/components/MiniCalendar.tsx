"use client";

type MiniCalendarProgram = {
  end_date?: string;
  title: string;
};

type MiniCalendarProps = {
  programs: MiniCalendarProgram[];
  onDateClick: (date: string) => void;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function MiniCalendar({ programs, onDateClick }: MiniCalendarProps) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startWeekday = firstDay.getDay();

  const markedDates = new Set(
    programs
      .map((program) => {
        if (!program.end_date) return null;
        const date = new Date(program.end_date);
        if (Number.isNaN(date.getTime())) return null;
        if (date.getFullYear() !== currentYear || date.getMonth() !== currentMonth) return null;
        return toDateKey(date);
      })
      .filter((value): value is string => Boolean(value))
  );

  const cells: Array<Date | null> = [];

  for (let index = 0; index < startWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= lastDate; day += 1) {
    cells.push(new Date(currentYear, currentMonth, day));
  }

  return (
    <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-950">이번 달 마감 일정</h2>
        <p className="text-sm text-slate-500">
          {currentMonth + 1}월 {currentYear}
        </p>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-2">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2 text-center text-xs font-medium text-slate-400">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} className="h-16 rounded-xl bg-transparent" />;
          }

          const dateKey = toDateKey(cell);
          const isToday = isSameDate(cell, today);
          const hasProgram = markedDates.has(dateKey);

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onDateClick(dateKey)}
              className={`flex h-16 flex-col items-center justify-center rounded-xl border text-sm transition-colors ${
                isToday
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="font-medium">{cell.getDate()}</span>
              <span
                className={`mt-1 h-1.5 w-1.5 rounded-full ${
                  hasProgram ? "bg-red-500" : isToday ? "bg-white/70" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
