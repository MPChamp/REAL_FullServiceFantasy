import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Calendar } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { usePageTitle } from '@/hooks/usePageTitle';

import type { Player, Season, SeasonResult, Championship } from '@/data/types';
import playersData from '@/data/players.json';
import seasonsData from '@/data/seasons.json';
import seasonResultsData from '@/data/season-results.json';
import championshipsData from '@/data/championships.json';

const players = playersData as Player[];
const seasons = seasonsData as Season[];
const seasonResults = seasonResultsData as SeasonResult[];
const championships = championshipsData as Championship[];

function getPlayerName(id: number): string {
  return players.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

export default function SeasonsPage() {
  usePageTitle('Seasons');
  const seasonCards = useMemo(() => {
    return seasons
      .slice()
      .sort((a, b) => b.year - a.year)
      .map((season) => {
        const champ = championships.find((c) => c.season_id === season.season_id);
        const results = seasonResults.filter((r) => r.season_id === season.season_id);
        const topScorer = results.reduce((best, r) =>
          r.points_per_game > best.points_per_game ? r : best
        , results[0]);
        return {
          season,
          champ,
          topScorer,
          results,
        };
      });
  }, []);

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="font-heading text-4xl font-bold text-on-surface">Seasons</h1>
        <p className="text-on-surface-muted mt-2">A decade of fantasy football history</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {seasonCards.map((card, idx) => {
          const isChampCard = !!card.champ;
          const champName = card.champ ? getPlayerName(card.champ.winner_id) : '';
          const topScorerName = card.topScorer ? getPlayerName(card.topScorer.player_id) : '';

          return (
            <motion.div
              key={card.season.season_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * idx }}
            >
              <Link
                to={`/seasons/${card.season.year}`}
                className={`glass-card block p-6 hover:scale-[1.02] transition-transform ${
                  isChampCard ? 'border-[#f59e0b]/30' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="font-display text-5xl text-on-surface">{card.season.year}</span>
                  <div className="flex items-center gap-1 text-xs text-on-surface-faint">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{card.season.regular_season_end_week}-week season</span>
                  </div>
                </div>

                {card.champ && (
                  <div className="flex items-center gap-3 mb-4 py-3 px-3 rounded-lg bg-[#f59e0b]/5 border border-[#f59e0b]/10">
                    <PlayerAvatar playerId={card.champ.winner_id} size="md" showRing />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Trophy className="h-4 w-4 text-[#f59e0b]" />
                        <span className="font-heading text-sm font-semibold text-[#f59e0b]">Champion</span>
                      </div>
                      <span className="text-on-surface font-heading font-medium text-sm">{champName}</span>
                    </div>
                  </div>
                )}

                {card.topScorer && (
                  <div className="flex items-center gap-2 text-sm text-on-surface-muted">
                    <span className="text-on-surface-faint">Top Scorer:</span>
                    <span className="text-on-surface font-medium">{topScorerName}</span>
                    <span className="font-score text-[#22c55e]">{card.topScorer.points_per_game} PPG</span>
                  </div>
                )}

                {card.season.playoff_format === 'combined' && (
                  <div className="mt-2 text-xs text-on-surface-faint italic">
                    Combined-week playoff format
                  </div>
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
