import type { ReactNode } from 'react';

const accentStyles = {
  gold: {
    text: 'text-[#f59e0b]',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.12)]',
  },
  green: {
    text: 'text-[#22c55e]',
    glow: 'shadow-[0_0_15px_rgba(34,197,94,0.12)]',
  },
  red: {
    text: 'text-[#ef4444]',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.12)]',
  },
  purple: {
    text: 'text-[#a855f7]',
    glow: 'shadow-[0_0_15px_rgba(168,85,247,0.12)]',
  },
} as const;

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: 'gold' | 'green' | 'red' | 'purple';
}

export default function StatCard({
  label,
  value,
  icon,
  accent = 'gold',
}: StatCardProps) {
  const styles = accentStyles[accent];

  return (
    <div
      className={`relative rounded-xl border border-border-default bg-surface-card/70 p-4 backdrop-blur ${styles.glow}`}
    >
      {/* Icon in top-right corner */}
      {icon && (
        <div className="absolute right-3 top-3 text-on-surface-faint">
          {icon}
        </div>
      )}

      {/* Value */}
      <p className={`font-score text-2xl font-bold ${styles.text}`}>
        {value}
      </p>

      {/* Label */}
      <p className="mt-1 text-xs uppercase tracking-wider text-on-surface-faint">
        {label}
      </p>
    </div>
  );
}
