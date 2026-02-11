import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ReferenceLine, Legend,
} from 'recharts';
import {
  TrendingUp, Zap, Swords, Activity,
} from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import SeasonSelector from '@/components/common/SeasonSelector';
import { formatScore, formatPercent } from '@/utils/formatting';
import { getPlayerColor, getChartTooltipStyle } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { Player, SeasonResult, WeeklyMatchup, HeadToHeadRecord, Season } from '@/data/types';
import playersData from '@/data/players.json';
import seasonResultsData from '@/data/season-results.json';
import matchupsData from '@/data/matchups.json';
import headToHeadData from '@/data/head-to-head.json';
import seasonsData from '@/data/seasons.json';

const players = playersData as Player[];
const seasonResults = seasonResultsData as SeasonResult[];
const matchups = matchupsData as WeeklyMatchup[];
const headToHead = headToHeadData as Record<string, HeadToHeadRecord>;
const seasons = seasonsData as Season[];

function getPlayerName(id: number): string {
  return players.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

const tabs = [
  { id: 'luck', label: 'Luck Index', icon: <Zap className="h-4 w-4" /> },
  { id: 'clutch', label: 'Clutch vs Choke', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'rivalries', label: 'Biggest Rivalries', icon: <Swords className="h-4 w-4" /> },
  { id: 'momentum', label: 'Season Momentum', icon: <Activity className="h-4 w-4" /> },
] as const;

type TabId = (typeof tabs)[number]['id'];

// ========================= LUCK INDEX =========================

const PYTH_EXPONENT = 2.37;

interface LuckRow {
  playerId: number;
  name: string;
  seasonId: number;
  year: number;
  wins: number;
  losses: number;
  ties: number;
  games: number;
  pointsFor: number;
  pointsAgainst: number;
  expectedWinPct: number;
  expectedWins: number;
  luck: number;
}

function computeLuckData(): LuckRow[] {
  const rows: LuckRow[] = [];
  for (const sr of seasonResults) {
    const season = seasons.find((s) => s.season_id === sr.season_id);
    if (!season) continue;
    const games = sr.wins + sr.losses + sr.ties;
    if (games === 0) continue;
    const pfExp = Math.pow(sr.points_for, PYTH_EXPONENT);
    const paExp = Math.pow(sr.points_against, PYTH_EXPONENT);
    const expectedWinPct = pfExp / (pfExp + paExp);
    const expectedWins = expectedWinPct * games;
    const actualWins = sr.wins + sr.ties * 0.5;
    rows.push({
      playerId: sr.player_id,
      name: getPlayerName(sr.player_id),
      seasonId: sr.season_id,
      year: season.year,
      wins: sr.wins,
      losses: sr.losses,
      ties: sr.ties,
      games,
      pointsFor: sr.points_for,
      pointsAgainst: sr.points_against,
      expectedWinPct,
      expectedWins,
      luck: actualWins - expectedWins,
    });
  }
  return rows;
}

interface CareerLuck {
  playerId: number;
  name: string;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  totalGames: number;
  totalPF: number;
  totalPA: number;
  expectedWinPct: number;
  expectedWins: number;
  actualWins: number;
  luck: number;
}

function computeCareerLuck(rows: LuckRow[]): CareerLuck[] {
  const map = new Map<number, { wins: number; losses: number; ties: number; pf: number; pa: number; games: number }>();
  for (const r of rows) {
    const existing = map.get(r.playerId) ?? { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, games: 0 };
    existing.wins += r.wins;
    existing.losses += r.losses;
    existing.ties += r.ties;
    existing.pf += r.pointsFor;
    existing.pa += r.pointsAgainst;
    existing.games += r.games;
    map.set(r.playerId, existing);
  }

  const result: CareerLuck[] = [];
  for (const [playerId, d] of map) {
    const pfExp = Math.pow(d.pf, PYTH_EXPONENT);
    const paExp = Math.pow(d.pa, PYTH_EXPONENT);
    const expectedWinPct = pfExp / (pfExp + paExp);
    const expectedWins = expectedWinPct * d.games;
    const actualWins = d.wins + d.ties * 0.5;
    result.push({
      playerId,
      name: getPlayerName(playerId),
      totalWins: d.wins,
      totalLosses: d.losses,
      totalTies: d.ties,
      totalGames: d.games,
      totalPF: d.pf,
      totalPA: d.pa,
      expectedWinPct,
      expectedWins,
      actualWins,
      luck: actualWins - expectedWins,
    });
  }
  return result.sort((a, b) => b.luck - a.luck);
}

function LuckIndexSection() {
  const { isDark } = useTheme();
  const allLuckData = useMemo(() => computeLuckData(), []);
  const careerLuck = useMemo(() => computeCareerLuck(allLuckData), [allLuckData]);

  const chartData = careerLuck.map((c) => ({
    name: c.name,
    luck: Number(c.luck.toFixed(2)),
    playerId: c.playerId,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading text-lg font-semibold text-on-surface mb-1">Career Luck Index</h3>
        <p className="text-sm text-on-surface-muted mb-4">
          Pythagorean win expectation compares your actual wins to expected wins based on points scored/allowed.
          Positive = lucky, Negative = unlucky.
        </p>
      </div>

      {/* Career Bar Chart */}
      <div className="glass-card p-4">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }} layout="vertical">
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <ReferenceLine x={0} stroke="#6b7280" strokeDasharray="3 3" />
            <Tooltip
              contentStyle={getChartTooltipStyle(isDark)}
              formatter={(value: number | undefined) => [value != null ? `${value > 0 ? '+' : ''}${value} wins` : '0', 'Luck Index']}
            />
            <Bar dataKey="luck" radius={[0, 4, 4, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.playerId}
                  fill={entry.luck >= 0 ? '#22c55e' : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Career Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left">
              <th className="pb-2 pr-4 text-on-surface-faint font-heading text-xs uppercase tracking-wider">Player</th>
              <th className="pb-2 px-3 text-on-surface-faint font-heading text-xs uppercase tracking-wider text-center">Record</th>
              <th className="pb-2 px-3 text-on-surface-faint font-heading text-xs uppercase tracking-wider text-center">Exp Win%</th>
              <th className="pb-2 px-3 text-on-surface-faint font-heading text-xs uppercase tracking-wider text-center">Exp Wins</th>
              <th className="pb-2 px-3 text-on-surface-faint font-heading text-xs uppercase tracking-wider text-center">Actual Wins</th>
              <th className="pb-2 pl-3 text-on-surface-faint font-heading text-xs uppercase tracking-wider text-center">Luck</th>
            </tr>
          </thead>
          <tbody>
            {careerLuck.map((c) => (
              <tr key={c.playerId} className="border-b border-border-default/50">
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar playerId={c.playerId} size="sm" />
                    <span className="text-on-surface font-medium">{c.name}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-center font-score text-on-surface-muted">
                  {c.totalWins}-{c.totalLosses}-{c.totalTies}
                </td>
                <td className="py-2.5 px-3 text-center font-score text-on-surface-muted">
                  {formatPercent(c.expectedWinPct)}
                </td>
                <td className="py-2.5 px-3 text-center font-score text-on-surface-muted">
                  {c.expectedWins.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-center font-score text-on-surface-muted">
                  {c.actualWins}
                </td>
                <td className={`py-2.5 pl-3 text-center font-score font-bold ${
                  c.luck >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
                }`}>
                  {c.luck > 0 ? '+' : ''}{c.luck.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ========================= CLUTCH VS CHOKE =========================

interface ClutchRow {
  playerId: number;
  name: string;
  regularPPG: number;
  playoffPPG: number;
  regularGames: number;
  playoffGames: number;
  clutchFactor: number;
}

function computeClutchData(): ClutchRow[] {
  const stats = new Map<number, { regPts: number; regGames: number; playPts: number; playGames: number }>();

  for (const m of matchups) {
    const isPlayoff = m.game_type === 'semifinal' || m.game_type === 'championship' || m.game_type === '3rd_place';
    const isRegular = m.game_type === 'regular';
    if (!isPlayoff && !isRegular) continue;

    for (const [pid, score] of [[m.player1_id, m.player1_score], [m.player2_id, m.player2_score]] as [number, number][]) {
      const existing = stats.get(pid) ?? { regPts: 0, regGames: 0, playPts: 0, playGames: 0 };
      if (isRegular) {
        existing.regPts += score;
        existing.regGames += 1;
      } else {
        existing.playPts += score;
        existing.playGames += 1;
      }
      stats.set(pid, existing);
    }
  }

  const rows: ClutchRow[] = [];
  for (const [playerId, d] of stats) {
    if (d.playGames === 0) continue;
    const regularPPG = d.regGames > 0 ? d.regPts / d.regGames : 0;
    const playoffPPG = d.playPts / d.playGames;
    rows.push({
      playerId,
      name: getPlayerName(playerId),
      regularPPG,
      playoffPPG,
      regularGames: d.regGames,
      playoffGames: d.playGames,
      clutchFactor: playoffPPG - regularPPG,
    });
  }
  return rows.sort((a, b) => b.clutchFactor - a.clutchFactor);
}

function ClutchSection() {
  const { isDark } = useTheme();
  const clutchData = useMemo(() => computeClutchData(), []);

  const chartData = clutchData.map((c) => ({
    name: c.name,
    regular: Number(c.regularPPG.toFixed(1)),
    playoff: Number(c.playoffPPG.toFixed(1)),
    playerId: c.playerId,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading text-lg font-semibold text-on-surface mb-1">Clutch vs Choke Analysis</h3>
        <p className="text-sm text-on-surface-muted mb-4">
          Compares regular season PPG to playoff PPG (semis, championship, 3rd place).
          Positive clutch factor = performs better in playoffs.
        </p>
      </div>

      {/* Grouped Bar Chart */}
      <div className="glass-card p-4">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              domain={['dataMin - 10', 'dataMax + 5']}
            />
            <Tooltip contentStyle={getChartTooltipStyle(isDark)} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
            <Bar dataKey="regular" name="Regular PPG" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="playoff" name="Playoff PPG" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left">
              <th className="pb-2 pr-4 text-on-surface-faint font-heading text-xs uppercase tracking-wider">Player</th>
              <th className="pb-2 px-3 text-on-surface-faint font-heading text-xs uppercase tracking-wider text-center">Reg PPG</th>
              <th className="pb-2 px-3 text-on-surface-faint font-heading text-xs uppercase tracking-wider text-center">Reg Games</th>
              <th className="pb-2 px-3 text-on-surface-faint font-heading text-xs uppercase tracking-wider text-center">Playoff PPG</th>
              <th className="pb-2 px-3 text-on-surface-faint font-heading text-xs uppercase tracking-wider text-center">Playoff Games</th>
              <th className="pb-2 pl-3 text-on-surface-faint font-heading text-xs uppercase tracking-wider text-center">Clutch Factor</th>
            </tr>
          </thead>
          <tbody>
            {clutchData.map((c) => (
              <tr key={c.playerId} className="border-b border-border-default/50">
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar playerId={c.playerId} size="sm" />
                    <span className="text-on-surface font-medium">{c.name}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-center font-score text-on-surface-muted">
                  {c.regularPPG.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-center font-score text-on-surface-faint">
                  {c.regularGames}
                </td>
                <td className="py-2.5 px-3 text-center font-score text-on-surface-muted">
                  {c.playoffPPG.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-center font-score text-on-surface-faint">
                  {c.playoffGames}
                </td>
                <td className={`py-2.5 pl-3 text-center font-score font-bold ${
                  c.clutchFactor >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
                }`}>
                  {c.clutchFactor > 0 ? '+' : ''}{c.clutchFactor.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ========================= BIGGEST RIVALRIES =========================

interface RivalryData {
  player1Id: number;
  player2Id: number;
  player1Name: string;
  player2Name: string;
  player1Wins: number;
  player2Wins: number;
  ties: number;
  totalMatchups: number;
  avgMargin: number;
  closenessScore: number;
  totalPoints: number;
  rivalryScore: number;
}

function computeRivalries(): RivalryData[] {
  const rivalries: RivalryData[] = [];
  const entries = Object.values(headToHead);

  for (const h2h of entries) {
    if (h2h.total_matchups === 0) continue;

    // Closeness: how even is the win-loss record? (1 = perfectly even, 0 = total domination)
    const maxWins = Math.max(h2h.player1_wins, h2h.player2_wins);
    const minWins = Math.min(h2h.player1_wins, h2h.player2_wins);
    const closenessScore = h2h.total_matchups > 0
      ? 1 - (maxWins - minWins) / h2h.total_matchups
      : 0;

    // Average margin of all matchups
    let totalMargin = 0;
    for (const m of h2h.matchups) {
      totalMargin += Math.abs(m.player1_score - m.player2_score);
    }
    const avgMargin = totalMargin / h2h.total_matchups;

    // Rivalry score: weighted combination
    // High matchup count + close record + low margins = intense rivalry
    const matchupWeight = Math.min(h2h.total_matchups / 20, 1); // normalize to ~20 max matchups
    const marginFactor = Math.max(0, 1 - avgMargin / 40); // closer games = higher factor
    const rivalryScore = (closenessScore * 40 + matchupWeight * 30 + marginFactor * 30);

    rivalries.push({
      player1Id: h2h.player1_id,
      player2Id: h2h.player2_id,
      player1Name: getPlayerName(h2h.player1_id),
      player2Name: getPlayerName(h2h.player2_id),
      player1Wins: h2h.player1_wins,
      player2Wins: h2h.player2_wins,
      ties: h2h.ties,
      totalMatchups: h2h.total_matchups,
      avgMargin,
      closenessScore,
      totalPoints: h2h.player1_total_points + h2h.player2_total_points,
      rivalryScore,
    });
  }

  return rivalries.sort((a, b) => b.rivalryScore - a.rivalryScore);
}

function getRivalryTier(score: number): { label: string; color: string; bg: string } {
  if (score >= 75) return { label: 'LEGENDARY', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10 border-[#f59e0b]/30' };
  if (score >= 60) return { label: 'INTENSE', color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10 border-[#ef4444]/30' };
  if (score >= 45) return { label: 'HEATED', color: 'text-[#f97316]', bg: 'bg-[#f97316]/10 border-[#f97316]/30' };
  if (score >= 30) return { label: 'COMPETITIVE', color: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/10 border-[#3b82f6]/30' };
  return { label: 'CASUAL', color: 'text-on-surface-muted', bg: 'bg-surface-inset/30 border-border-default' };
}

function RivalriesSection() {
  const rivalries = useMemo(() => computeRivalries(), []);
  const top15 = rivalries.slice(0, 15);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading text-lg font-semibold text-on-surface mb-1">Biggest Rivalries</h3>
        <p className="text-sm text-on-surface-muted mb-4">
          Rivalries are scored by record closeness (40%), total matchups (30%), and average game margin (30%).
          The tighter the battles, the higher the rivalry tier.
        </p>
      </div>

      <div className="space-y-3">
        {top15.map((r, idx) => {
          const tier = getRivalryTier(r.rivalryScore);
          const p1Leading = r.player1Wins > r.player2Wins;
          const p2Leading = r.player2Wins > r.player1Wins;

          return (
            <motion.div
              key={`${r.player1Id}_${r.player2Id}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className={`glass-card p-4 border ${tier.bg}`}
            >
              <div className="flex items-center gap-4">
                {/* Rank */}
                <span className="font-display text-2xl text-on-surface-faint w-8 shrink-0 text-center">
                  {idx + 1}
                </span>

                {/* Player 1 */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <PlayerAvatar playerId={r.player1Id} size="sm" />
                  <span className={`font-heading text-sm truncate ${p1Leading ? 'text-on-surface font-semibold' : 'text-on-surface-muted'}`}>
                    {r.player1Name}
                  </span>
                </div>

                {/* Record */}
                <div className="text-center shrink-0 px-2">
                  <div className="font-score text-lg">
                    <span className={p1Leading ? 'text-[#22c55e]' : p2Leading ? 'text-[#ef4444]' : 'text-on-surface-muted'}>
                      {r.player1Wins}
                    </span>
                    <span className="text-on-surface-faint mx-1">-</span>
                    <span className={p2Leading ? 'text-[#22c55e]' : p1Leading ? 'text-[#ef4444]' : 'text-on-surface-muted'}>
                      {r.player2Wins}
                    </span>
                    {r.ties > 0 && (
                      <span className="text-on-surface-faint">-{r.ties}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-on-surface-faint">{r.totalMatchups} games</span>
                </div>

                {/* Player 2 */}
                <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
                  <span className={`font-heading text-sm truncate text-right ${p2Leading ? 'text-on-surface font-semibold' : 'text-on-surface-muted'}`}>
                    {r.player2Name}
                  </span>
                  <PlayerAvatar playerId={r.player2Id} size="sm" />
                </div>

                {/* Tier Badge */}
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${tier.bg} ${tier.color}`}>
                  {tier.label}
                </span>
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-6 mt-2 ml-12 text-[11px] text-on-surface-faint">
                <span>Avg margin: <span className="font-score text-on-surface-muted">{r.avgMargin.toFixed(1)}</span> pts</span>
                <span>Closeness: <span className="font-score text-on-surface-muted">{(r.closenessScore * 100).toFixed(0)}%</span></span>
                <span>Rivalry score: <span className={`font-score font-semibold ${tier.color}`}>{r.rivalryScore.toFixed(1)}</span></span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ========================= SEASON MOMENTUM =========================

interface WeekScore {
  week: number;
  label: string;
  score: number;
  result: 'W' | 'L' | 'T';
}

interface PlayerMomentum {
  playerId: number;
  name: string;
  weeks: WeekScore[];
  longestWinStreak: number;
  longestLossStreak: number;
  hotStreak: string;
}

function computeMomentum(year: number): PlayerMomentum[] {
  const season = seasons.find((s) => s.year === year);
  if (!season) return [];

  const regularMatchups = matchups.filter(
    (m) => m.season_id === season.season_id && m.game_type === 'regular'
  );

  const playerWeeks = new Map<number, WeekScore[]>();

  for (const m of regularMatchups) {
    for (const [pid, myScore, oppScore] of [
      [m.player1_id, m.player1_score, m.player2_score],
      [m.player2_id, m.player2_score, m.player1_score],
    ] as [number, number, number][]) {
      const weeks = playerWeeks.get(pid) ?? [];
      const result: 'W' | 'L' | 'T' = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
      weeks.push({
        week: m.week_start,
        label: `Wk ${m.week_start}`,
        score: myScore,
        result,
      });
      playerWeeks.set(pid, weeks);
    }
  }

  const result: PlayerMomentum[] = [];
  for (const [playerId, weeks] of playerWeeks) {
    weeks.sort((a, b) => a.week - b.week);

    // Calculate streaks
    let longestWin = 0;
    let longestLoss = 0;
    let currentWin = 0;
    let currentLoss = 0;
    for (const w of weeks) {
      if (w.result === 'W') {
        currentWin++;
        currentLoss = 0;
        longestWin = Math.max(longestWin, currentWin);
      } else if (w.result === 'L') {
        currentLoss++;
        currentWin = 0;
        longestLoss = Math.max(longestLoss, currentLoss);
      } else {
        currentWin = 0;
        currentLoss = 0;
      }
    }

    // Hot/cold streak at end of season
    let endStreak = '';
    if (weeks.length >= 3) {
      const last3 = weeks.slice(-3);
      const wins3 = last3.filter((w) => w.result === 'W').length;
      if (wins3 === 3) endStreak = 'ON FIRE';
      else if (wins3 === 0) endStreak = 'ICE COLD';
      else if (wins3 >= 2) endStreak = 'Heating Up';
      else endStreak = 'Cooling Down';
    }

    result.push({
      playerId,
      name: getPlayerName(playerId),
      weeks,
      longestWinStreak: longestWin,
      longestLossStreak: longestLoss,
      hotStreak: endStreak,
    });
  }

  return result.sort((a, b) => b.longestWinStreak - a.longestWinStreak);
}

function MomentumSection() {
  const { isDark } = useTheme();
  const years = seasons.map((s) => s.year);
  const [selectedYear, setSelectedYear] = useState(years[years.length - 1]);
  const momentum = useMemo(() => computeMomentum(selectedYear), [selectedYear]);

  // Build chart data: week-by-week scores for all players
  const chartData = useMemo(() => {
    if (momentum.length === 0) return [];
    const maxWeeks = Math.max(...momentum.map((p) => p.weeks.length));
    const data: Record<string, number | string>[] = [];
    for (let i = 0; i < maxWeeks; i++) {
      const point: Record<string, number | string> = { week: `Wk ${i + 1}` };
      for (const p of momentum) {
        if (p.weeks[i]) {
          point[p.name] = p.weeks[i].score;
        }
      }
      data.push(point);
    }
    return data;
  }, [momentum]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading text-lg font-semibold text-on-surface mb-1">Season Momentum</h3>
        <p className="text-sm text-on-surface-muted mb-4">
          Track scoring trends, win streaks, and hot/cold runs throughout each season.
        </p>
      </div>

      <SeasonSelector value={selectedYear} onChange={setSelectedYear} years={years} />

      {/* Line Chart */}
      <div className="glass-card p-4">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
            <XAxis
              dataKey="week"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={getChartTooltipStyle(isDark)} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            {momentum.map((p) => (
              <Line
                key={p.playerId}
                type="monotone"
                dataKey={p.name}
                stroke={getPlayerColor(p.playerId)}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Streak Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {momentum.map((p) => {
          const streakColor =
            p.hotStreak === 'ON FIRE' ? 'text-[#ef4444]' :
            p.hotStreak === 'Heating Up' ? 'text-[#f97316]' :
            p.hotStreak === 'ICE COLD' ? 'text-[#3b82f6]' :
            p.hotStreak === 'Cooling Down' ? 'text-[#06b6d4]' :
            'text-on-surface-muted';

          return (
            <div key={p.playerId} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <PlayerAvatar playerId={p.playerId} size="sm" />
                <span className="font-heading text-sm font-semibold text-on-surface">{p.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="font-score text-lg font-bold text-[#22c55e]">{p.longestWinStreak}</p>
                  <p className="text-[10px] uppercase text-on-surface-faint">Win Streak</p>
                </div>
                <div>
                  <p className="font-score text-lg font-bold text-[#ef4444]">{p.longestLossStreak}</p>
                  <p className="text-[10px] uppercase text-on-surface-faint">Loss Streak</p>
                </div>
                <div>
                  <p className={`font-score text-xs font-bold ${streakColor}`}>{p.hotStreak || '—'}</p>
                  <p className="text-[10px] uppercase text-on-surface-faint">End Form</p>
                </div>
              </div>
              {/* Mini W/L bar */}
              <div className="flex gap-0.5 mt-3">
                {p.weeks.map((w, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-sm ${
                      w.result === 'W' ? 'bg-[#22c55e]' : w.result === 'L' ? 'bg-[#ef4444]' : 'bg-gray-500'
                    }`}
                    title={`Wk ${w.week}: ${formatScore(w.score)} (${w.result})`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========================= MAIN PAGE =========================

export default function AnalyticsPage() {
  usePageTitle('Analytics');
  const [activeTab, setActiveTab] = useState<TabId>('luck');

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="font-heading text-4xl font-bold text-on-surface flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-[#a855f7]" />
          Analytics
        </h1>
        <p className="text-on-surface-muted mt-2">
          Deep-dive statistics, luck metrics, rivalry rankings, and momentum tracking.
        </p>
      </motion.div>

      {/* Tab Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-[#a855f7] text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                : 'bg-surface-inset text-on-surface-muted hover:bg-surface-inset/80 hover:text-on-surface'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'luck' && <LuckIndexSection />}
          {activeTab === 'clutch' && <ClutchSection />}
          {activeTab === 'rivalries' && <RivalriesSection />}
          {activeTab === 'momentum' && <MomentumSection />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
