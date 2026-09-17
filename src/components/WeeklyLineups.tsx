import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { getPositionColor, slotRank } from '@/styles/theme';
import { formatScore } from '@/utils/formatting';

import { useSeasonLineups, weeksWithLineups, hasLineups } from '@/hooks/useSeasonLineups';

import type { Player, WeeklyLineupSpot } from '@/data/types';
import playersData from '@/data/players.json';

const players = playersData as Player[];

const getPlayerName = (id: number) => players.find((p) => p.player_id === id)?.name ?? 'Unknown';


function LineupRow({ row, benched }: { row: WeeklyLineupSpot; benched: boolean }) {
  const color = getPositionColor(row.position);
  const beatProjection = row.projected != null && row.points > row.projected;
  return (
    <li className="flex items-center gap-2 py-0.5 text-xs">
      <span
        className="w-11 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-semibold"
        style={
          benched
            ? { color: 'var(--color-on-surface-faint)', backgroundColor: 'transparent' }
            : { color, backgroundColor: `${color}1a` }
        }
      >
        {benched ? 'BE' : row.lineup_slot}
      </span>

      <span className={`flex-1 truncate ${benched ? 'text-on-surface-muted' : 'text-on-surface'}`}>
        {row.nfl_player_name}
      </span>

      {row.projected != null && (
        <span
          className="w-10 shrink-0 text-right font-score text-[10px] text-on-surface-faint"
          title={`Projected ${formatScore(row.projected)}`}
        >
          {formatScore(row.projected)}
        </span>
      )}

      <span
        className={`w-12 shrink-0 text-right font-score ${
          benched ? 'text-on-surface-faint' : 'text-on-surface'
        }`}
      >
        {formatScore(row.points)}
      </span>

      <span className="w-3 shrink-0">
        {row.projected != null &&
          (beatProjection ? (
            <TrendingUp className="h-3 w-3 text-[#22c55e]" />
          ) : (
            <TrendingDown className="h-3 w-3 text-on-surface-faint" />
          ))}
      </span>
    </li>
  );
}

function LineupTable({ rows }: { rows: WeeklyLineupSpot[] }) {
  const starters = rows
    .filter((r) => r.started)
    .sort((a, b) => slotRank(a.lineup_slot) - slotRank(b.lineup_slot));
  const bench = rows.filter((r) => !r.started).sort((a, b) => b.points - a.points);

  const startedTotal = starters.reduce((s, r) => s + r.points, 0);
  const benchTotal = bench.reduce((s, r) => s + r.points, 0);

  // The classic regret stat: best bench player who outscored a started player
  // at the same position.
  const regret = bench
    .map((b) => {
      const worstStarter = starters
        .filter((s) => s.position === b.position)
        .sort((x, y) => x.points - y.points)[0];
      return worstStarter && b.points > worstStarter.points
        ? { bench: b, starter: worstStarter, diff: b.points - worstStarter.points }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.diff - a.diff)[0];


  return (
    <>
      <ul className="space-y-0.5">
        {starters.map((r) => (
          <LineupRow key={r.nfl_player_id} row={r} benched={false} />
        ))}
      </ul>

      <div className="my-2 flex items-center justify-between border-t border-border-default pt-2 text-[11px]">
        <span className="text-on-surface-faint">Started</span>
        <span className="font-score font-semibold text-on-surface">{formatScore(Number(startedTotal.toFixed(2)))}</span>
      </div>

      <ul className="space-y-0.5 opacity-70">
        {bench.map((r) => (
          <LineupRow key={r.nfl_player_id} row={r} benched />
        ))}
      </ul>

      <div className="mt-2 flex items-center justify-between border-t border-border-default pt-2 text-[11px]">
        <span className="text-on-surface-faint">Left on bench</span>
        <span className="font-score text-on-surface-muted">{formatScore(Number(benchTotal.toFixed(2)))}</span>
      </div>

      {regret && (
        <p className="mt-2 rounded bg-[#ef4444]/5 px-2 py-1.5 text-[11px] text-[#ef4444]">
          Benched {regret.bench.nfl_player_name} ({formatScore(regret.bench.points)}) over{' '}
          {regret.starter.nfl_player_name} ({formatScore(regret.starter.points)}) &mdash; cost{' '}
          {regret.diff.toFixed(2)}
        </p>
      )}
    </>
  );
}

export default function WeeklyLineups({ year }: { year: number }) {
  const weeks = useMemo(() => weeksWithLineups(year), [year]);
  const rows = useSeasonLineups(year);

  // Derived rather than synced in an effect, so switching seasons falls back to
  // the latest available week instead of keeping a week that season never had.
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const week =
    selectedWeek !== null && weeks.includes(selectedWeek)
      ? selectedWeek
      : (weeks[weeks.length - 1] ?? null);

  const byManager = useMemo(() => {
    if (!rows || week === null) return [];
    const grouped = new Map<number, WeeklyLineupSpot[]>();
    for (const r of rows) {
      if (r.week !== week) continue;
      if (!grouped.has(r.player_id)) grouped.set(r.player_id, []);
      grouped.get(r.player_id)!.push(r);
    }
    return [...grouped.entries()]
      .map(([playerId, spots]) => ({
        playerId,
        spots,
        started: spots.filter((s) => s.started).reduce((sum, s) => sum + s.points, 0),
      }))
      .sort((a, b) => b.started - a.started);
  }, [rows, week]);

  if (!hasLineups(year)) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-2xl font-bold text-on-surface">Weekly Lineups</h2>
        <p className="mt-1 text-sm text-on-surface-muted">
          Who actually started each week in {year}, what they scored, and what they were projected to
          score. Teams ordered by that week&rsquo;s score.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {weeks.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setSelectedWeek(w)}
            className={`shrink-0 cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
              w === week
                ? 'bg-[#f59e0b] text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-surface-inset text-on-surface-muted hover:text-on-surface'
            }`}
          >
            {w}
          </button>
        ))}
      </div>

      {!rows ? (
        <p className="text-sm text-on-surface-muted">Loading lineups…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {byManager.map((team, idx) => (
            <motion.div
              key={team.playerId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.2) }}
              className="glass-card p-4"
            >
              <div className="mb-3 flex items-center gap-2 border-b border-border-default pb-2">
                <PlayerAvatar playerId={team.playerId} size="sm" />
                <span className="flex-1 font-heading text-sm font-semibold text-on-surface">
                  {getPlayerName(team.playerId)}
                </span>
                <span className="font-score text-sm text-on-surface">
                  {formatScore(Number(team.started.toFixed(2)))}
                </span>
              </div>
              <LineupTable rows={team.spots} />
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
