'use client';

import { useFiscalStore } from '@/lib/stores/fiscal-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Filter, Clock } from 'lucide-react';

const MONTHS = [
  { value: 'all', label: 'كامل السنة المالية' },
  { value: 1, label: '01 - يناير' },
  { value: 2, label: '02 - فبراير' },
  { value: 3, label: '03 - مارس' },
  { value: 4, label: '04 - أبريل' },
  { value: 5, label: '05 - ماي' },
  { value: 6, label: '06 - يونيو' },
  { value: 7, label: '07 - يوليوز' },
  { value: 8, label: '08 - غشت' },
  { value: 9, label: '09 - شتنبر' },
  { value: 10, label: '10 - أكتوبر' },
  { value: 11, label: '11 - نونبر' },
  { value: 12, label: '12 - دجنبر' },
];

const AVAILABLE_YEARS = [2024, 2025, 2026, 2027];

export function PeriodFilterBar({ onFilterChange }: { onFilterChange?: () => void }) {
  const {
    filterMode,
    startDate,
    endDate,
    selectedYear,
    selectedMonth,
    setCustomRange,
    setYearMonth,
    setFilterMode,
  } = useFiscalStore();

  return (
    <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          <Clock className="w-4 h-4 text-primary" />
          <span>تحديد الفترة المحاسبية:</span>
        </div>

        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          <Button
            size="sm"
            variant={filterMode === 'year_month' ? 'default' : 'ghost'}
            className="h-7 text-xs rounded-md"
            onClick={() => setFilterMode('year_month')}
          >
            سنة / شهر
          </Button>
          <Button
            size="sm"
            variant={filterMode === 'custom_range' ? 'default' : 'ghost'}
            className="h-7 text-xs rounded-md"
            onClick={() => setFilterMode('custom_range')}
          >
            من يوم إلى يوم
          </Button>
        </div>
      </div>

      {filterMode === 'year_month' ? (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-semibold">السنة:</span>
            <select
              value={selectedYear}
              onChange={(e) => {
                setYearMonth(Number(e.target.value), selectedMonth);
                onFilterChange?.();
              }}
              className="h-8 px-3 rounded-lg border border-border bg-background font-mono text-xs font-bold"
            >
              {AVAILABLE_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-semibold">الشهر:</span>
            <select
              value={selectedMonth}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setYearMonth(selectedYear, val);
                onFilterChange?.();
              }}
              className="h-8 px-3 rounded-lg border border-border bg-background text-xs font-semibold"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="text-[11px] font-mono text-muted-foreground mr-auto bg-muted px-2.5 py-1 rounded-md">
            الفترة المغطاة: {startDate} ⬅ {endDate}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-semibold">من تاريخ:</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setCustomRange(e.target.value, endDate);
                onFilterChange?.();
              }}
              className="h-8 text-xs font-mono rounded-lg w-36"
              dir="ltr"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-semibold">إلى تاريخ:</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setCustomRange(startDate, e.target.value);
                onFilterChange?.();
              }}
              className="h-8 text-xs font-mono rounded-lg w-36"
              dir="ltr"
            />
          </div>
        </div>
      )}
    </div>
  );
}
