import seasons from '@/data/seasons.json';
import type { Season } from '@/data/types';

const typedSeasons = seasons as Season[];
const defaultYears = typedSeasons.map((s) => s.year);

interface SeasonSelectorProps {
  value: number;
  onChange: (year: number) => void;
  years?: number[];
}

export default function SeasonSelector({
  value,
  onChange,
  years = defaultYears,
}: SeasonSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {years.map((year) => {
        const isSelected = year === value;
        return (
          <button
            key={year}
            type="button"
            onClick={() => onChange(year)}
            className={`shrink-0 cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
              isSelected
                ? 'bg-[#f59e0b] text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-surface-inset text-on-surface-muted hover:bg-surface-inset/80 hover:text-on-surface'
            }`}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
}
