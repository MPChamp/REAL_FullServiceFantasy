import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ArrowLeft, Medal, TrendingUp, Target, Users, Award, Hash } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import ScrollableTable from '@/components/common/ScrollableTable';
import { formatRecord, formatScore, getPlayerImagePath } from '@/utils/formatting';
import { getPlayerColor, getChartTooltipStyle } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { Player, AllTimeRecord, SeasonResult, Championship, WeeklyMatchup, HeadToHeadRecord, ToiletBowl } from '@/data/types';
import playersData from '@/data/players.json';
import allTimeRecordsData from '@/data/all-time-records.json';
import seasonResultsData from '@/data/season-results.json';
import championshipsData from '@/data/championships.json';
import matchupsData from '@/data/matchups.json';
import headToHeadData from '@/data/head-to-head.json';
import toiletBowlsData from '@/data/toilet-bowls.json';

const players = playersData as Player[];
const allTimeRecords = allTimeRecordsData as AllTimeRecord[];
const seasonResults = seasonResultsData as SeasonResult[];
const championships = championshipsData as Championship[];
const allMatchups = matchupsData as WeeklyMatchup[];
const headToHead = headToHeadData as Record<string, HeadToHeadRecord>;
const toiletBowls = toiletBowlsData as ToiletBowl[];

