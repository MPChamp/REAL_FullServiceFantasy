import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, ArrowLeftRight, Info } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import StatCard from '@/components/common/StatCard';
import { getPositionColor } from '@/styles/theme';

import type { Player, ReconstructedMove } from '@/data/types';
import playersData from '@/data/players.json';
import movesData from '@/data/reconstructed-moves.json';

const players = playersData as Player[];
const moves = movesData as ReconstructedMove[];

const getPlayerName = (id: number) => players.find((p) => p.player_id === id)?.name ?? 'Unknown';

const KIND_META: Record<
  ReconstructedMove['kind'],
  { label: string; incoming: boolean; color: string }
> = {
  add: { label: 'Added', incoming: true, color: '#22c55e' },
  claimed: { label: 'Claimed', incoming: true, color: '#22c55e' },
  trade_in: { label: 'Traded for', incoming: true, color: '#f59e0b' },
  drop: { label: 'Dropped', incoming: false, color: '#ef4444' },
  released: { label: 'Lost', incoming: false, color: '#ef4444' },
  trade_out: { label: 'Traded away', incoming: false, color: '#f59e0b' },
};

function MoveRow({ move }: { move: ReconstructedMove }) {
  const meta = KIND_META[move.kind];
  const posColor = getPositionColor(move.position);
  const isTrade = move.kind === 'trade_in' || move.kind === 'trade_out';
  const Icon = isTrade ? ArrowLeftRight : meta.incoming ? ArrowUp : ArrowDown;

  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
      <span
        className={`flex-1 truncate ${meta.incoming ? 'text-on-surface' : 'text-on-surface-muted line-through'}`}
      >
        {move.nfl_player_name}
      </span>
      <span
        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
        style={{ color: posColor, backgroundColor: `${posColor}1a` }}
      >
        {move.position}
      </span>
      <span className="hidden w-8 shrink-0 text-[10px] text-on-surface-faint sm:block">
        {move.pro_team}
      </span>
      {move.counterparty !== null && (
        <span className="shrink-0 text-[10px] text-on-surface-faint">
          {meta.incoming ? 'from' : 'to'} {getPlayerName(move.counterparty)}
        </span>
      )}
    </div>
  );
}

export default function ReconstructedMoves({ season }: { season: number }) {
  const [managerFilter, setManagerFilter] = useState<number | null>(null);

  const seasonMoves = useMemo(
    () =>
      moves.filter(
        (m) => m.season_id === season && (managerFilter === null || m.player_id === managerFilter)
      ),
    [season, managerFilter]
  );

  const byWeek = useMemo(() => {
    const grouped = new Map<number, Map<number, ReconstructedMove[]>>();
    for (const m of seasonMoves) {
      if (!grouped.has(m.week)) grouped.set(m.week, new Map());
      const wk = grouped.get(m.week)!;
      if (!wk.has(m.player_id)) wk.set(m.player_id, []);
      wk.get(m.player_id)!.push(m);
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  }, [seasonMoves]);

  const stats = useMemo(() => {
    const all = moves.filter((m) => m.season_id === season);
    const acquisitions = all.filter((m) => KIND_META[m.kind].incoming).length;
    const trades = all.filter((m) => m.kind === 'trade_in').length;
    const counts = new Map<number, number>();
    for (const m of all) {
      if (!KIND_META[m.kind].incoming) continue;
      counts.set(m.player_id, (counts.get(m.player_id) ?? 0) + 1);
    }
    const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return { acquisitions, trades, busiest };
  }, [season]);

  if (!seasonMoves.length && managerFilter === null) {
    return <p className="text-sm text-on-surface-muted">No reconstructed moves for {season}.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-border-default bg-surface-inset/50 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-faint" />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-on-surface">Reconstructed from weekly rosters</p>
          <p className="text-on-surface-muted">
            ESPN deletes the transaction feed once a season ends, so {season}&rsquo;s moves are recovered
            by comparing each week&rsquo;s rosters against the one before, starting from draft day. The
            totals check out against ESPN&rsquo;s own counters, but two things can&rsquo;t be recovered:
            moves are dated to the week they first appear rather than the day they happened, and a player
            dropped and re-added inside the same week leaves no trace.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={`${season} acquisitions`} value={stats.acquisitions} accent="green" />
        <StatCard label="Players traded" value={stats.trades} accent="gold" />
        <StatCard
          label="Busiest manager"
          value={stats.busiest ? `${getPlayerName(stats.busiest[0])} · ${stats.busiest[1]}` : '—'}
          accent="purple"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setManagerFilter(null)}
          className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
            managerFilter === null
              ? 'bg-[#f59e0b] text-black'
              : 'bg-surface-inset text-on-surface-muted hover:text-on-surface'
          }`}
        >
          Everyone
        </button>
        {players.map((p) => {
          const count = moves.filter(
            (m) => m.season_id === season && m.player_id === p.player_id
          ).length;
          if (!count) return null;
          const active = managerFilter === p.player_id;
          return (
            <button
              key={p.player_id}
              type="button"
              onClick={() => setManagerFilter(active ? null : p.player_id)}
              className={`flex cursor-pointer items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-[#f59e0b] text-black'
                  : 'bg-surface-inset text-on-surface-muted hover:text-on-surface'
              }`}
            >
              <PlayerAvatar playerId={p.player_id} size="sm" />
              {p.name}
              <span className="font-score text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-5">
        {byWeek.map(([week, managers]) => (
          <div key={week} className="space-y-2">
            <div className="flex items-center gap-3">
              <h3 className="font-heading text-sm font-semibold text-on-surface">
                {week === 1 ? 'Draft day → Week 1' : `Week ${week - 1} → ${week}`}
              </h3>
              <div className="h-px flex-1 bg-border-default" />
              <span className="text-xs text-on-surface-faint">
                {[...managers.values()].reduce((n, list) => n + list.length, 0)} moves
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {[...managers.entries()]
                .sort((a, b) => b[1].length - a[1].length)
                .map(([managerId, list]) => (
                  <div key={managerId} className="glass-card p-3">
                    <Link
                      to={`/players/${managerId}`}
                      className="mb-2 flex items-center gap-2 border-b border-border-default pb-2 group"
                    >
                      <PlayerAvatar playerId={managerId} size="sm" />
                      <span className="flex-1 font-heading text-sm font-semibold text-on-surface group-hover:text-[#f59e0b]">
                        {getPlayerName(managerId)}
                      </span>
                      <span className="font-score text-[11px] text-on-surface-faint">
                        {list.length}
                      </span>
                    </Link>
                    <div>
                      {list
                        .slice()
                        .sort((a, b) => Number(KIND_META[b.kind].incoming) - Number(KIND_META[a.kind].incoming))
                        .map((m) => (
                          <MoveRow key={`${m.nfl_player_id}-${m.kind}`} move={m} />
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
