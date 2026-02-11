import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ChevronDown } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { formatRecord } from '@/utils/formatting';
import { usePageTitle } from '@/hooks/usePageTitle';

import type { AllTimeRecord } from '@/data/types';
import allTimeRecordsData from '@/data/all-time-records.json';

const allTimeRecords = allTimeRecordsData as AllTimeRecord[];

type SortOption = 'championships' | 'win_percentage' | 'career_ppg' | 'total_wins';

const sortLabels: Record<SortOption, string> = {
  championships: 'Championships',
  win_percentage: 'Win %',
  career_ppg: 'PPG',
  total_wins: 'Total Wins',
};

export default function PlayersPage() {
  usePageTitle('Players');
  const [sortBy, setSortBy] = useState<SortOption>('championships');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const sortedPlayers = useMemo(() => {
    return [...allTimeRecords].sort((a, b) => {
      const diff = b[sortBy] - a[sortBy];
      // Tiebreak by win percentage
      if (diff === 0) return b.win_percentage - a.win_percentage;
      return diff;
    });
  }, [sortBy]);

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="font-heading text-4xl font-bold text-on-surface">Players</h1>
          <p className="text-on-surface-muted mt-1">10 managers, 10 seasons of battle</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-inset/50 border border-border-default text-sm text-on-surface hover:bg-surface-inset transition-colors"
          >
            Sort: {sortLabels[sortBy]}
            <ChevronDown className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-lg bg-surface-card border border-border-default shadow-xl z-20">
              {(Object.entries(sortLabels) as [SortOption, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSortBy(key);
                    setDropdownOpen(false);
                  }}
                  className={`block w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-surface-inset ${
                    sortBy === key ? 'text-[#f59e0b]' : 'text-on-surface'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedPlayers.map((player, idx) => (
          <motion.div
            key={player.player_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 * idx }}
          >
            <Link
              to={`/players/${player.player_id}`}
              className="glass-card block p-6 hover:scale-[1.02] transition-transform"
            >
              <div className="flex items-center gap-4 mb-4">
                <PlayerAvatar playerId={player.player_id} size="lg" showRing />
                <div>
                  <h2 className="font-heading text-xl font-bold text-on-surface">{player.name}</h2>
                  {player.championships > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      {Array.from({ length: player.championships }).map((_, i) => (
                        <Trophy key={i} className="h-4 w-4 text-[#f59e0b]" />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="stat-card py-2">
                  <div className="font-score text-sm text-on-surface">
                    {formatRecord(player.total_wins, player.total_losses, player.total_ties)}
                  </div>
                  <div className="text-xs text-on-surface-faint mt-0.5">Record</div>
                </div>
                <div className="stat-card py-2">
                  <div className="font-score text-sm text-on-surface">{player.career_ppg.toFixed(1)}</div>
                  <div className="text-xs text-on-surface-faint mt-0.5">PPG</div>
                </div>
                <div className="stat-card py-2">
                  <div className="font-score text-sm text-on-surface">{player.playoff_appearances}</div>
                  <div className="text-xs text-on-surface-faint mt-0.5">Playoffs</div>
                </div>
              </div>

              {(player.toilet_bowl_wins > 0 || player.toilet_bowl_losses > 0) && (
                <div className="mt-3 flex items-center justify-center gap-2.5 rounded-lg bg-surface-inset/40 px-3 py-1.5">
                  <span className="text-sm leading-none">🚽</span>
                  <span className="text-[11px] font-heading text-on-surface-muted">Toilet Bowl</span>
                  <div className="flex items-center gap-1.5 text-xs font-score">
                    {player.toilet_bowl_wins > 0 && (
                      <span className="text-toilet-glory">{player.toilet_bowl_wins}W</span>
                    )}
                    {player.toilet_bowl_losses > 0 && (
                      <span className="text-loss">{player.toilet_bowl_losses}L</span>
                    )}
                  </div>
                </div>
              )}
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
