import React, { useMemo } from "react";

export const getWorkDateKey = (date) => {
  if (!date) return "";
  const parsed = new Date(date);
  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60 * 1000);
  return local.toISOString().split("T")[0];
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const buildMonthGrid = (monthValue) => {
  const [year, month] = monthValue.split("-").map(Number);
  const firstOfMonth = new Date(year, month - 1, 1);
  const firstDayIndex = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const grid = [];
  for (let index = 0; index < firstDayIndex; index += 1) {
    grid.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    grid.push(dateKey);
  }
  return grid;
};

export const getMonthRangeFromValue = (monthValue) => {
  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
};

const WorkRecordsCalendar = ({
  monthValue,
  records = [],
  selectedDateKey,
  onSelectDate,
  loading = false,
  title = "Work Performance Calendar",
  description = "",
  isModal = false,
}) => {
  const recordMap = useMemo(
    () =>
      records.reduce((map, record) => {
        const dateKey = getWorkDateKey(record.date);
        if (dateKey) map[dateKey] = normalizeWorkRecord ? record : record;
        return map;
      }, {}),
    [records]
  );

  const monthGrid = useMemo(() => buildMonthGrid(monthValue), [monthValue]);
  const todayKey = getWorkDateKey(new Date());

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-md ${
        isModal ? "max-w-full" : ""
      }`}
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
            {description ? <p className="mt-0.5 text-xs text-slate-400">{description}</p> : null}
          </div>
          <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
            {new Date(`${monthValue}-01`).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        </div>
      ) : (
        <div className="p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {weekdayLabels.map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((dateKey, index) => {
              if (!dateKey) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="min-h-[78px] rounded-lg border border-slate-100 bg-slate-50/40"
                  />
                );
              }

              const record = recordMap[dateKey];
              const isSelected = dateKey === selectedDateKey;
              const isToday = dateKey === todayKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => onSelectDate?.(dateKey)}
                  className={`group relative flex min-h-[78px] flex-col rounded-lg border p-1.5 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1 ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-50/60 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        isSelected ? "text-cyan-700" : "text-slate-600"
                      }`}
                    >
                      {Number(dateKey.split("-")[2])}
                    </span>
                    {isToday && (
                      <span className="rounded-full bg-cyan-100 px-1 py-0 text-[8px] font-bold uppercase text-cyan-600">
                        Today
                      </span>
                    )}
                  </div>

                  {record ? (
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      <span
                        className={`inline-flex w-fit rounded-full px-1 py-0 text-[8px] font-bold uppercase ${
                          record.status === "approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : record.status === "rejected"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {record.status === "approved"
                          ? "✓"
                          : record.status === "rejected"
                          ? "✗"
                          : "⏳"}
                      </span>
                      <p className="line-clamp-2 text-[10px] leading-tight text-slate-500">
                        {record.morning_title || record.morning_description || "Record"}
                      </p>
                      <div className="mt-0.5 flex items-center justify-between gap-1 text-[8px] font-medium text-slate-400">
                        <span>{record.employee_submitted_percentage ?? "-"}%</span>
                        <span className="h-1 w-6 overflow-hidden rounded-full bg-slate-100">
                          <span
                            className="block h-full rounded-full bg-cyan-400"
                            style={{ width: `${record.daily_work_percentage || 0}%` }}
                          />
                        </span>
                        <span>{record.daily_work_percentage ?? 0}%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-center text-[9px] text-slate-300">—</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkRecordsCalendar;

export const normalizeWorkRecord = (record) => {
  const { date, morning_title, morning_description, status, employee_submitted_percentage, daily_work_percentage } = record;
  return {
    date,
    morning_title,
    morning_description,
    status,
    employee_submitted_percentage,
    daily_work_percentage,
  };
};