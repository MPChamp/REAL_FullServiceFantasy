import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Inbox } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import StatCard from '@/components/common/StatCard';
import { getPositionColor } from '@/styles/theme';
import { usePageTitle } from '@/hooks/usePageTitle';

import type { Player, Transaction, NflPlayer } from '@/data/types';
import playersData from '@/data/players.json';
import transactionsData from '@/data/transactions.json';

const players = playersData as Player[];
const transactions = transactionsData as Transaction[];

const TYPE_LABELS: Record<Transaction['type'], string> = {
  waiver: 'Waiver',
  free_agent: 'Free Agent',
  trade: 'Trade',
};

function getPlayerName(id: number): string {
  return players.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

function MovePlayer({ player, direction }: { player: NflPlayer; direction: 'add' | 'drop' }) {
  const color = getPositionColor(player.position);
  const isAdd = direction === 'add';
  const Icon = isAdd ? ArrowUp : ArrowDown;

  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${isAdd ? 'text-[#22c55e]' : 'text-[#ef4444]'}`} />
      <span className={`text-sm ${isAdd ? 'text-on-surface' : 'text-on-surface-muted line-through'}`}>
        {player.nfl_player_name}
      </span>
      <span
        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
        style={{ color, backgroundColor: `${color}1a` }}
      >
        {player.position}
      </span>
      <span className="text-[10px] text-on-surface-faint">{player.pro_team}</span>
    </div>
  );
}

export default function TransactionsPage() {
  usePageTitle('Transactions');
  const [managerFilter, setManagerFilter] = useState<number | null>(null);

  const seasons = useMemo(
    () => [...new Set(transactions.map((t) => t.season_id))].sort((a, b) => b - a),
    []
  );

  const visible = useMemo(() => {
    return transactions
      .filter((t) => managerFilter === null || t.player_id === managerFilter)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [managerFilter]);

  const byWeek = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of visible) {
      const key = `${t.season_id}-${t.week}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return [...groups.entries()];
  }, [visible]);

  const leaders = useMemo(() => {
    const counts = new Map<number, number>();
    for (const t of transactions) counts.set(t.player_id, (counts.get(t.player_id) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  const totalAdds = transactions.reduce((sum, t) => sum + t.adds.length, 0);

  if (!transactions.length) {
    return (
      <div className="space-y-8">
        <h1 className="font-heading text-4xl font-bold text-on-surface">Transactions</h1>
        <div className="glass-card flex flex-col items-center gap-3 p-12 text-center">
          <Inbox className="h-10 w-10 text-on-surface-faint" />
          <p className="text-on-surface-muted">No moves logged yet this season.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="font-heading text-4xl font-bold text-on-surface">Transactions</h1>
        <p className="mt-2 text-on-surface-muted">
          Waiver claims, free agent grabs, and trades &mdash; logged as they happen
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total moves" value={transactions.length} accent="gold" />
        <StatCard label="Players added" value={totalAdds} accent="green" />
        <StatCard
          label="Most active"
          value={leaders[0] ? `${getPlayerName(leaders[0][0])} (${leaders[0][1]})` : '—'}
          accent="purple"
        />
        <StatCard label="Seasons logged" value={seasons.join(', ')} accent="red" />
      </div>

      {/* ── Manager filter ── */}
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
          const count = transactions.filter((t) => t.player_id === p.player_id).length;
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

      {/* ── Move log ── */}
      <div className="space-y-6">
        {byWeek.map(([key, moves]) => {
          const [season, week] = key.split('-');
          return (
            <div key={key} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="font-heading text-lg font-semibold text-on-surface">
                  {season} &middot; Week {week}
                </h2>
                <div className="h-px flex-1 bg-border-default" />
                <span className="text-xs text-on-surface-faint">{moves.length} moves</span>
              </div>

              {moves.map((t, idx) => (
                <motion.div
                  key={t.transaction_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.3) }}
                  className="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <Link
                    to={`/players/${t.player_id}`}
                    className="flex shrink-0 items-center gap-3 group sm:w-40"
                  >
                    <PlayerAvatar playerId={t.player_id} size="md" showRing />
                    <div>
                      <div className="font-heading text-sm font-semibold text-on-surface group-hover:text-[#f59e0b]">
                        {getPlayerName(t.player_id)}
                      </div>
                      <div className="text-[11px] text-on-surface-faint">{TYPE_LABELS[t.type]}</div>
                    </div>
                  </Link>

                  <div className="flex-1 space-y-1.5">
                    {t.adds.map((p) => (
                      <MovePlayer key={`add-${p.nfl_player_id}`} player={p} direction="add" />
                    ))}
                    {t.drops.map((p) => (
                      <MovePlayer key={`drop-${p.nfl_player_id}`} player={p} direction="drop" />
                    ))}
                  </div>

                  <div className="shrink-0 text-right text-[11px] text-on-surface-faint">
                    {new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                </motion.div>
              ))}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-on-surface-faint">
        ESPN only exposes the current season&rsquo;s activity feed, so this log starts with {seasons[seasons.length - 1]} and
        grows as the season runs.
      </p>
    </div>
  );
}
