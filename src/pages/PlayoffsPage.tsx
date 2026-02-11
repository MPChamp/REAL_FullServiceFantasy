import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Award, Trophy, TrendingUp } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { formatScore } from '@/utils/formatting';
import { usePageTitle } from '@/hooks/usePageTitle';

import type { Player, Season, WeeklyMatchup, AllTimeRecord } from '@/data/types';
import playersData from '@/data/players.json';
import seasonsData from '@/data/seasons.json';
import matchupsData from '@/data/matchups.json';
import allTimeRecordsData from '@/data/all-time-records.json';

const players = playersData as Player[];
const seasons = seasonsData as Season[];
const allMatchups = matchupsData as WeeklyMatchup[];
const allTimeRecords = allTimeRecordsData as AllTimeRecord[];

function getPlayerName(id: number): string {
  return players.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

function ToiletBowlBracketMatchup({ matchup }: { matchup: WeeklyMatchup }) {
  const p1Name = getPlayerName(matchup.player1_id);
  const p2Name = getPlayerName(matchup.player2_id);
  const p1Won = matchup.player1_score > matchup.player2_score;
  const p2Won = matchup.player2_score > matchup.player1_score;

  return (
    <div className="shame-card p-4 border border-border-default">
      <div className="text-xs font-heading font-semibold uppercase tracking-wide mb-3 text-[#b45309]">
        🚽 Toilet Bowl
      </div>

      {/* Player 1 */}
      <div className={`flex items-center gap-3 p-2 rounded-lg mb-1 ${
        p1Won ? 'bg-[#d97706]/10' : 'bg-[#ef4444]/10'
      }`}>
        <PlayerAvatar playerId={matchup.player1_id} size="sm" />
        <div className="flex-1">
          <span className={`font-heading text-sm font-semibold ${
            p1Won ? 'text-[#d97706]' : 'text-[#ef4444]'
          }`}>
            {p1Name}
          </span>
          <span className={`block text-[10px] font-heading uppercase tracking-wide ${
            p1Won ? 'text-[#d97706]' : 'text-[#ef4444]'
          }`}>
            {p1Won ? 'CHAMPION' : 'LAST PLACE'}
          </span>
        </div>
        <span className={`font-score text-lg ${p1Won ? 'text-[#d97706] font-bold' : 'text-on-surface-faint'}`}>
          {formatScore(matchup.player1_score)}
        </span>
      </div>

      {/* Player 2 */}
      <div className={`flex items-center gap-3 p-2 rounded-lg ${
        p2Won ? 'bg-[#d97706]/10' : 'bg-[#ef4444]/10'
      }`}>
        <PlayerAvatar playerId={matchup.player2_id} size="sm" />
        <div className="flex-1">
          <span className={`font-heading text-sm font-semibold ${
            p2Won ? 'text-[#d97706]' : 'text-[#ef4444]'
          }`}>
            {p2Name}
          </span>
          <span className={`block text-[10px] font-heading uppercase tracking-wide ${
            p2Won ? 'text-[#d97706]' : 'text-[#ef4444]'
          }`}>
            {p2Won ? 'CHAMPION' : 'LAST PLACE'}
          </span>
        </div>
        <span className={`font-score text-lg ${p2Won ? 'text-[#d97706] font-bold' : 'text-on-surface-faint'}`}>
          {formatScore(matchup.player2_score)}
        </span>
      </div>

      {matchup.notes && (
        <p className="text-xs text-on-surface-faint mt-2 italic">{matchup.notes}</p>
      )}
    </div>
  );
}

export default function PlayoffsPage() {
  usePageTitle('Playoffs');
  const [selectedYear, setSelectedYear] = useState(2025);

  const season = seasons.find((s) => s.year === selectedYear);

  const playoffMatchups = useMemo(
    () => allMatchups.filter((m) => m.season_id === selectedYear && m.game_type !== 'regular'),
    [selectedYear]
  );

  const semifinals = playoffMatchups.filter((m) => m.game_type === 'semifinal');
  const champGame = playoffMatchups.find((m) => m.game_type === 'championship');
  const thirdPlace = playoffMatchups.find((m) => m.game_type === '3rd_place');
  const toiletBowl = playoffMatchups.find((m) => m.game_type === 'toilet_bowl');

  // Playoff appearance leaderboard
  const playoffAppearances = useMemo(() => {
    return [...allTimeRecords]
      .sort((a, b) => b.playoff_appearances - a.playoff_appearances);
  }, []);

  // Playoff win percentage per player
  const playoffWinPcts = useMemo(() => {
    const stats = new Map<number, { wins: number; losses: number }>();
    players.forEach((p) => stats.set(p.player_id, { wins: 0, losses: 0 }));

    const allPlayoffGames = allMatchups.filter((m) => m.game_type !== 'regular');
    allPlayoffGames.forEach((m) => {
      const p1Won = m.player1_score > m.player2_score;
      const winnerId = p1Won ? m.player1_id : m.player2_id;
      const loserId = p1Won ? m.player2_id : m.player1_id;

      const winnerStats = stats.get(winnerId);
      if (winnerStats) winnerStats.wins++;
      const loserStats = stats.get(loserId);
      if (loserStats) loserStats.losses++;
    });

    return players
      .map((p) => {
        const s = stats.get(p.player_id) ?? { wins: 0, losses: 0 };
        const total = s.wins + s.losses;
        return {
          player_id: p.player_id,
          name: p.name,
          wins: s.wins,
          losses: s.losses,
          total,
          pct: total > 0 ? s.wins / total : 0,
        };
      })
      .filter((p) => p.total > 0)
      .sort((a, b) => b.pct - a.pct);
  }, []);

  function BracketMatchup({ matchup, label }: { matchup: WeeklyMatchup; label: string }) {
    const p1Name = getPlayerName(matchup.player1_id);
    const p2Name = getPlayerName(matchup.player2_id);
    const p1Won = matchup.player1_score > matchup.player2_score;
    const p2Won = matchup.player2_score > matchup.player1_score;

    return (
      <div className="glass-card p-4 border border-border-default">
        <div className="text-xs font-heading font-semibold uppercase tracking-wide mb-3 text-[#8b5cf6]">
          {label}
        </div>

        {/* Player 1 */}
        <div className={`flex items-center gap-3 p-2 rounded-lg mb-1 ${
          p1Won ? 'bg-[#22c55e]/10' : 'bg-white/[0.02]'
        }`}>
          <PlayerAvatar playerId={matchup.player1_id} size="md" showRing />
          <span className={`font-heading text-sm font-semibold flex-1 ${
            p1Won ? 'text-[#22c55e]' : 'text-[#ef4444]'
          }`}>
            {p1Name}
          </span>
          <span className={`font-score text-lg ${p1Won ? 'text-[#22c55e] font-bold' : 'text-on-surface-faint'}`}>
            {formatScore(matchup.player1_score)}
          </span>
          {p1Won && <Trophy className="h-4 w-4 text-[#22c55e]" />}
        </div>

        {/* Player 2 */}
        <div className={`flex items-center gap-3 p-2 rounded-lg ${
          p2Won ? 'bg-[#22c55e]/10' : 'bg-white/[0.02]'
        }`}>
          <PlayerAvatar playerId={matchup.player2_id} size="md" showRing />
          <span className={`font-heading text-sm font-semibold flex-1 ${
            p2Won ? 'text-[#22c55e]' : 'text-[#ef4444]'
          }`}>
            {p2Name}
          </span>
          <span className={`font-score text-lg ${p2Won ? 'text-[#22c55e] font-bold' : 'text-on-surface-faint'}`}>
            {formatScore(matchup.player2_score)}
          </span>
          {p2Won && <Trophy className="h-4 w-4 text-[#22c55e]" />}
        </div>

        {matchup.notes && (
          <p className="text-xs text-on-surface-faint mt-2 italic">{matchup.notes}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="font-heading text-4xl font-bold text-on-surface flex items-center gap-3">
          <Award className="h-8 w-8 text-[#8b5cf6]" />
          Playoffs
        </h1>
        <p className="text-on-surface-muted mt-2">Postseason brackets and stats across all seasons</p>
      </motion.div>

      {/* Season Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {seasons
          .slice()
          .sort((a, b) => b.year - a.year)
          .map((s) => (
            <button
              key={s.year}
              onClick={() => setSelectedYear(s.year)}
              className={`px-4 py-2 rounded-lg text-sm font-heading font-semibold shrink-0 transition-colors ${
                selectedYear === s.year
                  ? 'bg-[#8b5cf6] text-white'
                  : 'bg-surface-inset/50 text-on-surface-muted hover:bg-surface-inset hover:text-on-surface'
              }`}
            >
              {s.year}
            </button>
          ))}
      </div>

      {/* Playoff Bracket for selected season */}
      <motion.section
        key={selectedYear}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-on-surface mb-2">
          {selectedYear} Playoffs
        </h2>
        {season?.playoff_format === 'combined' && (
          <p className="text-xs text-on-surface-faint mb-4 italic">
            * 2016 used a combined-week playoff format (scores from 2 weeks combined per round)
          </p>
        )}

        {playoffMatchups.length === 0 ? (
          <p className="text-on-surface-faint">No playoff data available for this season.</p>
        ) : (
          <div className="space-y-6">
            {/* Semifinals */}
            {semifinals.length > 0 && (
              <div>
                <h3 className="font-heading text-sm font-semibold text-[#8b5cf6] uppercase tracking-wide mb-3">
                  Semifinals
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {semifinals.map((m, idx) => (
                    <BracketMatchup key={m.matchup_id} matchup={m} label={`Semifinal ${idx + 1}`} />
                  ))}
                </div>
              </div>
            )}

            {/* Championship & 3rd Place */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {champGame && (
                <BracketMatchup matchup={champGame} label="Championship" />
              )}
              {thirdPlace && (
                <BracketMatchup matchup={thirdPlace} label="3rd Place Game" />
              )}
            </div>

            {/* Toilet Bowl */}
            {toiletBowl && (
              <div className="max-w-md">
                <ToiletBowlBracketMatchup matchup={toiletBowl} />
              </div>
            )}
          </div>
        )}
      </motion.section>

      {/* Playoff Stats */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-on-surface mb-6 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[#8b5cf6]" />
          Playoff Stats
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Appearance Leaderboard */}
          <div className="glass-card p-5">
            <h3 className="font-heading text-sm font-semibold text-[#f59e0b] uppercase tracking-wide mb-4">
              Most Playoff Appearances
            </h3>
            <div className="space-y-3">
              {playoffAppearances.map((record, idx) => (
                <div key={record.player_id} className="flex items-center gap-3">
                  <span className={`font-score text-xs w-5 ${idx === 0 ? 'text-[#f59e0b]' : 'text-on-surface-faint'}`}>
                    {idx + 1}.
                  </span>
                  <PlayerAvatar playerId={record.player_id} size="sm" showRing />
                  <span className="font-heading text-sm text-on-surface font-semibold flex-1">
                    {record.name}
                  </span>
                  <span className="font-score text-sm text-on-surface font-semibold">
                    {record.playoff_appearances}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Playoff Win Percentage */}
          <div className="glass-card p-5">
            <h3 className="font-heading text-sm font-semibold text-[#f59e0b] uppercase tracking-wide mb-4">
              Playoff Win Percentage
            </h3>
            <div className="space-y-3">
              {playoffWinPcts.map((entry, idx) => (
                <div key={entry.player_id} className="flex items-center gap-3">
                  <span className={`font-score text-xs w-5 ${idx === 0 ? 'text-[#f59e0b]' : 'text-on-surface-faint'}`}>
                    {idx + 1}.
                  </span>
                  <PlayerAvatar playerId={entry.player_id} size="sm" showRing />
                  <span className="font-heading text-sm text-on-surface font-semibold flex-1">
                    {entry.name}
                  </span>
                  <div className="text-right">
                    <span className="font-score text-sm text-on-surface font-semibold">
                      {(entry.pct * 100).toFixed(1)}%
                    </span>
                    <span className="text-xs text-on-surface-faint ml-2">
                      ({entry.wins}-{entry.losses})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
