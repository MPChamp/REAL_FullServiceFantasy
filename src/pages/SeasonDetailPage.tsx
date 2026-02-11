import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ArrowLeft, Award, Check, X, Star, Zap, Swords, Target, ArrowRightLeft, TrendingUp, CalendarDays } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { formatRecord, formatScore } from '@/utils/formatting';
import { getPlayerColor, getChartTooltipStyle } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import ScrollableTable from '@/components/common/ScrollableTable';
import { usePageTitle } from '@/hooks/usePageTitle';

import type { Player, Season, SeasonResult, Championship, WeeklyMatchup } from '@/data/types';
import playersData from '@/data/players.json';
import seasonsData from '@/data/seasons.json';
import seasonResultsData from '@/data/season-results.json';
import championshipsData from '@/data/championships.json';
import matchupsData from '@/data/matchups.json';

const players = playersData as Player[];
const seasons = seasonsData as Season[];
const seasonResults = seasonResultsData as SeasonResult[];
const championships = championshipsData as Championship[];
const allMatchups = matchupsData as WeeklyMatchup[];

function getPlayerName(id: number): string {
  return players.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

type SortKey = 'rank' | 'wins' | 'points_for' | 'points_against' | 'points_per_game' | 'points_against_per_game' | 'total_moves';

interface ScoreboardCell {
  score: number;
  opponentId: number;
  result: 'W' | 'L' | 'T';
}

export default function SeasonDetailPage() {
  const { year } = useParams<{ year: string }>();
  const yearNum = Number(year);
  usePageTitle(`${year} Season`);
  const { isDark } = useTheme();

  const season = seasons.find((s) => s.year === yearNum);
  const champ = championships.find((c) => c.season_id === yearNum);
  const results = useMemo(
    () => seasonResults.filter((r) => r.season_id === yearNum),
    [yearNum]
  );
  const matchups = useMemo(
    () => allMatchups.filter((m) => m.season_id === yearNum),
    [yearNum]
  );

  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const sortedResults = useMemo(() => {
    const sorted = [...results].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
    return sorted;
  }, [results, sortKey, sortAsc]);

  // Playoff matchups
  const playoffMatchups = useMemo(() => {
    return matchups.filter((m) => m.game_type !== 'regular');
  }, [matchups]);

  const semifinals = playoffMatchups.filter((m) => m.game_type === 'semifinal');
  const champGame = playoffMatchups.find((m) => m.game_type === 'championship');
  const thirdPlace = playoffMatchups.find((m) => m.game_type === '3rd_place');
  const toiletBowl = playoffMatchups.find((m) => m.game_type === 'toilet_bowl');

  // Regular season matchups and weeks
  const regularSeasonMatchups = useMemo(() => {
    return matchups.filter((m) => m.game_type === 'regular');
  }, [matchups]);

  const regularSeasonWeeks = useMemo(() => {
    const weekSet = new Set<number>();
    regularSeasonMatchups.forEach((m) => weekSet.add(m.week_start));
    return Array.from(weekSet).sort((a, b) => a - b);
  }, [regularSeasonMatchups]);

  // Season Superlatives
  const seasonSuperlatives = useMemo(() => {
    const mvp = results.reduce((best, r) =>
      r.points_per_game > best.points_per_game ? r : best, results[0]);

    let highScoreEntry = { playerId: 0, score: 0, week: 0, opponentId: 0 };
    for (const m of regularSeasonMatchups) {
      if (m.player1_score > highScoreEntry.score) {
        highScoreEntry = { playerId: m.player1_id, score: m.player1_score, week: m.week_start, opponentId: m.player2_id };
      }
      if (m.player2_score > highScoreEntry.score) {
        highScoreEntry = { playerId: m.player2_id, score: m.player2_score, week: m.week_start, opponentId: m.player1_id };
      }
    }

    let biggestBlowout = { winnerId: 0, loserId: 0, margin: 0, winnerScore: 0, loserScore: 0, week: 0 };
    for (const m of regularSeasonMatchups) {
      const margin = Math.abs(m.player1_score - m.player2_score);
      if (margin > biggestBlowout.margin) {
        const p1Won = m.player1_score > m.player2_score;
        biggestBlowout = {
          winnerId: p1Won ? m.player1_id : m.player2_id,
          loserId: p1Won ? m.player2_id : m.player1_id,
          margin,
          winnerScore: p1Won ? m.player1_score : m.player2_score,
          loserScore: p1Won ? m.player2_score : m.player1_score,
          week: m.week_start,
        };
      }
    }

    let closestGame = { winnerId: 0, loserId: 0, margin: Infinity, winnerScore: 0, loserScore: 0, week: 0 };
    for (const m of regularSeasonMatchups) {
      const margin = Math.abs(m.player1_score - m.player2_score);
      if (margin > 0 && margin < closestGame.margin) {
        const p1Won = m.player1_score > m.player2_score;
        closestGame = {
          winnerId: p1Won ? m.player1_id : m.player2_id,
          loserId: p1Won ? m.player2_id : m.player1_id,
          margin,
          winnerScore: p1Won ? m.player1_score : m.player2_score,
          loserScore: p1Won ? m.player2_score : m.player1_score,
          week: m.week_start,
        };
      }
    }

    const waiverWarrior = results.reduce((best, r) =>
      r.total_moves > best.total_moves ? r : best, results[0]);

    return { mvp, highScoreEntry, biggestBlowout, closestGame, waiverWarrior };
  }, [results, regularSeasonMatchups]);

  // Standings Race data (cumulative wins per player per week)
  const standingsRaceData = useMemo(() => {
    const cumulativeWins: Record<number, number> = {};
    const playerIds = results.map((r) => r.player_id);
    playerIds.forEach((id) => { cumulativeWins[id] = 0; });

    const data: Array<Record<string, number>> = [];

    for (const week of regularSeasonWeeks) {
      const weekGames = regularSeasonMatchups.filter((m) => m.week_start === week);
      for (const game of weekGames) {
        if (game.player1_score > game.player2_score) {
          cumulativeWins[game.player1_id] = (cumulativeWins[game.player1_id] || 0) + 1;
        } else if (game.player2_score > game.player1_score) {
          cumulativeWins[game.player2_id] = (cumulativeWins[game.player2_id] || 0) + 1;
        }
      }

      const point: Record<string, number> = { week };
      playerIds.forEach((id) => {
        point[`player_${id}`] = cumulativeWins[id] || 0;
      });
      data.push(point);
    }

    return { data, playerIds };
  }, [regularSeasonMatchups, regularSeasonWeeks, results]);

  // Scoreboard Grid data
  const scoreboardGrid = useMemo(() => {
    const rankedResults = [...results].sort((a, b) => a.rank - b.rank);

    let totalScores = 0;
    let scoreCount = 0;
    for (const m of regularSeasonMatchups) {
      totalScores += m.player1_score + m.player2_score;
      scoreCount += 2;
    }
    const seasonAvgScore = scoreCount > 0 ? totalScores / scoreCount : 100;

    const grid: Record<number, Record<number, ScoreboardCell>> = {};
    rankedResults.forEach((r) => { grid[r.player_id] = {}; });

    for (const m of regularSeasonMatchups) {
      const week = m.week_start;
      const p1Won = m.player1_score > m.player2_score;
      const p2Won = m.player2_score > m.player1_score;
      const tied = m.player1_score === m.player2_score;

      grid[m.player1_id][week] = {
        score: m.player1_score,
        opponentId: m.player2_id,
        result: tied ? 'T' : p1Won ? 'W' : 'L',
      };
      grid[m.player2_id][week] = {
        score: m.player2_score,
        opponentId: m.player1_id,
        result: tied ? 'T' : p2Won ? 'W' : 'L',
      };
    }

    return { rankedResults, grid, seasonAvgScore };
  }, [results, regularSeasonMatchups]);

  // Player Form data (W/L/T sequence per player)
  const playerFormData = useMemo(() => {
    const formMap: Record<number, Array<'W' | 'L' | 'T'>> = {};
    results.forEach((r) => { formMap[r.player_id] = []; });

    for (const week of regularSeasonWeeks) {
      const weekGames = regularSeasonMatchups.filter((m) => m.week_start === week);
      for (const game of weekGames) {
        const tied = game.player1_score === game.player2_score;
        const p1Won = game.player1_score > game.player2_score;

        if (tied) {
          formMap[game.player1_id]?.push('T');
          formMap[game.player2_id]?.push('T');
        } else if (p1Won) {
          formMap[game.player1_id]?.push('W');
          formMap[game.player2_id]?.push('L');
        } else {
          formMap[game.player1_id]?.push('L');
          formMap[game.player2_id]?.push('W');
        }
      }
    }

    return formMap;
  }, [results, regularSeasonMatchups, regularSeasonWeeks]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'rank');
    }
  }

  function SortHeader({ label, keyName, className = '' }: { label: string; keyName: SortKey; className?: string }) {
    const isActive = sortKey === keyName;
    return (
      <th
        className={`py-3 px-2 font-medium cursor-pointer select-none hover:text-on-surface transition-colors ${
          isActive ? 'text-[#f59e0b]' : 'text-on-surface-muted'
        } ${className}`}
        onClick={() => handleSort(keyName)}
      >
        {label}
        {isActive && <span className="ml-1">{sortAsc ? '\u2191' : '\u2193'}</span>}
      </th>
    );
  }

  function PlayoffMatchupCard({ matchup, label }: { matchup: WeeklyMatchup; label: string }) {
    const p1Name = getPlayerName(matchup.player1_id);
    const p2Name = getPlayerName(matchup.player2_id);
    const p1Won = matchup.player1_score > matchup.player2_score;
    const p2Won = matchup.player2_score > matchup.player1_score;

    return (
      <div className="glass-card p-4 border border-border-default">
        <div className="text-xs text-[#8b5cf6] font-heading font-semibold mb-3 uppercase tracking-wide">
          {label}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <PlayerAvatar playerId={matchup.player1_id} size="md" showRing />
            <div className="flex flex-col">
              <span className={`font-heading text-sm font-semibold ${p1Won ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {p1Name}
              </span>
              <span className={`font-score text-lg ${p1Won ? 'text-[#22c55e]' : 'text-on-surface-faint'}`}>
                {formatScore(matchup.player1_score)}
              </span>
            </div>
          </div>
          <span className="text-on-surface-faint text-xs font-heading">VS</span>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="flex flex-col items-end">
              <span className={`font-heading text-sm font-semibold ${p2Won ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {p2Name}
              </span>
              <span className={`font-score text-lg ${p2Won ? 'text-[#22c55e]' : 'text-on-surface-faint'}`}>
                {formatScore(matchup.player2_score)}
              </span>
            </div>
            <PlayerAvatar playerId={matchup.player2_id} size="md" showRing />
          </div>
        </div>
        {matchup.notes && (
          <div className="mt-2 text-xs text-on-surface-faint italic">{matchup.notes}</div>
        )}
      </div>
    );
  }

  function ToiletBowlMatchupCard({ matchup }: { matchup: WeeklyMatchup }) {
    const p1Name = getPlayerName(matchup.player1_id);
    const p2Name = getPlayerName(matchup.player2_id);
    const p1Won = matchup.player1_score > matchup.player2_score;
    const p2Won = matchup.player2_score > matchup.player1_score;

    return (
      <div className="shame-card p-4 border border-border-default">
        <div className="text-xs text-[#b45309] font-heading font-semibold mb-3 uppercase tracking-wide">
          {'\uD83D\uDEBD'} Toilet Bowl
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <PlayerAvatar playerId={matchup.player1_id} size="md" showRing />
            <div className="flex flex-col">
              <span className={`font-heading text-sm font-semibold ${p1Won ? 'text-[#d97706]' : 'text-[#ef4444]'}`}>
                {p1Name}
              </span>
              <span className={`text-[10px] uppercase font-heading font-semibold tracking-wide ${p1Won ? 'text-[#d97706]' : 'text-[#ef4444]'}`}>
                {p1Won ? 'Toilet Bowl Champion' : 'Last Place'}
              </span>
              <span className={`font-score text-lg ${p1Won ? 'text-[#d97706]' : 'text-on-surface-faint'}`}>
                {formatScore(matchup.player1_score)}
              </span>
            </div>
          </div>
          <span className="text-on-surface-faint text-xs font-heading">VS</span>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="flex flex-col items-end">
              <span className={`font-heading text-sm font-semibold ${p2Won ? 'text-[#d97706]' : 'text-[#ef4444]'}`}>
                {p2Name}
              </span>
              <span className={`text-[10px] uppercase font-heading font-semibold tracking-wide ${p2Won ? 'text-[#d97706]' : 'text-[#ef4444]'}`}>
                {p2Won ? 'Toilet Bowl Champion' : 'Last Place'}
              </span>
              <span className={`font-score text-lg ${p2Won ? 'text-[#d97706]' : 'text-on-surface-faint'}`}>
                {formatScore(matchup.player2_score)}
              </span>
            </div>
            <PlayerAvatar playerId={matchup.player2_id} size="md" showRing />
          </div>
        </div>
        {matchup.notes && (
          <div className="mt-2 text-xs text-on-surface-faint italic">{matchup.notes}</div>
        )}
      </div>
    );
  }

  if (!season) {
    return (
      <div className="text-center py-20">
        <h1 className="font-heading text-2xl text-on-surface">Season Not Found</h1>
        <Link to="/seasons" className="text-[#f59e0b] hover:underline mt-4 inline-block">
          Back to Seasons
        </Link>
      </div>
    );
  }

  const champGameMatchup = champGame;
  let champScore = '';
  if (champGameMatchup && champ) {
    const winnerScore = champGameMatchup.player1_id === champ.winner_id
      ? champGameMatchup.player1_score
      : champGameMatchup.player2_score;
    const loserScore = champGameMatchup.player1_id === champ.runner_up_id
      ? champGameMatchup.player1_score
      : champGameMatchup.player2_score;
    champScore = `${formatScore(winnerScore)} - ${formatScore(loserScore)}`;
  }

  function getCellBgColor(cell: ScoreboardCell, seasonAvg: number): string {
    const ratio = cell.score / seasonAvg;
    const clamped = Math.min(Math.max(ratio, 0.6), 1.4);
    const opacity = 0.05 + (clamped - 0.6) * (0.25 / 0.8);

    if (cell.result === 'W') return `rgba(34, 197, 94, ${opacity.toFixed(2)})`;
    if (cell.result === 'L') return `rgba(239, 68, 68, ${opacity.toFixed(2)})`;
    return `rgba(156, 163, 175, ${opacity.toFixed(2)})`;
  }

  return (
    <div className="space-y-10">
      {/* Back link */}
      <Link to="/seasons" className="inline-flex items-center gap-2 text-on-surface-muted hover:text-on-surface transition-colors text-sm">
        <ArrowLeft className="h-4 w-4" />
        All Seasons
      </Link>

      {/* Champion Banner */}
      {champ && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card p-6 md:p-8 border border-[#f59e0b]/20 text-center"
        >
          <div className="flex flex-col items-center gap-4">
            <PlayerAvatar playerId={champ.winner_id} size="xl" showRing />
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Trophy className="h-6 w-6 text-[#f59e0b]" />
                <h1 className="font-display text-4xl md:text-5xl text-[#f59e0b]">
                  {yearNum} Champion
                </h1>
              </div>
              <p className="font-heading text-xl text-on-surface font-semibold">
                {getPlayerName(champ.winner_id)}
              </p>
              {champScore && (
                <p className="font-score text-lg text-on-surface-muted mt-1">
                  {champScore} vs {getPlayerName(champ.runner_up_id)}
                </p>
              )}
            </div>
          </div>
          {season.playoff_format === 'combined' && (
            <p className="text-xs text-on-surface-faint mt-3 italic">
              * 2016 used a combined-week playoff format (scores from 2 weeks combined)
            </p>
          )}
        </motion.div>
      )}

      {/* Season Superlatives */}
      {results.length > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="font-heading text-2xl font-semibold text-on-surface mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-[#f59e0b]" />
            Season Awards
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="stat-card flex flex-col items-center text-center p-3">
              <Star className="h-5 w-5 text-[#f59e0b] mb-1" />
              <PlayerAvatar playerId={seasonSuperlatives.mvp.player_id} size="sm" showRing />
              <span className="font-heading text-xs text-on-surface font-semibold mt-1">
                {getPlayerName(seasonSuperlatives.mvp.player_id)}
              </span>
              <span className="font-score text-sm text-[#f59e0b]">
                {seasonSuperlatives.mvp.points_per_game.toFixed(1)} PPG
              </span>
              <span className="text-[10px] text-on-surface-faint uppercase tracking-wide mt-0.5">MVP</span>
            </div>

            <div className="stat-card flex flex-col items-center text-center p-3">
              <Zap className="h-5 w-5 text-[#22c55e] mb-1" />
              <PlayerAvatar playerId={seasonSuperlatives.highScoreEntry.playerId} size="sm" showRing />
              <span className="font-heading text-xs text-on-surface font-semibold mt-1">
                {getPlayerName(seasonSuperlatives.highScoreEntry.playerId)}
              </span>
              <span className="font-score text-sm text-[#22c55e]">
                {formatScore(seasonSuperlatives.highScoreEntry.score)}
              </span>
              <span className="text-[10px] text-on-surface-faint uppercase tracking-wide mt-0.5">
                High Score (Wk {seasonSuperlatives.highScoreEntry.week})
              </span>
            </div>

            <div className="stat-card flex flex-col items-center text-center p-3">
              <Swords className="h-5 w-5 text-[#ef4444] mb-1" />
              <PlayerAvatar playerId={seasonSuperlatives.biggestBlowout.winnerId} size="sm" showRing />
              <span className="font-heading text-xs text-on-surface font-semibold mt-1">
                {getPlayerName(seasonSuperlatives.biggestBlowout.winnerId)}
              </span>
              <span className="font-score text-sm text-[#ef4444]">
                +{seasonSuperlatives.biggestBlowout.margin.toFixed(1)}
              </span>
              <span className="text-[10px] text-on-surface-faint uppercase tracking-wide mt-0.5">
                Biggest Blowout (Wk {seasonSuperlatives.biggestBlowout.week})
              </span>
            </div>

            <div className="stat-card flex flex-col items-center text-center p-3">
              <Target className="h-5 w-5 text-[#06b6d4] mb-1" />
              <div className="flex -space-x-1 my-1">
                <PlayerAvatar playerId={seasonSuperlatives.closestGame.winnerId} size="sm" />
                <PlayerAvatar playerId={seasonSuperlatives.closestGame.loserId} size="sm" />
              </div>
              <span className="font-score text-sm text-[#06b6d4]">
                {formatScore(seasonSuperlatives.closestGame.winnerScore)}-{formatScore(seasonSuperlatives.closestGame.loserScore)}
              </span>
              <span className="text-[10px] text-on-surface-faint uppercase tracking-wide mt-0.5">
                Closest Game (Wk {seasonSuperlatives.closestGame.week})
              </span>
            </div>

            <div className="stat-card flex flex-col items-center text-center p-3">
              <ArrowRightLeft className="h-5 w-5 text-[#a855f7] mb-1" />
              <PlayerAvatar playerId={seasonSuperlatives.waiverWarrior.player_id} size="sm" showRing />
              <span className="font-heading text-xs text-on-surface font-semibold mt-1">
                {getPlayerName(seasonSuperlatives.waiverWarrior.player_id)}
              </span>
              <span className="font-score text-sm text-[#a855f7]">
                {seasonSuperlatives.waiverWarrior.total_moves} moves
              </span>
              <span className="text-[10px] text-on-surface-faint uppercase tracking-wide mt-0.5">Waiver Warrior</span>
            </div>
          </div>
        </motion.section>
      )}

      {/* Standings Table */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-on-surface mb-4">Regular Season Standings</h2>
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                <SortHeader label="#" keyName="rank" className="text-left w-8 sm:w-10" />
                <th className="py-3 px-1.5 sm:px-2 text-left font-medium text-on-surface-muted">Player</th>
                <th className="py-3 px-1.5 sm:px-2 text-left font-medium text-on-surface-muted whitespace-nowrap">Record</th>
                <SortHeader label="PF" keyName="points_for" className="text-right" />
                <SortHeader label="PA" keyName="points_against" className="text-right" />
                <SortHeader label="PPG" keyName="points_per_game" className="text-right" />
                <SortHeader label="PAPG" keyName="points_against_per_game" className="text-right" />
                <SortHeader label="Moves" keyName="total_moves" className="text-right" />
                <th className="py-3 px-2 text-center font-medium text-on-surface-muted">Form</th>
                <th className="py-3 px-1.5 sm:px-2 text-center font-medium text-on-surface-muted">Playoff</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((result) => (
                <tr
                  key={result.player_id}
                  className={`border-b border-border-default hover:bg-surface-inset/50 transition-colors ${
                    result.made_playoffs ? 'border-l-2 border-l-[#8b5cf6]' : ''
                  }`}
                >
                  <td className="py-3 px-1.5 sm:px-2 font-score text-on-surface-faint">{result.rank}</td>
                  <td className="py-3 px-1.5 sm:px-2">
                    <Link
                      to={`/players/${result.player_id}`}
                      className="flex items-center gap-2 hover:text-[#f59e0b] transition-colors"
                    >
                      <PlayerAvatar playerId={result.player_id} size="sm" showRing />
                      <span className="font-heading font-semibold text-on-surface text-sm">
                        {getPlayerName(result.player_id)}
                      </span>
                    </Link>
                  </td>
                  <td className="py-3 px-1.5 sm:px-2 font-score text-on-surface text-sm whitespace-nowrap">
                    {formatRecord(result.wins, result.losses, result.ties)}
                  </td>
                  <td className="py-3 px-1.5 sm:px-2 text-right font-score text-on-surface">{formatScore(result.points_for)}</td>
                  <td className="py-3 px-2 text-right font-score text-on-surface">{formatScore(result.points_against)}</td>
                  <td className="py-3 px-2 text-right font-score text-on-surface">{result.points_per_game.toFixed(1)}</td>
                  <td className="py-3 px-2 text-right font-score text-on-surface">
                    {result.points_against_per_game.toFixed(1)}
                  </td>
                  <td className="py-3 px-2 text-right font-score text-on-surface">
                    {result.total_moves}
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-0.5 justify-center">
                      {(playerFormData[result.player_id] || []).map((res, idx) => (
                        <span
                          key={idx}
                          className={`inline-block w-2 h-2 rounded-full ${
                            res === 'W' ? 'bg-[#22c55e]' : res === 'L' ? 'bg-[#ef4444]' : 'bg-gray-500'
                          }`}
                          title={`Week ${regularSeasonWeeks[idx] ?? idx + 1}: ${res}`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-1.5 sm:px-2 text-center">
                    {result.made_playoffs ? (
                      <Check className="h-4 w-4 text-[#22c55e] mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-on-surface-faint mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </motion.section>

      {/* Standings Race Chart */}
      {standingsRaceData.data.length > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="font-heading text-2xl font-semibold text-on-surface mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#22c55e]" />
            Standings Race
          </h2>
          <div className="glass-card p-4">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={standingsRaceData.data} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <XAxis
                  dataKey="week"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={getChartTooltipStyle(isDark)}
                  labelFormatter={(label) => `Week ${label}`}
                  formatter={(value: number | undefined, name: string | undefined) => {
                    const id = Number((name ?? '').replace('player_', ''));
                    return [value ?? 0, getPlayerName(id)];
                  }}
                />
                {standingsRaceData.playerIds.map((id) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={`player_${id}`}
                    stroke={getPlayerColor(id)}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    name={`player_${id}`}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
              {standingsRaceData.playerIds.map((id) => (
                <div key={id} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-0.5 rounded"
                    style={{ backgroundColor: getPlayerColor(id) }}
                  />
                  <span className="text-xs text-on-surface-muted font-heading">{getPlayerName(id)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      )}

      {/* Week-by-Week Results */}
      {regularSeasonWeeks.length > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          <h2 className="font-heading text-2xl font-semibold text-on-surface mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#06b6d4]" />
            Week-by-Week Results
          </h2>

          {/* Week tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-thin">
            {regularSeasonWeeks.map((week) => (
              <button
                key={week}
                onClick={() => setSelectedWeek(selectedWeek === week ? null : week)}
                className={`shrink-0 min-w-10 h-9 rounded-lg text-sm font-heading font-semibold transition-all ${
                  selectedWeek === week
                    ? 'bg-[#06b6d4] text-white shadow-lg shadow-[#06b6d4]/25'
                    : 'bg-surface-inset/50 text-on-surface-muted hover:bg-surface-inset hover:text-on-surface border border-border-default'
                }`}
              >
                {week}
              </button>
            ))}
          </div>

          {/* Selected week matchups */}
          {selectedWeek !== null && (
            <motion.div
              key={selectedWeek}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-4 space-y-3"
            >
              <h3 className="font-heading text-sm font-semibold text-[#06b6d4] uppercase tracking-wide">
                Week {selectedWeek} Matchups
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {regularSeasonMatchups
                  .filter((m) => m.week_start === selectedWeek)
                  .map((m) => {
                    const p1Won = m.player1_score > m.player2_score;
                    const p2Won = m.player2_score > m.player1_score;
                    return (
                      <div key={m.matchup_id} className="glass-card p-4 border border-border-default">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <PlayerAvatar playerId={m.player1_id} size="sm" showRing />
                            <div className="min-w-0">
                              <p className={`font-heading text-sm font-semibold truncate ${p1Won ? 'text-win' : p2Won ? 'text-loss' : 'text-on-surface'}`}>
                                {getPlayerName(m.player1_id)}
                              </p>
                              <p className={`font-score text-lg ${p1Won ? 'text-win' : 'text-on-surface-faint'}`}>
                                {formatScore(m.player1_score)}
                              </p>
                            </div>
                          </div>
                          <span className="text-on-surface-faint text-[10px] font-heading shrink-0">VS</span>
                          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                            <div className="min-w-0 text-right">
                              <p className={`font-heading text-sm font-semibold truncate ${p2Won ? 'text-win' : p1Won ? 'text-loss' : 'text-on-surface'}`}>
                                {getPlayerName(m.player2_id)}
                              </p>
                              <p className={`font-score text-lg ${p2Won ? 'text-win' : 'text-on-surface-faint'}`}>
                                {formatScore(m.player2_score)}
                              </p>
                            </div>
                            <PlayerAvatar playerId={m.player2_id} size="sm" showRing />
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          <span className={`text-[10px] font-heading font-semibold uppercase tracking-wide ${
                            p1Won || p2Won ? 'text-on-surface-faint' : 'text-on-surface-muted'
                          }`}>
                            {p1Won
                              ? `${getPlayerName(m.player1_id)} wins by ${(m.player1_score - m.player2_score).toFixed(1)}`
                              : p2Won
                                ? `${getPlayerName(m.player2_id)} wins by ${(m.player2_score - m.player1_score).toFixed(1)}`
                                : 'Tie'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}

          {selectedWeek === null && (
            <p className="mt-3 text-sm text-on-surface-faint italic">
              Tap a week number to see that week's matchups
            </p>
          )}
        </motion.section>
      )}

      {/* Full Season Scoreboard */}
      {regularSeasonWeeks.length > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="font-heading text-2xl font-semibold text-on-surface mb-4">Season Scoreboard</h2>
          <ScrollableTable>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="py-2 px-2 text-left font-medium text-on-surface-muted sticky left-0 bg-surface z-10 min-w-[80px]">
                    Player
                  </th>
                  {regularSeasonWeeks.map((week) => (
                    <th key={week} className="py-2 px-1 text-center font-medium text-on-surface-faint min-w-[56px]">
                      {week}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scoreboardGrid.rankedResults.map((result) => (
                  <tr key={result.player_id} className="border-b border-border-default">
                    <td className="py-1.5 px-2 sticky left-0 bg-surface z-10">
                      <div className="flex items-center gap-1.5">
                        <PlayerAvatar playerId={result.player_id} size="sm" />
                        <span className="font-heading text-xs text-on-surface font-semibold whitespace-nowrap">
                          {getPlayerName(result.player_id)}
                        </span>
                      </div>
                    </td>
                    {regularSeasonWeeks.map((week) => {
                      const cell = scoreboardGrid.grid[result.player_id]?.[week];
                      if (!cell) {
                        return <td key={week} className="py-1.5 px-1 text-center text-on-surface-faint">-</td>;
                      }

                      return (
                        <td
                          key={week}
                          className="py-1.5 px-1 text-center"
                          style={{ backgroundColor: getCellBgColor(cell, scoreboardGrid.seasonAvgScore) }}
                        >
                          <div className="font-score text-[11px] text-on-surface/90">
                            {formatScore(cell.score)}
                          </div>
                          <div className="text-[9px] text-on-surface-faint truncate">
                            {getPlayerName(cell.opponentId).slice(0, 5)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </motion.section>
      )}

      {/* Playoff Bracket */}
      {playoffMatchups.length > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <h2 className="font-heading text-2xl font-semibold text-on-surface mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-[#8b5cf6]" />
            Playoff Bracket
          </h2>
          {season.playoff_format === 'combined' && (
            <p className="text-xs text-on-surface-faint mb-4 italic">
              * 2016 playoffs used combined-week scoring (2 weeks of scores combined per round)
            </p>
          )}
          <div className="space-y-6">
            {/* Semifinals */}
            {semifinals.length > 0 && (
              <div>
                <h3 className="font-heading text-sm font-semibold text-[#8b5cf6] uppercase tracking-wide mb-3">
                  Semifinals
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {semifinals.map((m) => (
                    <PlayoffMatchupCard
                      key={m.matchup_id}
                      matchup={m}
                      label={`Semifinal ${m.matchup_id}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Championship & 3rd Place */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {champGame && (
                <PlayoffMatchupCard matchup={champGame} label="Championship" />
              )}
              {thirdPlace && (
                <PlayoffMatchupCard matchup={thirdPlace} label="3rd Place Game" />
              )}
            </div>

            {/* Toilet Bowl */}
            {toiletBowl && (
              <div>
                <ToiletBowlMatchupCard matchup={toiletBowl} />
              </div>
            )}
          </div>
        </motion.section>
      )}
    </div>
  );
}
