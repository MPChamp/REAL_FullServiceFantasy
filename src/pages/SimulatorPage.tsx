import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Shuffle, FlipVertical } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import SeasonSelector from '@/components/common/SeasonSelector';
import { formatScore } from '@/utils/formatting';
import { usePageTitle } from '@/hooks/usePageTitle';

import type { Player, Season, WeeklyMatchup } from '@/data/types';
import playersData from '@/data/players.json';
import seasonsData from '@/data/seasons.json';
import matchupsData from '@/data/matchups.json';

const players = playersData as Player[];
const seasons = seasonsData as Season[];
const allMatchups = matchupsData as WeeklyMatchup[];

function getPlayerName(id: number): string {
  return players.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

const tabs = [
  { id: 'swap', label: 'Schedule Swap', icon: <Shuffle className="h-4 w-4" /> },
  { id: 'flip', label: 'Flip Closest Games', icon: <FlipVertical className="h-4 w-4" /> },
] as const;

type TabId = (typeof tabs)[number]['id'];

// ========================= SCHEDULE SWAP =========================

interface SimStanding {
  playerId: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  rank: number;
}

function computeStandings(seasonMatchups: WeeklyMatchup[]): SimStanding[] {
  const regular = seasonMatchups.filter((m) => m.game_type === 'regular');
  const stats = new Map<number, { wins: number; losses: number; ties: number; pf: number }>();

  for (const m of regular) {
    for (const [pid, myScore, oppScore] of [
      [m.player1_id, m.player1_score, m.player2_score],
      [m.player2_id, m.player2_score, m.player1_score],
    ] as [number, number, number][]) {
      const s = stats.get(pid) ?? { wins: 0, losses: 0, ties: 0, pf: 0 };
      if (myScore > oppScore) s.wins++;
      else if (myScore < oppScore) s.losses++;
      else s.ties++;
      s.pf += myScore;
      stats.set(pid, s);
    }
  }

  const standings: SimStanding[] = [];
  for (const [playerId, s] of stats) {
    standings.push({
      playerId,
      name: getPlayerName(playerId),
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      pointsFor: s.pf,
      rank: 0,
    });
  }

  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return b.pointsFor - a.pointsFor;
  });
  standings.forEach((s, i) => { s.rank = i + 1; });
  return standings;
}

function computeSwappedStandings(
  seasonMatchups: WeeklyMatchup[],
  swapA: number,
  swapB: number,
): SimStanding[] {
  const regular = seasonMatchups.filter((m) => m.game_type === 'regular');

  // For each player, collect their weekly scores
  const weeklyScores = new Map<number, Map<number, number>>();
  for (const m of regular) {
    for (const [pid, score] of [
      [m.player1_id, m.player1_score],
      [m.player2_id, m.player2_score],
    ] as [number, number][]) {
      if (!weeklyScores.has(pid)) weeklyScores.set(pid, new Map());
      weeklyScores.get(pid)!.set(m.week_start, score);
    }
  }

  // For each player, collect their weekly opponents
  const weeklyOpponents = new Map<number, Map<number, number>>();
  for (const m of regular) {
    if (!weeklyOpponents.has(m.player1_id)) weeklyOpponents.set(m.player1_id, new Map());
    if (!weeklyOpponents.has(m.player2_id)) weeklyOpponents.set(m.player2_id, new Map());
    weeklyOpponents.get(m.player1_id)!.set(m.week_start, m.player2_id);
    weeklyOpponents.get(m.player2_id)!.set(m.week_start, m.player1_id);
  }

  // Swap: give A's opponents to B and B's opponents to A
  const swappedOpponents = new Map<number, Map<number, number>>();
  for (const [pid, opps] of weeklyOpponents) {
    if (pid === swapA) {
      swappedOpponents.set(pid, new Map(weeklyOpponents.get(swapB)!));
    } else if (pid === swapB) {
      swappedOpponents.set(pid, new Map(weeklyOpponents.get(swapA)!));
    } else {
      swappedOpponents.set(pid, new Map(opps));
    }
  }

  // Recalculate records using original scores but swapped opponents
  const stats = new Map<number, { wins: number; losses: number; ties: number; pf: number }>();
  for (const [pid, scores] of weeklyScores) {
    const s = { wins: 0, losses: 0, ties: 0, pf: 0 };
    const opps = swappedOpponents.get(pid);
    if (!opps) continue;

    for (const [week, myScore] of scores) {
      s.pf += myScore;
      const oppId = opps.get(week);
      if (oppId === undefined) continue;
      const oppScore = weeklyScores.get(oppId)?.get(week);
      if (oppScore === undefined) continue;

      if (myScore > oppScore) s.wins++;
      else if (myScore < oppScore) s.losses++;
      else s.ties++;
    }
    stats.set(pid, s);
  }

  const standings: SimStanding[] = [];
  for (const [playerId, s] of stats) {
    standings.push({
      playerId,
      name: getPlayerName(playerId),
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      pointsFor: s.pf,
      rank: 0,
    });
  }

  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return b.pointsFor - a.pointsFor;
  });
  standings.forEach((s, i) => { s.rank = i + 1; });
  return standings;
}

