import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Users, Target } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import ScrollableTable from '@/components/common/ScrollableTable';
import { formatRecord, formatPercent, formatScore } from '@/utils/formatting';
import { usePageTitle } from '@/hooks/usePageTitle';

import type { Player, Championship, AllTimeRecord, WeeklyMatchup, ToiletBowl } from '@/data/types';
import playersData from '@/data/players.json';
import championshipsData from '@/data/championships.json';
import allTimeRecordsData from '@/data/all-time-records.json';
import matchupsData from '@/data/matchups.json';
import toiletBowlsData from '@/data/toilet-bowls.json';

const players = playersData as Player[];
const championships = championshipsData as Championship[];
const allTimeRecords = allTimeRecordsData as AllTimeRecord[];
const matchups = matchupsData as WeeklyMatchup[];
const toiletBowls = toiletBowlsData as ToiletBowl[];

function getPlayerName(id: number): string {
  return players.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

export default function HomePage() {
  usePageTitle();
  const champCards = useMemo(() => {
    return championships
      .slice()
      .sort((a, b) => a.season_id - b.season_id)
      .map((champ) => {
        const champGame = matchups.find(
          (m) => m.season_id === champ.season_id && m.game_type === 'championship'
        );
        return { ...champ, champGame };
      });
  }, []);

  const toiletBowlCards = useMemo(() => {
    return toiletBowls.slice().sort((a, b) => a.season_id - b.season_id);
  }, []);

  const totalGames = useMemo(() => {
    const sum = allTimeRecords.reduce((acc, r) => acc + r.total_games, 0);
    return Math.round(sum / 2);
  }, []);

  const mostChampions = useMemo(() => {
    const sorted = [...allTimeRecords].sort((a, b) => b.championships - a.championships);
    return sorted[0];
  }, []);

  const winsLeader = useMemo(() => {
    const sorted = [...allTimeRecords].sort((a, b) => b.total_wins - a.total_wins);
    return sorted[0];
  }, []);

  const leagueAvgPPG = useMemo(() => {
    const totalPPG = allTimeRecords.reduce((acc, r) => acc + r.career_ppg, 0);
    return (totalPPG / allTimeRecords.length).toFixed(1);
  }, []);

  const mostToiletBowls = useMemo(() => {
    const sorted = [...allTimeRecords].sort(
      (a, b) =>
        b.toilet_bowl_wins + b.toilet_bowl_losses - (a.toilet_bowl_wins + a.toilet_bowl_losses)
    );
    return sorted[0];
  }, []);

  const standings = useMemo(() => {
    return [...allTimeRecords].sort((a, b) => b.win_percentage - a.win_percentage);
  }, []);

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center py-12"
      >
        <h1 className="font-display text-5xl md:text-7xl tracking-wider text-on-surface">
          Full Service Fantasy Football League
        </h1>
        <p className="mt-4 text-lg md:text-xl text-on-surface-muted font-body tracking-wide">
          A Decade of Dominance &bull; 2016&ndash;2025
        </p>
        <div className="mt-6 section-divider mx-auto max-w-md h-px" />
      </motion.section>

      {/* Champions Wall */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-on-surface mb-6 flex items-center gap-2">
          <Trophy className="h-6 w-6 text-[#f59e0b]" />
          Champions Wall
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-thin">
          {champCards.map((champ, idx) => {
            const winnerName = getPlayerName(champ.winner_id);
            const loserName = getPlayerName(champ.runner_up_id);
            const winnerScore = champ.champGame
              ? champ.champGame.player1_id === champ.winner_id
                ? champ.champGame.player1_score
                : champ.champGame.player2_score
              : null;
            const loserScore = champ.champGame
              ? champ.champGame.player1_id === champ.runner_up_id
                ? champ.champGame.player1_score
                : champ.champGame.player2_score
              : null;

            return (
              <motion.div
                key={champ.season_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * idx }}
              >
                <Link
                  to={`/seasons/${champ.season_id}`}
                  className="glass-card flex flex-col items-center min-w-[160px] p-5 border border-[#f59e0b]/20 hover:border-[#f59e0b]/50 transition-all"
                >
                  <span className="font-display text-3xl text-[#f59e0b]">{champ.season_id}</span>
                  <div className="my-3">
                    <PlayerAvatar playerId={champ.winner_id} size="lg" showRing />
                  </div>
                  <Trophy className="h-5 w-5 text-[#f59e0b] mb-1" />
                  <span className="font-heading text-sm font-semibold text-on-surface">{winnerName}</span>
                  {winnerScore !== null && loserScore !== null && (
                    <span className="text-xs text-on-surface-muted mt-1 font-score">
                      {formatScore(winnerScore)} - {formatScore(loserScore)}
                    </span>
                  )}
                  <span className="text-xs text-on-surface-faint mt-0.5">vs {loserName}</span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Wall of Shame */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <div className="mb-6">
          <h2 className="font-heading text-2xl font-semibold text-on-surface flex items-center gap-2">
            <span className="text-2xl">{'\u{1F4A9}'}</span>
            Wall of Shame
          </h2>
          <p className="text-sm text-on-surface-muted mt-1">Where Legends Hit Rock Bottom</p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-thin">
          {toiletBowlCards.map((tb, idx) => {
            const loserName = getPlayerName(tb.loser_id);
            return (
              <motion.div
                key={tb.season_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * idx }}
              >
                <Link
                  to={`/seasons/${tb.season_id}`}
                  className="shame-card flex flex-col items-center min-w-[160px] p-5 transition-all"
                >
                  <span className="font-display text-3xl text-[#92400e]">{tb.season_id}</span>
                  <div className="my-3">
                    <PlayerAvatar playerId={tb.loser_id} size="lg" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-red-500/80 mb-1">
                    Last Place
                  </span>
                  <span className="font-heading text-sm font-semibold text-on-surface">{loserName}</span>
                  <span className="text-xs text-on-surface-muted mt-1 font-score">
                    Lost {formatScore(tb.loser_score)} - {formatScore(tb.winner_score)}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Toilet Bowl Legends */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.35 }}
      >
        <div className="mb-6">
          <h2 className="font-heading text-2xl font-semibold text-[#d97706] flex items-center gap-2">
            <span style={{ filter: 'sepia(1) saturate(3) hue-rotate(10deg) brightness(1.1)' }}>🚽</span>
            Toilet Bowl Legends
          </h2>
          <p className="text-sm text-on-surface-muted mt-1">They Stared Into the Abyss and Survived</p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-thin">
          {toiletBowlCards.map((tb, idx) => {
            const winnerName = getPlayerName(tb.winner_id);
            return (
              <motion.div
                key={tb.season_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * idx }}
              >
                <Link
                  to={`/seasons/${tb.season_id}`}
                  className="glass-card flex flex-col items-center min-w-[160px] p-5 border border-[#d97706]/20 hover:border-[#d97706]/50 transition-all"
                >
                  <span className="font-display text-3xl text-[#d97706]">{tb.season_id}</span>
                  <div className="my-3">
                    <PlayerAvatar playerId={tb.winner_id} size="lg" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#d97706] mb-1">
                    Survived
                  </span>
                  <span className="font-heading text-sm font-semibold text-on-surface">{winnerName}</span>
                  <span className="text-xs text-on-surface-muted mt-1 font-score">
                    {formatScore(tb.winner_score)} - {formatScore(tb.loser_score)}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Quick Stats */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-on-surface mb-6">Quick Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card flex flex-col items-center text-center p-4">
            <Target className="h-6 w-6 text-[#f59e0b] mb-2" />
            <span className="font-display text-3xl text-on-surface">{totalGames}</span>
            <span className="text-xs text-on-surface-muted mt-1">Total Games Played</span>
          </div>
          <div className="stat-card flex flex-col items-center text-center p-4">
            <Trophy className="h-6 w-6 text-[#f59e0b] mb-2" />
            <span className="font-display text-3xl text-on-surface">{mostChampions?.championships}</span>
            <span className="text-xs text-on-surface-muted mt-1">
              Most Championships ({mostChampions?.name})
            </span>
          </div>
          <div className="stat-card flex flex-col items-center text-center p-4">
            <TrendingUp className="h-6 w-6 text-[#22c55e] mb-2" />
            <span className="font-display text-3xl text-on-surface">{winsLeader?.total_wins}</span>
            <span className="text-xs text-on-surface-muted mt-1">
              All-Time Wins Leader ({winsLeader?.name})
            </span>
          </div>
          <div className="stat-card flex flex-col items-center text-center p-4">
            <Users className="h-6 w-6 text-[#06b6d4] mb-2" />
            <span className="font-display text-3xl text-on-surface">{leagueAvgPPG}</span>
            <span className="text-xs text-on-surface-muted mt-1">League Average PPG</span>
          </div>
          <div className="stat-card flex flex-col items-center text-center p-4">
            <span className="text-2xl mb-2">{'\u{1F6BD}'}</span>
            <span className="font-display text-3xl text-[#b45309]">
              {mostToiletBowls
                ? mostToiletBowls.toilet_bowl_wins + mostToiletBowls.toilet_bowl_losses
                : 0}
            </span>
            <span className="text-xs text-on-surface-muted mt-1">
              Most Toilet Bowls ({mostToiletBowls?.name})
            </span>
          </div>
        </div>
      </motion.section>

      {/* All-Time Standings */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-on-surface mb-6">All-Time Standings</h2>
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-on-surface-muted">
                <th className="py-3 px-1.5 sm:px-2 text-left font-medium w-8 sm:w-12">#</th>
                <th className="py-3 px-1.5 sm:px-2 text-left font-medium">Player</th>
                <th className="py-3 px-1.5 sm:px-2 text-right font-medium whitespace-nowrap">W-L-T</th>
                <th className="py-3 px-2 text-right font-medium">Win%</th>
                <th className="py-3 px-2 text-right font-medium">PPG</th>
                <th className="py-3 px-2 text-center font-medium">Titles</th>
                <th className="py-3 px-2 text-center font-medium">TB W</th>
                <th className="py-3 px-2 text-center font-medium">Last</th>
                <th className="py-3 px-2 text-right font-medium">Playoffs</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((record, idx) => (
                <motion.tr
                  key={record.player_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.05 * idx }}
                >
                  <td className="py-3 px-1.5 sm:px-2">
                    <Link
                      to={`/players/${record.player_id}`}
                      className="contents"
                    >
                      <span className="text-on-surface-faint font-score">{idx + 1}</span>
                    </Link>
                  </td>
                  <td className="py-3 px-1.5 sm:px-2">
                    <Link
                      to={`/players/${record.player_id}`}
                      className="flex items-center gap-2 sm:gap-3 hover:text-[#f59e0b] transition-colors"
                    >
                      <PlayerAvatar playerId={record.player_id} size="sm" showRing />
                      <span className="font-heading font-semibold text-on-surface">{record.name}</span>
                    </Link>
                  </td>
                  <td className="py-3 px-1.5 sm:px-2 text-right font-score text-on-surface whitespace-nowrap">
                    <Link to={`/players/${record.player_id}`}>
                      {formatRecord(record.total_wins, record.total_losses, record.total_ties)}
                    </Link>
                  </td>
                  <td className="py-3 px-2 text-right font-score text-on-surface">
                    {formatPercent(record.win_percentage)}
                  </td>
                  <td className="py-3 px-2 text-right font-score text-on-surface">
                    {record.career_ppg.toFixed(1)}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {record.championships > 0 ? (
                        Array.from({ length: record.championships }).map((_, i) => (
                          <Trophy key={i} className="h-4 w-4 text-[#f59e0b]" />
                        ))
                      ) : (
                        <span className="text-on-surface-faint">-</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    {record.toilet_bowl_wins > 0 ? (
                      <div className="flex items-center justify-center gap-0.5">
                        {Array.from({ length: record.toilet_bowl_wins }).map((_, i) => (
                          <span key={i} className="text-base" style={{ filter: 'sepia(1) saturate(3) hue-rotate(10deg) brightness(1.1)' }}>{'\u{1F6BD}'}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-on-surface-faint">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    {record.toilet_bowl_losses > 0 ? (
                      <div className="flex items-center justify-center gap-0.5">
                        {Array.from({ length: record.toilet_bowl_losses }).map((_, i) => (
                          <span key={i} className="text-base">{'\u{1F4A9}'}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-on-surface-faint">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right font-score text-on-surface">
                    {record.playoff_appearances}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </motion.section>
    </div>
  );
}
