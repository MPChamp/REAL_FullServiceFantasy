import { useMemo } from 'react';
import { motion } from 'framer-motion';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { getPositionColor, slotRank } from '@/styles/theme';
import { formatScore } from '@/utils/formatting';
import { useSeasonLineups } from '@/hooks/useSeasonLineups';
import { useSeasonFacts } from '@/hooks/useSeasonFacts';

import type { Player, WeeklyLineupSpot, GameFact } from '@/data/types';
import playersData from '@/data/players.json';

const players = playersData as Player[];
const getPlayerName = (id: number) => players.find((p) => p.player_id === id)?.name ?? 'Unknown';


function FactLine({ fact }: { fact: GameFact | undefined }) {
  if (!fact) return null;
  const pct = fact.efficiency == null ? null : Math.round(fact.efficiency * 100);

  return (
    <div className="mt-2 space-y-1 border-t border-border-default pt-2 text-[11px]">
      {pct !== null && (
        <div className="flex items-center justify-between">
          <span className="text-on-surface-faint">Lineup efficiency</span>
          <span className={pct === 100 ? 'font-semibold text-[#22c55e]' : 'text-on-surface-muted'}>
            {pct === 100 ? 'Perfect lineup' : `${pct}% of ${formatScore(fact.optimal_points)} possible`}
          </span>
        </div>
      )}
      {fact.missed_swap && (
        <p className={fact.swap_would_have_won ? 'text-[#ef4444]' : 'text-on-surface-faint'}>
          Should have started {fact.missed_swap.benched.name} (
          {formatScore(fact.missed_swap.benched.points)}) over{' '}
          {fact.missed_swap.started.name} ({formatScore(fact.missed_swap.started.points)}) &mdash;{' '}
          {formatScore(fact.missed_swap.gain)} pts
          {fact.swap_would_have_won && ', which would have won it'}
        </p>
      )}
      {!fact.missed_swap && pct === 100 && (
        <p className="text-[#22c55e]">Nothing on the bench would have scored more.</p>
      )}
    </div>
  );
}

function Side({
  rows,
  managerId,
  fact,
}: {
  rows: WeeklyLineupSpot[];
  managerId: number;
  fact?: GameFact;
}) {
  const starters = rows
    .filter((r) => r.started)
    .sort((a, b) => slotRank(a.lineup_slot) - slotRank(b.lineup_slot));
  const bench = rows.filter((r) => !r.started).sort((a, b) => b.points - a.points);
  const benchTotal = bench.reduce((s, r) => s + r.points, 0);

  const line = (r: WeeklyLineupSpot, benched: boolean) => {
    const color = getPositionColor(r.position);
    return (
      <li key={r.nfl_player_id} className="flex items-center gap-2 py-0.5 text-xs">
        <span
          className="w-10 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-semibold"
          style={
            benched
              ? { color: 'var(--color-on-surface-faint)' }
              : { color, backgroundColor: `${color}1a` }
          }
        >
          {benched ? 'BE' : r.lineup_slot}
        </span>
        <span className={`flex-1 truncate ${benched ? 'text-on-surface-muted' : 'text-on-surface'}`}>
          {r.nfl_player_name}
        </span>
        {r.projected != null && (
          <span
            className="w-9 shrink-0 text-right font-score text-[10px] text-on-surface-faint"
            title={`Projected ${formatScore(r.projected)}`}
          >
            {formatScore(r.projected)}
          </span>
        )}
        <span
          className={`w-11 shrink-0 text-right font-score ${
            benched ? 'text-on-surface-faint' : 'text-on-surface'
          }`}
        >
          {formatScore(r.points)}
        </span>
      </li>
    );
  };

  return (
    <div className="flex-1">
      <div className="mb-2 flex items-center gap-2 border-b border-border-default pb-2">
        <PlayerAvatar playerId={managerId} size="sm" />
        <span className="font-heading text-sm font-semibold text-on-surface">
          {getPlayerName(managerId)}
        </span>
      </div>

      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-on-surface-faint">
        <span className="w-10" />
        <span className="flex-1">Starters</span>
        <span className="w-9 text-right">Proj</span>
        <span className="w-11 text-right">Pts</span>
      </div>
      <ul>{starters.map((r) => line(r, false))}</ul>

      <div className="mt-2 border-t border-border-default pt-2 text-[10px] uppercase tracking-wide text-on-surface-faint">
        Bench &middot; {formatScore(Number(benchTotal.toFixed(2)))} pts
      </div>
      <ul className="opacity-70">{bench.map((r) => line(r, true))}</ul>

      <FactLine fact={fact} />
    </div>
  );
}

export default function MatchupDetail({
  year,
  week,
  homeId,
  awayId,
}: {
  year: number;
  week: number;
  homeId: number;
  awayId: number;
}) {
  const rows = useSeasonLineups(year);
  const facts = useSeasonFacts(year);

  const sides = useMemo(() => {
    if (!rows) return null;
    const forManager = (id: number) => rows.filter((r) => r.week === week && r.player_id === id);
    return { home: forManager(homeId), away: forManager(awayId) };
  }, [rows, week, homeId, awayId]);

  if (!rows) {
    return <p className="px-4 pb-4 text-xs text-on-surface-faint">Loading lineups…</p>;
  }
  if (!sides?.home.length || !sides?.away.length) {
    return (
      <p className="px-4 pb-4 text-xs text-on-surface-faint">
        No lineup detail recorded for this week.
      </p>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="flex flex-col gap-6 border-t border-border-default px-1 pt-3 sm:flex-row">
        <Side
          rows={sides.away}
          managerId={awayId}
          fact={facts?.find((f) => f.week === week && f.player_id === awayId)}
        />
        <div className="hidden w-px shrink-0 bg-border-default sm:block" />
        <Side
          rows={sides.home}
          managerId={homeId}
          fact={facts?.find((f) => f.week === week && f.player_id === homeId)}
        />
      </div>
    </motion.div>
  );
}
