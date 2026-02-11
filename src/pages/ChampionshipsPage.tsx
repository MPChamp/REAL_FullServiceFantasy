import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Crown, Medal, Award } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { formatScore } from '@/utils/formatting';
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
const allMatchups = matchupsData as WeeklyMatchup[];
const toiletBowls = toiletBowlsData as ToiletBowl[];

function getPlayerName(id: number): string {
  return players.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

export default function ChampionshipsPage() {
  usePageTitle('Championships');
  // Championship leaderboard
  const leaderboard = useMemo(() => {
    return [...allTimeRecords]
      .filter((r) => r.championships > 0 || r.runner_ups > 0)
      .sort((a, b) => {
        if (b.championships !== a.championships) return b.championships - a.championships;
        return b.runner_ups - a.runner_ups;
      });
  }, []);

  // Timeline of championships + toilet bowls
  const timeline = useMemo(() => {
    return championships
      .slice()
      .sort((a, b) => a.season_id - b.season_id)
      .map((champ) => {
        const game = allMatchups.find(
          (m) => m.season_id === champ.season_id && m.game_type === 'championship'
        );
        const tb = toiletBowls.find((t) => t.season_id === champ.season_id);
        return { ...champ, game, tb };
      });
  }, []);

  // Championship years per player
  const champYears = useMemo(() => {
    const map = new Map<number, number[]>();
    championships.forEach((c) => {
      const arr = map.get(c.winner_id) ?? [];
      arr.push(c.season_id);
      map.set(c.winner_id, arr);
    });
    return map;
  }, []);

  // Runner-up leaderboard
  const runnerUpLeaders = useMemo(() => {
    return [...allTimeRecords]
      .filter((r) => r.runner_ups > 0)
      .sort((a, b) => b.runner_ups - a.runner_ups);
  }, []);

  // Toilet bowl losers leaderboard (last place finishers)
  const toiletBowlLosers = useMemo(() => {
    const map = new Map<number, number[]>();
    toiletBowls.forEach((tb) => {
      const arr = map.get(tb.loser_id) ?? [];
      arr.push(tb.season_id);
      map.set(tb.loser_id, arr);
    });
    return Array.from(map.entries())
      .map(([playerId, years]) => ({
        playerId,
        name: getPlayerName(playerId),
        count: years.length,
        years: years.sort((a, b) => a - b),
      }))
      .sort((a, b) => b.count - a.count);
  }, []);

  // Toilet bowl winners leaderboard (escaped last place)
  const toiletBowlWinners = useMemo(() => {
    const map = new Map<number, number[]>();
    toiletBowls.forEach((tb) => {
      const arr = map.get(tb.winner_id) ?? [];
      arr.push(tb.season_id);
      map.set(tb.winner_id, arr);
    });
    return Array.from(map.entries())
      .map(([playerId, years]) => ({
        playerId,
        name: getPlayerName(playerId),
        count: years.length,
        years: years.sort((a, b) => a - b),
      }))
      .sort((a, b) => b.count - a.count);
  }, []);

  return (
    <div className="space-y-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          <Trophy className="h-10 w-10 text-[#f59e0b]" />
          <h1 className="font-display text-5xl md:text-6xl text-[#f59e0b] tracking-wider">
            Hall of Champions
          </h1>
          <Trophy className="h-10 w-10 text-[#f59e0b]" />
        </div>
        <p className="text-on-surface-muted font-heading text-lg">10 Seasons of Glory</p>
      </motion.div>

      {/* Championship Leaderboard */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-on-surface mb-6">Championship Leaderboard</h2>
        <div className="space-y-3">
          {leaderboard.map((record, idx) => {
            const years = champYears.get(record.player_id) ?? [];
            return (
              <motion.div
                key={record.player_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * idx }}
              >
                <Link
                  to={`/players/${record.player_id}`}
                  className={`glass-card flex items-center gap-4 p-4 hover:border-[#f59e0b]/30 transition-colors ${
                    idx === 0 ? 'border-[#f59e0b]/30 glow-gold' : ''
                  }`}
                >
                  <span className="font-display text-2xl text-on-surface-faint w-8 text-center">
                    {idx + 1}
                  </span>
                  <PlayerAvatar playerId={record.player_id} size="md" showRing />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-lg font-bold text-on-surface">{record.name}</span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: record.championships }).map((_, i) => (
                          <Trophy key={i} className="h-4 w-4 text-[#f59e0b]" />
                        ))}
                      </div>
                    </div>
                    {years.length > 0 && (
                      <span className="text-xs text-on-surface-faint">
                        Won: {years.join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-display text-3xl text-[#f59e0b]">{record.championships}</span>
                    <span className="text-xs text-on-surface-faint block">title{record.championships !== 1 ? 's' : ''}</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Championship Timeline */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-on-surface mb-6">Championship Timeline</h2>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-[#f59e0b]/20" />

          <div className="space-y-8">
            {timeline.map((champ, idx) => {
              const isLeft = idx % 2 === 0;
              const winnerName = getPlayerName(champ.winner_id);
              const runnerUpName = getPlayerName(champ.runner_up_id);

              let winnerScore = 0;
              let loserScore = 0;
              if (champ.game) {
                winnerScore = champ.game.player1_id === champ.winner_id
                  ? champ.game.player1_score
                  : champ.game.player2_score;
                loserScore = champ.game.player1_id === champ.runner_up_id
                  ? champ.game.player1_score
                  : champ.game.player2_score;
              }

              return (
                <motion.div
                  key={champ.season_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 * idx }}
                  className={`relative flex items-start gap-4 ${
                    isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
                  } flex-row`}
                >
                  {/* Timeline dot */}
                  <div className="absolute left-6 md:left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#f59e0b] border-2 border-surface z-10 mt-6" />

                  {/* Card */}
                  <div className={`ml-12 md:ml-0 md:w-[calc(50%-2rem)] ${isLeft ? '' : 'md:ml-auto'}`}>
                    <Link
                      to={`/seasons/${champ.season_id}`}
                      className="glass-card block p-5 border border-[#f59e0b]/10 hover:border-[#f59e0b]/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="font-display text-4xl text-[#f59e0b]">{champ.season_id}</span>
                        <Crown className="h-6 w-6 text-[#f59e0b]" />
                      </div>

                      <div className="flex items-center gap-3 mb-2">
                        <PlayerAvatar playerId={champ.winner_id} size="lg" showRing />
                        <div>
                          <span className="font-heading text-lg font-bold text-on-surface">{winnerName}</span>
                          <span className="block text-xs text-[#22c55e] font-heading font-semibold">CHAMPION</span>
                        </div>
                      </div>

                      {champ.game && (
                        <div className="font-score text-sm text-on-surface mb-2">
                          {formatScore(winnerScore)} - {formatScore(loserScore)}
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-on-surface-muted mt-2">
                        <PlayerAvatar playerId={champ.runner_up_id} size="sm" />
                        <span>vs {runnerUpName}</span>
                        <Medal className="h-3.5 w-3.5 text-on-surface-faint" />
                      </div>

                      {/* Toilet Bowl subsection */}
                      {champ.tb && (
                        <div className="mt-3 pt-3 border-t border-toilet-shame/20">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{'\u{1F4A9}'}</span>
                            <span className="text-xs font-heading font-semibold text-toilet-shame uppercase tracking-wide">Toilet Bowl</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <PlayerAvatar playerId={champ.tb.loser_id} size="sm" />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-on-surface font-heading font-medium">{getPlayerName(champ.tb.loser_id)}</span>
                              <span className="text-xs text-toilet-shame/60 ml-1">finished last</span>
                            </div>
                            <span className="font-score text-xs text-toilet-shame">
                              {formatScore(champ.tb.loser_score)} - {formatScore(champ.tb.winner_score)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <PlayerAvatar playerId={champ.tb.winner_id} size="sm" />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-on-surface font-heading font-medium">{getPlayerName(champ.tb.winner_id)}</span>
                              <span className="text-xs text-toilet-glory/60 ml-1">escaped</span>
                              <span className="ml-1" style={{ filter: 'sepia(1) saturate(3) hue-rotate(10deg) brightness(1.1)' }}>{'\u{1F6BD}'}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* Dynasty Watch */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Crown className="h-6 w-6 text-[#f59e0b]" />
          Dynasty Watch
        </h2>
        <div className="glass-card p-6 border border-[#f59e0b]/20">
          <div className="flex items-center gap-4 mb-4">
            <PlayerAvatar playerId={8} size="lg" showRing />
            <div>
              <h3 className="font-heading text-xl font-bold text-on-surface">Jake&apos;s Dynasty</h3>
              <p className="text-on-surface-muted text-sm">3x Champion (2021, 2022, 2025)</p>
            </div>
          </div>
          <p className="text-on-surface text-sm leading-relaxed">
            Jake cemented his legacy with back-to-back championships in 2021 and 2022, becoming the
            first (and only) manager to win consecutive titles. He then added a third ring in 2025,
            establishing himself as the most dominant champion in league history.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <Trophy className="h-4 w-4 text-[#f59e0b]" />
            <Trophy className="h-4 w-4 text-[#f59e0b]" />
            <Trophy className="h-4 w-4 text-[#f59e0b]" />
            <span className="text-xs text-on-surface-faint ml-1">Back-to-back 2021-22, and 2025</span>
          </div>
        </div>
      </motion.section>

      {/* Always the Bridesmaid */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Award className="h-6 w-6 text-on-surface-muted" />
          Always the Bridesmaid
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {runnerUpLeaders.map((record) => {
            const runnerUpYears = championships
              .filter((c) => c.runner_up_id === record.player_id)
              .map((c) => c.season_id);

            return (
              <Link
                key={record.player_id}
                to={`/players/${record.player_id}`}
                className="glass-card p-4 flex items-center gap-4 hover:border-border-default transition-colors"
              >
                <PlayerAvatar playerId={record.player_id} size="md" showRing />
                <div className="flex-1">
                  <span className="font-heading text-sm font-bold text-on-surface">{record.name}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {Array.from({ length: record.runner_ups }).map((_, i) => (
                      <Medal key={i} className="h-4 w-4 text-on-surface-muted" />
                    ))}
                  </div>
                  <span className="text-xs text-on-surface-faint block mt-0.5">
                    Runner-up: {runnerUpYears.join(', ')}
                  </span>
                </div>
                <span className="font-display text-2xl text-on-surface-muted">{record.runner_ups}</span>
              </Link>
            );
          })}
        </div>
      </motion.section>

      {/* The Porcelain Throne — Toilet Bowl Losers (Last Place) */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-[#92400e] mb-1 flex items-center gap-2">
          {'\u{1F4A9}'} The Porcelain Throne
        </h2>
        <p className="text-[#92400e]/60 text-sm mb-6 font-heading">Where Dreams Go to Die</p>
        <div className="space-y-3">
          {toiletBowlLosers.map((entry, idx) => (
            <motion.div
              key={entry.playerId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * idx }}
            >
              <Link
                to={`/players/${entry.playerId}`}
                className={`shame-card flex items-center gap-4 p-4 border border-[#92400e]/20 hover:border-[#92400e]/40 transition-colors ${
                  idx === 0 ? 'glow-shame' : ''
                }`}
              >
                <span className="font-display text-2xl text-[#92400e] w-8 text-center">
                  {idx + 1}
                </span>
                <PlayerAvatar playerId={entry.playerId} size="md" />
                <div className="flex-1">
                  <span className="font-heading text-lg font-bold text-on-surface">{entry.name}</span>
                  <span className="text-xs text-[#92400e]/60 block mt-0.5">
                    Last place: {entry.years.join(', ')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-display text-3xl text-[#92400e]">{entry.count}</span>
                  <span className="text-xs text-[#92400e]/60 block">
                    time{entry.count !== 1 ? 's' : ''}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Toilet Bowl Legends — Toilet Bowl Winners */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.7 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-[#d97706] mb-1 flex items-center gap-2">
          <span style={{ filter: 'sepia(1) saturate(3) hue-rotate(10deg) brightness(1.1)' }}>🚽</span> Toilet Bowl Legends
        </h2>
        <p className="text-[#d97706]/60 text-sm mb-6 font-heading">
          They Stared Into the Abyss and Escaped
        </p>
        <div className="space-y-3">
          {toiletBowlWinners.map((entry, idx) => (
            <motion.div
              key={entry.playerId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * idx }}
            >
              <Link
                to={`/players/${entry.playerId}`}
                className="glass-card flex items-center gap-4 p-4 border border-[#d97706]/20 hover:border-[#d97706]/40 transition-colors"
              >
                <span className="font-display text-2xl text-[#d97706] w-8 text-center">
                  {idx + 1}
                </span>
                <PlayerAvatar playerId={entry.playerId} size="md" />
                <div className="flex-1">
                  <span className="font-heading text-lg font-bold text-on-surface">{entry.name}</span>
                  <span className="text-xs text-[#d97706]/60 block mt-0.5">
                    Won: {entry.years.join(', ')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-display text-3xl text-[#d97706]">{entry.count}</span>
                  <span className="text-xs text-[#d97706]/60 block">
                    win{entry.count !== 1 ? 's' : ''}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
