import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { formatScore } from '@/utils/formatting';
import { getPlayerColor, getChartTooltipStyle } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { Player, HeadToHeadRecord, Season } from '@/data/types';
import playersData from '@/data/players.json';
import headToHeadData from '@/data/head-to-head.json';
import seasonsData from '@/data/seasons.json';

const players = playersData as Player[];
const headToHead = headToHeadData as Record<string, HeadToHeadRecord>;
const seasons = seasonsData as Season[];

function getPlayerName(id: number): string {
  return players.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

function getH2HKey(id1: number, id2: number): string {
  return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
}

type GameTypeFilter = 'all' | 'regular' | 'playoffs';

const gameTypeFilterOptions: { value: GameTypeFilter; label: string }[] = [
  { value: 'all', label: 'All Games' },
  { value: 'regular', label: 'Regular Season' },
  { value: 'playoffs', label: 'Playoffs' },
];

const playoffTypes = new Set(['semifinal', 'championship', '3rd_place', 'toilet_bowl']);

export default function HeadToHeadPage() {
  usePageTitle('Head-to-Head');
  const { isDark } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramP1 = searchParams.get('p1');
  const paramP2 = searchParams.get('p2');

  const [player1Id, setPlayer1Id] = useState<number | null>(paramP1 ? Number(paramP1) : null);
  const [player2Id, setPlayer2Id] = useState<number | null>(paramP2 ? Number(paramP2) : null);

  // Filters
  const [seasonFilter, setSeasonFilter] = useState<number | 'all'>('all');
  const [gameTypeFilter, setGameTypeFilter] = useState<GameTypeFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  function selectPair(p1: number, p2: number) {
    setPlayer1Id(p1);
    setPlayer2Id(p2);
    setSearchParams({ p1: String(p1), p2: String(p2) });
  }

  function clearSelection() {
    setPlayer1Id(null);
    setPlayer2Id(null);
    setSearchParams({});
  }

  function resetFilters() {
    setSeasonFilter('all');
    setGameTypeFilter('all');
  }

  const hasFilters = seasonFilter !== 'all' || gameTypeFilter !== 'all';

  // Get the H2H record for selected pair
  const selectedH2H = useMemo(() => {
    if (player1Id === null || player2Id === null) return null;
    const key = getH2HKey(player1Id, player2Id);
    return headToHead[key] ?? null;
  }, [player1Id, player2Id]);

  // Apply filters to matchups
  const filteredMatchups = useMemo(() => {
    if (!selectedH2H) return [];
    return selectedH2H.matchups.filter((m) => {
      // Season filter
      if (seasonFilter !== 'all' && m.season_id !== seasonFilter) return false;
      // Game type filter
      if (gameTypeFilter !== 'all') {
        if (gameTypeFilter === 'regular' && m.game_type !== 'regular') return false;
        if (gameTypeFilter === 'playoffs' && !playoffTypes.has(m.game_type)) return false;
      }
      return true;
    });
  }, [selectedH2H, seasonFilter, gameTypeFilter]);

  // Filtered W-L record
  const filteredRecord = useMemo(() => {
    if (!selectedH2H || player1Id === null || player2Id === null) return { p1Wins: 0, p2Wins: 0, ties: 0 };
    let p1Wins = 0;
    let p2Wins = 0;
    let ties = 0;
    for (const m of filteredMatchups) {
      const p1Score = selectedH2H.player1_id === player1Id ? m.player1_score : m.player2_score;
      const p2Score = selectedH2H.player1_id === player1Id ? m.player2_score : m.player1_score;
      if (p1Score > p2Score) p1Wins++;
      else if (p2Score > p1Score) p2Wins++;
      else ties++;
    }
    return { p1Wins, p2Wins, ties };
  }, [filteredMatchups, selectedH2H, player1Id, player2Id]);

  // Comparison data for bar chart (filtered)
  const chartData = useMemo(() => {
    if (!selectedH2H || player1Id === null || player2Id === null) return [];
    return filteredMatchups.map((m, idx) => {
      const p1Score = selectedH2H.player1_id === player1Id ? m.player1_score : m.player2_score;
      const p2Score = selectedH2H.player1_id === player1Id ? m.player2_score : m.player1_score;
      const diff = p1Score - p2Score;
      return {
        label: `${m.season_id} W${m.week_start}`,
        diff,
        p1Score,
        p2Score,
        idx,
      };
    });
  }, [filteredMatchups, selectedH2H, player1Id, player2Id]);

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="font-heading text-4xl font-bold text-on-surface flex items-center gap-3">
          <Users className="h-8 w-8 text-[#06b6d4]" />
          Head-to-Head
        </h1>
        <p className="text-on-surface-muted mt-2">
          {player1Id && player2Id
            ? `${getPlayerName(player1Id)} vs ${getPlayerName(player2Id)}`
            : 'Click a cell in the matrix to compare two players'}
        </p>
      </motion.div>

      {/* H2H Matrix */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className="font-heading text-xl font-semibold text-on-surface mb-4">H2H Matrix</h2>
        <div className="overflow-x-auto">
          <table className="text-xs min-w-full">
            <thead>
              <tr>
                <th className="p-2" />
                {players.map((p) => (
                  <th key={p.player_id} className="p-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <PlayerAvatar playerId={p.player_id} size="sm" />
                      <span className="text-on-surface-muted font-heading text-[10px]">{p.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((rowPlayer) => (
                <tr key={rowPlayer.player_id}>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar playerId={rowPlayer.player_id} size="sm" />
                      <span className="text-on-surface-muted font-heading text-[10px] hidden sm:inline">{rowPlayer.name}</span>
                    </div>
                  </td>
                  {players.map((colPlayer) => {
                    if (rowPlayer.player_id === colPlayer.player_id) {
                      return (
                        <td key={colPlayer.player_id} className="p-1">
                          <div className="w-full h-10 rounded bg-surface-inset/50 flex items-center justify-center text-on-surface-faint">
                            -
                          </div>
                        </td>
                      );
                    }

                    const key = getH2HKey(rowPlayer.player_id, colPlayer.player_id);
                    const record = headToHead[key];
                    if (!record) {
                      return (
                        <td key={colPlayer.player_id} className="p-1">
                          <div className="w-full h-10 rounded bg-surface-inset/50" />
                        </td>
                      );
                    }

                    const rowWins = record.player1_id === rowPlayer.player_id
                      ? record.player1_wins
                      : record.player2_wins;
                    const colWins = record.player1_id === colPlayer.player_id
                      ? record.player1_wins
                      : record.player2_wins;

                    const isWinning = rowWins > colWins;
                    const isLosing = colWins > rowWins;
                    const isSelected =
                      (player1Id === rowPlayer.player_id && player2Id === colPlayer.player_id) ||
                      (player2Id === rowPlayer.player_id && player1Id === colPlayer.player_id);

                    const bgClass = isWinning
                      ? 'bg-[#22c55e]/15 hover:bg-[#22c55e]/25'
                      : isLosing
                      ? 'bg-[#ef4444]/15 hover:bg-[#ef4444]/25'
                      : 'bg-surface-inset/50 hover:bg-surface-inset';

                    return (
                      <td key={colPlayer.player_id} className="p-1">
                        <button
                          onClick={() => selectPair(rowPlayer.player_id, colPlayer.player_id)}
                          className={`w-full h-10 rounded font-score text-[11px] transition-colors cursor-pointer ${bgClass} ${
                            isSelected ? 'ring-2 ring-[#f59e0b]' : ''
                          }`}
                        >
                          <span className={isWinning ? 'text-[#22c55e]' : isLosing ? 'text-[#ef4444]' : 'text-on-surface-muted'}>
                            {rowWins}-{colWins}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* Selected Comparison */}
      {player1Id !== null && player2Id !== null && selectedH2H && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-heading text-xl font-semibold text-on-surface">Matchup Detail</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  showFilters || hasFilters
                    ? 'bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/30'
                    : 'bg-surface-inset/50 text-on-surface-muted hover:text-on-surface'
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {hasFilters && (
                  <span className="ml-1 rounded-full bg-[#a855f7] text-white text-[10px] w-4 h-4 flex items-center justify-center">
                    {(seasonFilter !== 'all' ? 1 : 0) + (gameTypeFilter !== 'all' ? 1 : 0)}
                  </span>
                )}
              </button>
              <button
                onClick={clearSelection}
                className="text-xs text-on-surface-muted hover:text-on-surface transition-colors px-3 py-1.5 rounded-lg bg-surface-inset/50 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-card p-4"
            >
              <div className="flex flex-wrap items-end gap-4">
                {/* Season Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-on-surface-faint font-heading">
                    Season
                  </label>
                  <select
                    value={seasonFilter === 'all' ? 'all' : String(seasonFilter)}
                    onChange={(e) => setSeasonFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="rounded-lg border border-border-default bg-surface-card px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-[#a855f7]"
                  >
                    <option value="all">All Seasons</option>
                    {seasons.map((s) => (
                      <option key={s.season_id} value={s.season_id}>{s.year}</option>
                    ))}
                  </select>
                </div>

                {/* Game Type Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-on-surface-faint font-heading">
                    Game Type
                  </label>
                  <div className="flex gap-1.5">
                    {gameTypeFilterOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGameTypeFilter(opt.value)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                          gameTypeFilter === opt.value
                            ? 'bg-[#a855f7] text-white shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                            : 'bg-surface-inset text-on-surface-muted hover:text-on-surface'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset */}
                {hasFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-xs text-[#a855f7] hover:text-[#c084fc] transition-colors cursor-pointer"
                  >
                    Reset filters
                  </button>
                )}
              </div>

              {hasFilters && (
                <p className="mt-3 text-xs text-on-surface-faint">
                  Showing {filteredMatchups.length} of {selectedH2H.matchups.length} matchups
                </p>
              )}
            </motion.div>
          )}

          {/* Large comparison */}
          <div className="glass-card p-6 md:p-8">
            <div className="flex items-center justify-center gap-6 md:gap-12">
              <div className="flex flex-col items-center gap-2">
                <PlayerAvatar playerId={player1Id} size="xl" showRing />
                <span className="font-heading text-lg font-bold text-on-surface">{getPlayerName(player1Id)}</span>
              </div>
              <div className="text-center">
                <div className="font-display text-4xl md:text-5xl text-on-surface">
                  <span className="text-[#22c55e]">{filteredRecord.p1Wins}</span>
                  <span className="text-on-surface-faint mx-2">-</span>
                  <span className="text-[#ef4444]">{filteredRecord.p2Wins}</span>
                </div>
                {filteredRecord.ties > 0 && (
                  <span className="text-on-surface-faint text-sm">({filteredRecord.ties} tie{filteredRecord.ties !== 1 ? 's' : ''})</span>
                )}
                {hasFilters && (
                  <p className="text-[10px] text-on-surface-faint mt-1 uppercase tracking-wider">
                    {gameTypeFilter !== 'all' ? gameTypeFilterOptions.find((o) => o.value === gameTypeFilter)?.label : ''}
                    {seasonFilter !== 'all' && gameTypeFilter !== 'all' ? ' · ' : ''}
                    {seasonFilter !== 'all' ? seasons.find((s) => s.season_id === seasonFilter)?.year : ''}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-center gap-2">
                <PlayerAvatar playerId={player2Id} size="xl" showRing />
                <span className="font-heading text-lg font-bold text-on-surface">{getPlayerName(player2Id)}</span>
              </div>
            </div>
          </div>

          {/* All matchups list (filtered) */}
          <div>
            <h3 className="font-heading text-lg font-semibold text-on-surface mb-3">
              {hasFilters ? 'Filtered Matchups' : 'All Matchups'}
              <span className="ml-2 text-sm font-normal text-on-surface-faint">({filteredMatchups.length})</span>
            </h3>
            {filteredMatchups.length === 0 ? (
              <div className="glass-card p-8 text-center text-on-surface-muted">
                No matchups found for the selected filters.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMatchups.map((m, idx) => {
                  const p1Score = selectedH2H.player1_id === player1Id ? m.player1_score : m.player2_score;
                  const p2Score = selectedH2H.player1_id === player1Id ? m.player2_score : m.player1_score;
                  const p1Won = p1Score > p2Score;
                  const p2Won = p2Score > p1Score;
                  const seasonObj = seasons.find((s) => s.season_id === m.season_id);
                  const yearStr = seasonObj ? String(seasonObj.year) : String(m.season_id);
                  const isPlayoffGame = playoffTypes.has(m.game_type);

                  return (
                    <div key={idx} className="glass-card p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 w-28 shrink-0">
                        <span className="text-xs text-on-surface-faint font-heading">
                          {yearStr} Wk {m.week_start}
                        </span>
                        {isPlayoffGame && (
                          <span className="rounded-full bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 px-1.5 py-0.5 text-[9px] font-medium uppercase">
                            {m.game_type === 'championship' ? 'Champ' : m.game_type === 'semifinal' ? 'Semi' : m.game_type === '3rd_place' ? '3rd' : 'TB'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 flex-1 justify-center">
                        <span className={`font-score text-sm ${p1Won ? 'text-[#22c55e]' : 'text-on-surface-muted'}`}>
                          {formatScore(p1Score)}
                        </span>
                        <span className="text-on-surface-faint text-xs">vs</span>
                        <span className={`font-score text-sm ${p2Won ? 'text-[#22c55e]' : 'text-on-surface-muted'}`}>
                          {formatScore(p2Score)}
                        </span>
                      </div>
                      <span className={`text-xs font-heading font-semibold w-16 text-right ${
                        p1Won ? 'text-[#22c55e]' : p2Won ? 'text-[#ef4444]' : 'text-on-surface-faint'
                      }`}>
                        {p1Won ? getPlayerName(player1Id) : p2Won ? getPlayerName(player2Id) : 'Tie'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Score Differential Chart (filtered) */}
          {chartData.length > 0 && (
            <div>
              <h3 className="font-heading text-lg font-semibold text-on-surface mb-3">Score Differential</h3>
              <div className="glass-card p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      axisLine={{ stroke: '#374151' }}
                      tickLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                      axisLine={{ stroke: '#374151' }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={getChartTooltipStyle(isDark)}
                      formatter={(value: number | undefined) => [value != null ? value.toFixed(2) : '0', 'Differential']}
                    />
                    <Bar dataKey="diff" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.idx}
                          fill={entry.diff >= 0 ? getPlayerColor(player1Id) : getPlayerColor(player2Id)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: getPlayerColor(player1Id) }} />
                    <span className="text-on-surface-muted">{getPlayerName(player1Id)} wins</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: getPlayerColor(player2Id) }} />
                    <span className="text-on-surface-muted">{getPlayerName(player2Id)} wins</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.section>
      )}
    </div>
  );
}