function ScheduleSwapSection() {
  const years = seasons.map((s) => s.year);
  const [selectedYear, setSelectedYear] = useState(years[years.length - 1]);
  const [swapA, setSwapA] = useState<number | null>(null);
  const [swapB, setSwapB] = useState<number | null>(null);

  const seasonMatchups = useMemo(() => {
    const season = seasons.find((s) => s.year === selectedYear);
    if (!season) return [];
    return allMatchups.filter((m) => m.season_id === season.season_id);
  }, [selectedYear]);

  const originalStandings = useMemo(() => computeStandings(seasonMatchups), [seasonMatchups]);

  const swappedStandings = useMemo(() => {
    if (swapA === null || swapB === null) return null;
    return computeSwappedStandings(seasonMatchups, swapA, swapB);
  }, [seasonMatchups, swapA, swapB]);

  function handlePlayerClick(pid: number) {
    if (swapA === null) {
      setSwapA(pid);
    } else if (swapB === null && pid !== swapA) {
      setSwapB(pid);
    } else {
      setSwapA(pid);
      setSwapB(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading text-lg font-semibold text-on-surface mb-1">Schedule Swap</h3>
        <p className="text-sm text-on-surface-muted mb-4">
          What if two players swapped their regular season opponents? Select a season and pick two players
          to see how everyone&apos;s record would change.
        </p>
      </div>

      <SeasonSelector value={selectedYear} onChange={(y) => { setSelectedYear(y); setSwapA(null); setSwapB(null); }} years={years} />

      {/* Player Picker */}
      <div>
        <p className="text-xs text-on-surface-faint mb-2 uppercase tracking-wider font-heading">
          {swapA === null ? 'Select first player' : swapB === null ? 'Select second player' : 'Click a player to reset'}
        </p>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => {
            const isA = swapA === p.player_id;
            const isB = swapB === p.player_id;
            return (
              <button
                key={p.player_id}
                type="button"
                onClick={() => handlePlayerClick(p.player_id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer border ${
                  isA
                    ? 'border-[#3b82f6] bg-[#3b82f6]/15 text-[#3b82f6]'
                    : isB
                    ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]'
                    : 'border-border-default bg-surface-card/50 text-on-surface-muted hover:text-on-surface hover:bg-surface-card'
                }`}
              >
                <PlayerAvatar playerId={p.player_id} size="sm" />
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Standings Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Original */}
        <div>
          <h4 className="font-heading text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2">
            Original Standings
          </h4>
          <div className="space-y-1">
            {originalStandings.map((s) => {
              const isSwapped = s.playerId === swapA || s.playerId === swapB;
              return (
                <div
                  key={s.playerId}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                    isSwapped ? 'bg-surface-inset/80 border border-border-default' : 'bg-surface-card/30'
                  }`}
                >
                  <span className="text-xs text-on-surface-faint font-score w-5">{s.rank}</span>
                  <PlayerAvatar playerId={s.playerId} size="sm" />
                  <span className="text-sm text-on-surface font-medium flex-1">{s.name}</span>
                  <span className="font-score text-sm text-on-surface-muted">
                    {s.wins}-{s.losses}{s.ties > 0 ? `-${s.ties}` : ''}
                  </span>
                  <span className="font-score text-xs text-on-surface-faint w-14 text-right">
                    {formatScore(s.pointsFor)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Swapped */}
        <div>
          <h4 className="font-heading text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2">
            {swappedStandings
              ? `Swapped: ${getPlayerName(swapA!)} ↔ ${getPlayerName(swapB!)}`
              : 'Simulated Standings'}
          </h4>
          {swappedStandings ? (
            <div className="space-y-1">
              {swappedStandings.map((s) => {
                const orig = originalStandings.find((o) => o.playerId === s.playerId);
                const rankDiff = orig ? orig.rank - s.rank : 0;
                const isSwapped = s.playerId === swapA || s.playerId === swapB;

                return (
                  <div
                    key={s.playerId}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                      isSwapped ? 'bg-surface-inset/80 border border-border-default' : 'bg-surface-card/30'
                    }`}
                  >
                    <span className="text-xs text-on-surface-faint font-score w-5">{s.rank}</span>
                    <PlayerAvatar playerId={s.playerId} size="sm" />
                    <span className="text-sm text-on-surface font-medium flex-1">{s.name}</span>
                    <span className="font-score text-sm text-on-surface-muted">
                      {s.wins}-{s.losses}{s.ties > 0 ? `-${s.ties}` : ''}
                    </span>
                    {rankDiff !== 0 && (
                      <span className={`text-[10px] font-bold ${rankDiff > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {rankDiff > 0 ? `+${rankDiff}` : rankDiff}
                      </span>
                    )}
                    <span className="font-score text-xs text-on-surface-faint w-14 text-right">
                      {formatScore(s.pointsFor)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card p-8 text-center text-on-surface-muted text-sm">
              Select two players above to simulate a schedule swap
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================= FLIP CLOSEST GAMES =========================

interface CloseGame {
  matchup: WeeklyMatchup;
  margin: number;
  winnerId: number;
  loserId: number;
  winnerScore: number;
  loserScore: number;
  week: number;
}

function FlipGamesSection() {
  const years = seasons.map((s) => s.year);
  const [selectedYear, setSelectedYear] = useState(years[years.length - 1]);
  const [flippedIds, setFlippedIds] = useState<Set<number>>(new Set());

  const seasonMatchups = useMemo(() => {
    const season = seasons.find((s) => s.year === selectedYear);
    if (!season) return [];
    return allMatchups.filter((m) => m.season_id === season.season_id);
  }, [selectedYear]);

  const closeGames = useMemo(() => {
    const regular = seasonMatchups.filter((m) => m.game_type === 'regular' && m.player1_score !== m.player2_score);
    const games: CloseGame[] = regular.map((m) => {
      const p1Wins = m.player1_score > m.player2_score;
      return {
        matchup: m,
        margin: Math.abs(m.player1_score - m.player2_score),
        winnerId: p1Wins ? m.player1_id : m.player2_id,
        loserId: p1Wins ? m.player2_id : m.player1_id,
        winnerScore: p1Wins ? m.player1_score : m.player2_score,
        loserScore: p1Wins ? m.player2_score : m.player1_score,
        week: m.week_start,
      };
    });
    return games.sort((a, b) => a.margin - b.margin);
  }, [seasonMatchups]);

  const originalStandings = useMemo(() => computeStandings(seasonMatchups), [seasonMatchups]);

  const simulatedStandings = useMemo(() => {
    if (flippedIds.size === 0) return originalStandings;

    // Clone matchups and flip the selected ones
    const modified = seasonMatchups.map((m) => {
      if (flippedIds.has(m.matchup_id)) {
        return {
          ...m,
          player1_score: m.player2_score,
          player2_score: m.player1_score,
        };
      }
      return m;
    });
    return computeStandings(modified);
  }, [seasonMatchups, flippedIds, originalStandings]);

  function toggleFlip(matchupId: number) {
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(matchupId)) next.delete(matchupId);
      else next.add(matchupId);
      return next;
    });
  }

  const top20 = closeGames.slice(0, 20);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading text-lg font-semibold text-on-surface mb-1">Flip Closest Games</h3>
        <p className="text-sm text-on-surface-muted mb-4">
          Toggle the closest games of a season to flip the result, then see how the standings would change.
          Click a game to flip it.
        </p>
      </div>

      <SeasonSelector
        value={selectedYear}
        onChange={(y) => { setSelectedYear(y); setFlippedIds(new Set()); }}
        years={years}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Close Games List */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-heading text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
              Closest Games
            </h4>
            {flippedIds.size > 0 && (
              <button
                onClick={() => setFlippedIds(new Set())}
                className="text-xs text-[#a855f7] hover:text-[#c084fc] transition-colors cursor-pointer"
              >
                Reset all ({flippedIds.size} flipped)
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {top20.map((g) => {
              const isFlipped = flippedIds.has(g.matchup.matchup_id);
              return (
                <button
                  key={g.matchup.matchup_id}
                  type="button"
                  onClick={() => toggleFlip(g.matchup.matchup_id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all cursor-pointer border ${
                    isFlipped
                      ? 'border-[#a855f7]/50 bg-[#a855f7]/10'
                      : 'border-border-default/50 bg-surface-card/30 hover:bg-surface-card/60'
                  }`}
                >
                  <span className="text-xs text-on-surface-faint font-heading w-10 shrink-0">
                    Wk {g.week}
                  </span>

                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <PlayerAvatar playerId={isFlipped ? g.loserId : g.winnerId} size="sm" />
                    <span className="text-sm text-[#22c55e] font-medium truncate">
                      {getPlayerName(isFlipped ? g.loserId : g.winnerId)}
                    </span>
                  </div>

                  <div className="font-score text-sm shrink-0">
                    <span className="text-[#22c55e]">{formatScore(isFlipped ? g.loserScore : g.winnerScore)}</span>
                    <span className="text-on-surface-faint mx-1">-</span>
                    <span className="text-[#ef4444]">{formatScore(isFlipped ? g.winnerScore : g.loserScore)}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span className="text-sm text-[#ef4444] truncate text-right">
                      {getPlayerName(isFlipped ? g.winnerId : g.loserId)}
                    </span>
                    <PlayerAvatar playerId={isFlipped ? g.winnerId : g.loserId} size="sm" />
                  </div>

                  <span className={`text-[10px] font-bold shrink-0 rounded-full px-2 py-0.5 ${
                    isFlipped
                      ? 'bg-[#a855f7]/20 text-[#a855f7]'
                      : 'bg-surface-inset text-on-surface-faint'
                  }`}>
                    {g.margin.toFixed(Number.isInteger(g.margin) ? 0 : 2)} pts
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Standings */}
        <div className="lg:col-span-2">
          <h4 className="font-heading text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2">
            {flippedIds.size > 0 ? 'Simulated Standings' : 'Original Standings'}
          </h4>
          <div className="space-y-1 sticky top-20">
            {simulatedStandings.map((s) => {
              const orig = originalStandings.find((o) => o.playerId === s.playerId);
              const rankDiff = orig ? orig.rank - s.rank : 0;
              const winsChanged = orig ? s.wins - orig.wins : 0;

              return (
                <div
                  key={s.playerId}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                    rankDiff !== 0 ? 'bg-surface-inset/80 border border-border-default' : 'bg-surface-card/30'
                  }`}
                >
                  <span className="text-xs text-on-surface-faint font-score w-4">{s.rank}</span>
                  <PlayerAvatar playerId={s.playerId} size="sm" />
                  <span className="text-sm text-on-surface font-medium flex-1 truncate">{s.name}</span>
                  <span className="font-score text-sm text-on-surface-muted">
                    {s.wins}-{s.losses}{s.ties > 0 ? `-${s.ties}` : ''}
                  </span>
                  {rankDiff !== 0 && (
                    <span className={`text-[10px] font-bold ${rankDiff > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {rankDiff > 0 ? `+${rankDiff}` : rankDiff}
                    </span>
                  )}
                  {winsChanged !== 0 && (
                    <span className={`text-[10px] ${winsChanged > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      ({winsChanged > 0 ? '+' : ''}{winsChanged}W)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================= MAIN PAGE =========================

export default function SimulatorPage() {
  usePageTitle('What If?');
  const [activeTab, setActiveTab] = useState<TabId>('swap');

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="font-heading text-4xl font-bold text-on-surface flex items-center gap-3">
          <Shuffle className="h-8 w-8 text-[#f97316]" />
          What If? Simulator
        </h1>
        <p className="text-on-surface-muted mt-2">
          Explore alternate realities. Swap schedules and flip close games to see how the standings would change.
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
                ? 'bg-[#f97316] text-white shadow-[0_0_12px_rgba(249,115,22,0.3)]'
                : 'bg-surface-inset text-on-surface-muted hover:bg-surface-inset/80 hover:text-on-surface'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'swap' && <ScheduleSwapSection />}
        {activeTab === 'flip' && <FlipGamesSection />}
      </motion.div>
    </div>
  );
}