function getPlayerName(id: number): string {
  return players.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

function getH2HKey(id1: number, id2: number): string {
  return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
}

type SeasonSortKey = 'season_id' | 'rank' | 'wins' | 'points_for' | 'points_per_game' | 'total_moves';

export default function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const playerId = Number(id);
  const { isDark } = useTheme();

  const player = players.find((p) => p.player_id === playerId);
  usePageTitle(player?.name);
  const record = allTimeRecords.find((r) => r.player_id === playerId);
  const playerSeasons = useMemo(
    () => seasonResults.filter((r) => r.player_id === playerId).sort((a, b) => a.season_id - b.season_id),
    [playerId]
  );
  const playerChamps = useMemo(
    () => championships.filter((c) => c.winner_id === playerId),
    [playerId]
  );
  const color = getPlayerColor(playerId);

  const playerToiletBowls = useMemo(() => {
    return toiletBowls
      .filter(tb => tb.winner_id === playerId || tb.loser_id === playerId)
      .sort((a, b) => a.season_id - b.season_id);
  }, [playerId]);

  const tbWins = playerToiletBowls.filter(tb => tb.winner_id === playerId).length;
  const tbLosses = playerToiletBowls.filter(tb => tb.loser_id === playerId).length;

  const [heroImgError, setHeroImgError] = useState(false);
  const [seasonSortKey, setSeasonSortKey] = useState<SeasonSortKey>('season_id');
  const [seasonSortAsc, setSeasonSortAsc] = useState(true);

  const sortedSeasons = useMemo(() => {
    return [...playerSeasons].sort((a, b) => {
      const aVal = a[seasonSortKey];
      const bVal = b[seasonSortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return seasonSortAsc ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [playerSeasons, seasonSortKey, seasonSortAsc]);

  function handleSeasonSort(key: SeasonSortKey) {
    if (seasonSortKey === key) {
      setSeasonSortAsc(!seasonSortAsc);
    } else {
      setSeasonSortKey(key);
      setSeasonSortAsc(key === 'season_id' || key === 'rank');
    }
  }

  // Chart data
  const rankData = useMemo(
    () => playerSeasons.map((s) => ({ year: s.season_id, rank: s.rank })),
    [playerSeasons]
  );

  const ppgData = useMemo(
    () => playerSeasons.map((s) => ({ year: s.season_id.toString(), ppg: s.points_per_game })),
    [playerSeasons]
  );

  // H2H mini-cards
  const opponents = players.filter((p) => p.player_id !== playerId);

  // Title generation
  const titleParts: string[] = [];
  if (record && record.championships > 0) {
    titleParts.push(`${record.championships}x Champion`);
  }
  if (record && record.runner_ups > 0) {
    titleParts.push(`Runner-Up x${record.runner_ups}`);
  }
  if (tbLosses > 0) {
    titleParts.push(`Toilet Bowl Loser x${tbLosses}`);
  }
  if (tbWins > 0) {
    titleParts.push(`TB Champion x${tbWins}`);
  }
  const title = titleParts.length > 0 ? titleParts.join(' | ') : 'League Veteran';

  if (!player || !record) {
    return (
      <div className="text-center py-20">
        <h1 className="font-heading text-2xl text-on-surface">Player Not Found</h1>
        <Link to="/players" className="text-[#f59e0b] hover:underline mt-4 inline-block">
          Back to Players
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <Link to="/players" className="inline-flex items-center gap-2 text-on-surface-muted hover:text-on-surface transition-colors text-sm">
        <ArrowLeft className="h-4 w-4" />
        All Players
      </Link>

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row items-center gap-6"
      >
        <div
          className="relative shrink-0 w-40 h-40 sm:w-48 sm:h-48 rounded-2xl overflow-hidden"
          style={{ boxShadow: `0 0 0 3px ${color}, 0 10px 25px -5px rgba(0,0,0,0.3)` }}
        >
          {heroImgError ? (
            <div
              className="flex h-full w-full items-center justify-center font-heading font-bold text-white text-6xl"
              style={{ backgroundColor: color }}
            >
              {player.name.charAt(0)}
            </div>
          ) : (
            <img
              src={getPlayerImagePath(playerId, 'full')}
              alt={player.name}
              className="h-full w-full object-cover"
              onError={() => setHeroImgError(true)}
            />
          )}
        </div>
        <div className="text-center sm:text-left">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-on-surface">{player.name}</h1>
          <p className="text-on-surface-muted mt-1 font-heading text-lg">{title}</p>
          {record.championships > 0 && (
            <div className="flex items-center gap-1 mt-2 justify-center sm:justify-start">
              {Array.from({ length: record.championships }).map((_, i) => (
                <Trophy key={i} className="h-5 w-5 text-[#f59e0b]" />
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* Career Stats Bar */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="stat-card text-center p-3">
            <TrendingUp className="h-5 w-5 text-[#22c55e] mx-auto mb-1" />
            <div className="font-score text-lg text-on-surface">
              {formatRecord(record.total_wins, record.total_losses, record.total_ties)}
            </div>
            <div className="text-xs text-on-surface-faint">Record</div>
          </div>
          <div className="stat-card text-center p-3">
            <Target className="h-5 w-5 text-[#f59e0b] mx-auto mb-1" />
            <div className="font-score text-lg text-on-surface">{record.career_ppg.toFixed(1)}</div>
            <div className="text-xs text-on-surface-faint">Career PPG</div>
          </div>
          <div className="stat-card text-center p-3">
            <Award className="h-5 w-5 text-[#8b5cf6] mx-auto mb-1" />
            <div className="font-score text-lg text-on-surface">{record.playoff_appearances}</div>
            <div className="text-xs text-on-surface-faint">Playoff Apps</div>
          </div>
          <div className="stat-card text-center p-3">
            <Trophy className="h-5 w-5 text-[#f59e0b] mx-auto mb-1" />
            <div className="font-score text-lg text-on-surface">{record.championships}</div>
            <div className="text-xs text-on-surface-faint">Championships</div>
          </div>
          <div className="stat-card text-center p-3">
            <Medal className="h-5 w-5 text-on-surface-muted mx-auto mb-1" />
            <div className="font-score text-lg text-on-surface">{record.runner_ups}</div>
            <div className="text-xs text-on-surface-faint">Runner-Ups</div>
          </div>
          <div className="stat-card text-center p-3">
            <Hash className="h-5 w-5 text-[#06b6d4] mx-auto mb-1" />
            <div className="font-score text-lg text-on-surface">{record.average_rank.toFixed(1)}</div>
            <div className="text-xs text-on-surface-faint">Avg Rank</div>
          </div>
          {playerToiletBowls.length > 0 && (
            <>
              <div className="stat-card text-center p-3">
                <span className="text-lg block mx-auto mb-1" style={{ filter: 'sepia(1) saturate(3) hue-rotate(10deg) brightness(1.1)' }}>🚽</span>
                <div className="font-score text-lg text-[#d97706]">{tbWins}</div>
                <div className="text-xs text-on-surface-faint">TB Wins</div>
              </div>
              <div className="stat-card text-center p-3">
                <span className="text-lg block mx-auto mb-1">💩</span>
                <div className="font-score text-lg text-[#b45309]">{tbLosses}</div>
                <div className="text-xs text-on-surface-faint">Last Place</div>
              </div>
            </>
          )}
        </div>
      </motion.section>

      {/* Championship Gallery */}
      {playerChamps.length > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="font-heading text-2xl font-semibold text-on-surface mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#f59e0b]" />
            Championship Gallery
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playerChamps.map((champ) => {
              const game = allMatchups.find(
                (m) => m.season_id === champ.season_id && m.game_type === 'championship'
              );
              const opponentId = champ.runner_up_id;
              const opponentName = getPlayerName(opponentId);
              let winnerScore = 0;
              let loserScore = 0;
              if (game) {
                winnerScore = game.player1_id === playerId ? game.player1_score : game.player2_score;
                loserScore = game.player1_id === opponentId ? game.player1_score : game.player2_score;
              }

              return (
                <Link
                  key={champ.season_id}
                  to={`/seasons/${champ.season_id}`}
                  className="glass-card p-4 border border-[#f59e0b]/20 hover:border-[#f59e0b]/40 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-5 w-5 text-[#f59e0b]" />
                    <span className="font-display text-2xl text-[#f59e0b]">{champ.season_id}</span>
                  </div>
                  <p className="text-sm text-on-surface-muted">
                    vs {opponentName}
                  </p>
                  {game && (
                    <p className="font-score text-sm text-on-surface mt-1">
                      {formatScore(winnerScore)} - {formatScore(loserScore)}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Toilet Bowl History */}
      {playerToiletBowls.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h2 className="font-heading text-2xl font-semibold text-on-surface mb-4 flex items-center gap-2">
            <span>🚽</span> Toilet Bowl History
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playerToiletBowls.map(tb => {
              const isWin = tb.winner_id === playerId;
              const opponentId = isWin ? tb.loser_id : tb.winner_id;
              const playerScore = isWin ? tb.winner_score : tb.loser_score;
              const opponentScore = isWin ? tb.loser_score : tb.winner_score;
              return (
                <Link key={tb.season_id} to={`/seasons/${tb.season_id}`}
                  className={`${isWin ? 'glass-card border-[#d97706]/20 hover:border-[#d97706]/40' : 'shame-card'} p-4 transition-colors`}>
                  <div className="flex items-center gap-2 mb-2">
                    {isWin
                      ? <span className="text-lg" style={{ filter: 'sepia(1) saturate(3) hue-rotate(10deg) brightness(1.1)' }}>🚽</span>
                      : <span className="text-lg">💩</span>
                    }
                    <span className={`font-display text-3xl ${isWin ? 'text-[#d97706]' : 'text-[#92400e]'}`}>
                      {tb.year}
                    </span>
                  </div>
                  <p className={`text-xs font-heading font-semibold uppercase ${isWin ? 'text-[#d97706]' : 'text-[#ef4444]'}`}>
                    {isWin ? 'SURVIVED' : 'LAST PLACE'}
                  </p>
                  <p className="text-sm text-on-surface-muted mt-1">vs {getPlayerName(opponentId)}</p>
                  <p className="font-score text-sm text-on-surface mt-1">
                    {formatScore(playerScore)} - {formatScore(opponentScore)}
                  </p>
                </Link>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Season-by-Season Table */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-on-surface mb-4">Season-by-Season</h2>
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-on-surface-muted">
                {([
                  ['Year', 'season_id'],
                  ['Rank', 'rank'],
                  ['Record', 'wins'],
                  ['PF', 'points_for'],
                  ['PA', 'points_for'],
                  ['PPG', 'points_per_game'],
                  ['Moves', 'total_moves'],
                ] as [string, SeasonSortKey][]).map(([label, key]) => (
                  <th
                    key={label}
                    className={`py-3 px-2 font-medium cursor-pointer select-none hover:text-on-surface transition-colors ${
                      label === 'Year' || label === 'Record' ? 'text-left' : 'text-right'
                    } ${seasonSortKey === key ? 'text-[#f59e0b]' : ''}`}
                    onClick={() => handleSeasonSort(key)}
                  >
                    {label}
                    {seasonSortKey === key && (
                      <span className="ml-1">{seasonSortAsc ? '\u2191' : '\u2193'}</span>
                    )}
                  </th>
                ))}
                <th className="py-3 px-2 text-center font-medium text-on-surface-muted">Playoff</th>
                <th className="py-3 px-2 text-center font-medium text-on-surface-muted">TB</th>
              </tr>
            </thead>
            <tbody>
              {sortedSeasons.map((s) => (
                <tr key={s.season_id} className="border-b border-border-default hover:bg-surface-inset/[0.02]">
                  <td className="py-3 px-2">
                    <Link to={`/seasons/${s.season_id}`} className="text-[#f59e0b] hover:underline font-heading font-semibold">
                      {s.season_id}
                    </Link>
                  </td>
                  <td className="py-3 px-2 text-right font-score text-on-surface">{s.rank}</td>
                  <td className="py-3 px-2 font-score text-on-surface">
                    {formatRecord(s.wins, s.losses, s.ties)}
                  </td>
                  <td className="py-3 px-2 text-right font-score text-on-surface">{formatScore(s.points_for)}</td>
                  <td className="py-3 px-2 text-right font-score text-on-surface">{formatScore(s.points_against)}</td>
                  <td className="py-3 px-2 text-right font-score text-on-surface">{s.points_per_game.toFixed(1)}</td>
                  <td className="py-3 px-2 text-right font-score text-on-surface">{s.total_moves}</td>
                  <td className="py-3 px-2 text-center">
                    {s.made_playoffs ? (
                      <span className="text-[#22c55e] text-xs font-semibold">YES</span>
                    ) : (
                      <span className="text-on-surface-faint text-xs">No</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    {(() => {
                      const tb = playerToiletBowls.find(t => t.season_id === s.season_id);
                      if (!tb) return null;
                      return tb.winner_id === playerId
                        ? <span className="text-[#d97706] text-xs font-semibold">W</span>
                        : <span className="text-[#ef4444] text-xs font-semibold">L</span>;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </motion.section>

      {/* Head-to-Head Preview */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <h2 className="font-heading text-2xl font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-[#06b6d4]" />
          Head-to-Head
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-9 gap-3">
          {opponents.map((opp) => {
            const key = getH2HKey(playerId, opp.player_id);
            const h2hRecord = headToHead[key];
            if (!h2hRecord) return null;

            const myWins = h2hRecord.player1_id === playerId
              ? h2hRecord.player1_wins
              : h2hRecord.player2_wins;
            const oppWins = h2hRecord.player1_id === playerId
              ? h2hRecord.player2_wins
              : h2hRecord.player1_wins;

            const winning = myWins > oppWins;
            const losing = oppWins > myWins;

            return (
              <Link
                key={opp.player_id}
                to={`/head-to-head?p1=${playerId}&p2=${opp.player_id}`}
                className={`stat-card flex flex-col items-center p-3 hover:bg-surface-inset/50 transition-colors border ${
                  winning ? 'border-[#22c55e]/20' : losing ? 'border-[#ef4444]/20' : 'border-border-default'
                }`}
              >
                <PlayerAvatar playerId={opp.player_id} size="sm" showRing />
                <span className="text-xs text-on-surface-muted mt-1 font-heading">{opp.name}</span>
                <span className={`font-score text-sm mt-0.5 ${
                  winning ? 'text-[#22c55e]' : losing ? 'text-[#ef4444]' : 'text-on-surface-muted'
                }`}>
                  {myWins}-{oppWins}
                </span>
              </Link>
            );
          })}
        </div>
      </motion.section>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Rank Trajectory */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <h2 className="font-heading text-lg font-semibold text-on-surface mb-4">Rank Trajectory</h2>
          <div className="glass-card p-4">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={rankData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <XAxis
                  dataKey="year"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                />
                <YAxis
                  reversed
                  domain={[1, 10]}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={getChartTooltipStyle(isDark)}
                  formatter={(value: number | undefined) => [`#${value ?? 0}`, 'Rank']}
                />
                <Line
                  type="monotone"
                  dataKey="rank"
                  stroke={color}
                  strokeWidth={2}
                  dot={{ fill: color, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        {/* PPG per Season */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <h2 className="font-heading text-lg font-semibold text-on-surface mb-4">PPG by Season</h2>
          <div className="glass-card p-4">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ppgData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <XAxis
                  dataKey="year"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[80, 'auto']}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={getChartTooltipStyle(isDark)}
                  formatter={(value: number | undefined) => [value != null ? value.toFixed(1) : '0', 'PPG']}
                />
                <Bar dataKey="ppg" fill={color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
