import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, TrendingUp, Flame, Swords, Skull } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import ScrollableTable from '@/components/common/ScrollableTable';
import StatCard from '@/components/common/StatCard';
import { formatScore, formatRecord } from '@/utils/formatting';
import { getSeries, getStakes, describeSeries } from '@/utils/rivalry';
import { usePageTitle } from '@/hooks/usePageTitle';

import type { Player, CurrentSeason, Season, CurrentGame } from '@/data/types';
import playersData from '@/data/players.json';
import seasonsData from '@/data/seasons.json';
import currentSeasonData from '@/data/current-season.json';

const players = playersData as Player[];
const seasons = seasonsData as Season[];
const current = currentSeasonData as CurrentSeason;

const getPlayerName = (id: number) => players.find((p) => p.player_id === id)?.name ?? 'Unknown';
const isPlayed = (g: CurrentGame) => g.winner !== null;

const toneClasses: Record<string, string> = {
  gold: 'bg-[#f59e0b]/10 text-[#f59e0b]',
  red: 'bg-[#ef4444]/10 text-[#ef4444]',
  green: 'bg-[#22c55e]/10 text-[#22c55e]',
  neutral: 'bg-surface-inset text-on-surface-muted',
};

/** Every game a manager has played this season, oldest first. */
function gamesFor(playerId: number) {
  return current.schedule
    .filter((g) => isPlayed(g) && (g.home_player_id === playerId || g.away_player_id === playerId))
    .sort((a, b) => a.week - b.week)
    .map((g) => {
      const isHome = g.home_player_id === playerId;
      const scoreFor = isHome ? g.home_score : g.away_score;
      const scoreAgainst = isHome ? g.away_score : g.home_score;
      return {
        week: g.week,
        opponentId: isHome ? g.away_player_id : g.home_player_id,
        scoreFor,
        scoreAgainst,
        won: scoreFor > scoreAgainst,
      };
    });
}

function GameSide({
  id,
  score,
  won,
  played,
}: {
  id: number;
  score: number;
  won: boolean;
  played: boolean;
}) {
  return (
    <div className="flex flex-1 items-center gap-2">
      <PlayerAvatar playerId={id} size="sm" showRing={played && won} />
      <span
        className={`truncate text-sm ${
          played && won ? 'font-semibold text-on-surface' : 'text-on-surface-muted'
        }`}
      >
        {getPlayerName(id)}
      </span>
      <span
        className={`ml-auto font-score text-sm ${
          !played ? 'text-on-surface-faint' : won ? 'text-[#22c55e]' : 'text-on-surface-muted'
        }`}
      >
        {played ? formatScore(score) : '—'}
      </span>
    </div>
  );
}

function GameCard({ game, showSeries = true }: { game: CurrentGame; showSeries?: boolean }) {
  const played = isPlayed(game);
  const homeName = getPlayerName(game.home_player_id);
  const awayName = getPlayerName(game.away_player_id);
  const series = showSeries ? getSeries(game.home_player_id, game.away_player_id) : null;
  const stakes = getStakes(
    game.home_player_id,
    game.away_player_id,
    current.standings,
    current.playoff_team_count ?? 4
  );

  return (
    <div className="glass-card space-y-2 p-4">
      <div className="flex items-center gap-3">
        <GameSide id={game.away_player_id} score={game.away_score} won={game.winner === 'away'} played={played} />
        <span className="shrink-0 text-xs text-on-surface-faint">@</span>
        <GameSide id={game.home_player_id} score={game.home_score} won={game.winner === 'home'} played={played} />
      </div>

      {(stakes || series) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border-default/60 pt-2">
          {stakes && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClasses[stakes.tone]}`}>
              {stakes.label}
            </span>
          )}
          {series && series.total > 0 && (
            <span className="text-[11px] text-on-surface-faint">
              {describeSeries(series, homeName, awayName)} · {series.total} meetings
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function LiveSeasonPage() {
  const year = current.season_id;
  usePageTitle(`${year} Season`);

  const playedWeeks = useMemo(
    () => [...new Set(current.schedule.filter(isPlayed).map((g) => g.week))].sort((a, b) => a - b),
    []
  );
  const latestPlayed = playedWeeks[playedWeeks.length - 1] ?? 0;
  const upcomingWeek = latestPlayed + 1;
  const [week, setWeek] = useState(latestPlayed || 1);

  const weekGames = useMemo(() => current.schedule.filter((g) => g.week === week), [week]);
  const rivalryGames = useMemo(
    () => current.schedule.filter((g) => g.week === upcomingWeek),
    [upcomingWeek]
  );
  const allWeeks = useMemo(
    () => [...new Set(current.schedule.map((g) => g.week))].sort((a, b) => a - b),
    []
  );

  const inSql = seasons.some((s) => s.year === year);

  // Standings enriched with the things ESPN's table doesn't show you.
  const table = useMemo(() => {
    const leaderWins = current.standings[0]?.wins ?? 0;
    return current.standings.map((team) => {
      const games = gamesFor(team.player_id);
      const played = games.length;

      let streak = 0;
      for (let i = games.length - 1; i >= 0; i--) {
        const won = games[i].won;
        if (streak === 0) streak = won ? 1 : -1;
        else if (won === streak > 0) streak += won ? 1 : -1;
        else break;
      }

      return {
        ...team,
        played,
        ppg: played ? team.points_for / played : 0,
        streak,
        gamesBack: leaderWins - team.wins,
        recent: games.slice(-5),
      };
    });
  }, []);

  const topScorer = useMemo(() => [...table].sort((a, b) => b.ppg - a.ppg)[0], [table]);
  const hottest = useMemo(() => [...table].sort((a, b) => b.streak - a.streak)[0], [table]);
  const coldest = useMemo(() => [...table].sort((a, b) => a.streak - b.streak)[0], [table]);

  const biggestBlowout = useMemo(() => {
    const played = current.schedule.filter(isPlayed);
    if (!played.length) return null;
    return played
      .map((g) => ({ game: g, margin: Math.abs(g.home_score - g.away_score) }))
      .sort((a, b) => b.margin - a.margin)[0];
  }, []);

  const closestGame = useMemo(() => {
    const played = current.schedule.filter(isPlayed);
    if (!played.length) return null;
    return played
      .map((g) => ({ game: g, margin: Math.abs(g.home_score - g.away_score) }))
      .sort((a, b) => a.margin - b.margin)[0];
  }, []);

  const highScore = useMemo(() => {
    const scores = current.schedule.filter(isPlayed).flatMap((g) => [
      { id: g.home_player_id, score: g.home_score, week: g.week },
      { id: g.away_player_id, score: g.away_score, week: g.week },
    ]);
    return scores.sort((a, b) => b.score - a.score)[0] ?? null;
  }, []);

  const streakLabel = (s: number) =>
    s === 0 ? '—' : s > 0 ? `W${s}` : `L${Math.abs(s)}`;

  return (
    <div className="space-y-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-4xl font-bold text-on-surface">{year} Season</h1>
          {current.is_active && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#22c55e]/10 px-3 py-1 text-xs font-semibold text-[#22c55e]">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              Week {current.current_week} · Live
            </span>
          )}
        </div>
        <p className="mt-2 text-on-surface-muted">
          {latestPlayed > 0
            ? `${latestPlayed} of ${current.regular_season_weeks} weeks played · top ${current.playoff_team_count} make the playoffs`
            : 'Season about to kick off'}
        </p>
      </motion.div>

      {/* ── Season pulse ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {topScorer && (
          <StatCard
            label="Best scoring offense"
            value={`${getPlayerName(topScorer.player_id)} · ${topScorer.ppg.toFixed(1)} PPG`}
            icon={<TrendingUp className="h-4 w-4" />}
            accent="green"
          />
        )}
        {highScore && (
          <StatCard
            label={`Highest score — week ${highScore.week}`}
            value={`${getPlayerName(highScore.id)} · ${formatScore(highScore.score)}`}
            icon={<Flame className="h-4 w-4" />}
            accent="gold"
          />
        )}
        {biggestBlowout && (
          <StatCard
            label={`Biggest beatdown — week ${biggestBlowout.game.week}`}
            value={`${getPlayerName(
              biggestBlowout.game.winner === 'home'
                ? biggestBlowout.game.home_player_id
                : biggestBlowout.game.away_player_id
            )} by ${biggestBlowout.margin.toFixed(2)}`}
            icon={<Skull className="h-4 w-4" />}
            accent="red"
          />
        )}
        {closestGame && (
          <StatCard
            label={`Nail-biter — week ${closestGame.game.week}`}
            value={`${getPlayerName(
              closestGame.game.winner === 'home'
                ? closestGame.game.home_player_id
                : closestGame.game.away_player_id
            )} by ${closestGame.margin.toFixed(2)}`}
            accent="purple"
          />
        )}
      </div>

      {/* ── Standings ── */}
      <section className="space-y-3">
        <h2 className="font-heading text-2xl font-bold text-on-surface">Standings</h2>
        <ScrollableTable>
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-on-surface-faint">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">Manager</th>
                <th className="py-2 pr-4 font-medium">Record</th>
                <th className="py-2 pr-4 font-medium">GB</th>
                <th className="py-2 pr-4 font-medium">PF</th>
                <th className="py-2 pr-4 font-medium">PA</th>
                <th className="py-2 pr-4 font-medium">PPG</th>
                <th className="py-2 pr-4 font-medium">Streak</th>
                <th className="py-2 font-medium">Last 5</th>
              </tr>
            </thead>
            <tbody>
              {table.map((team, idx) => {
                const inPlayoffs = idx < (current.playoff_team_count ?? 4);
                return (
                  <tr
                    key={team.player_id}
                    className={`border-b border-border-default/50 ${inPlayoffs ? 'bg-[#f59e0b]/[0.03]' : ''}`}
                  >
                    <td className="py-2.5 pr-3">
                      <span
                        className={`font-score text-xs ${
                          inPlayoffs ? 'text-[#f59e0b]' : 'text-on-surface-faint'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Link to={`/players/${team.player_id}`} className="flex items-center gap-2 group">
                        <PlayerAvatar playerId={team.player_id} size="sm" showRing={inPlayoffs} />
                        <span className="font-medium text-on-surface group-hover:text-[#f59e0b]">
                          {getPlayerName(team.player_id)}
                        </span>
                      </Link>
                      <span className="block max-w-[14rem] truncate pl-10 text-[11px] text-on-surface-faint">
                        {team.team_name}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-score text-on-surface">
                      {formatRecord(team.wins, team.losses, team.ties)}
                    </td>
                    <td className="py-2.5 pr-4 font-score text-xs text-on-surface-faint">
                      {team.gamesBack === 0 ? '—' : team.gamesBack}
                    </td>
                    <td className="py-2.5 pr-4 font-score text-on-surface-muted">
                      {formatScore(team.points_for)}
                    </td>
                    <td className="py-2.5 pr-4 font-score text-on-surface-muted">
                      {formatScore(team.points_against)}
                    </td>
                    <td className="py-2.5 pr-4 font-score text-on-surface">{team.ppg.toFixed(1)}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`font-score text-xs ${
                          team.streak > 0
                            ? 'text-[#22c55e]'
                            : team.streak < 0
                              ? 'text-[#ef4444]'
                              : 'text-on-surface-faint'
                        }`}
                      >
                        {streakLabel(team.streak)}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-1">
                        {team.recent.map((g) => (
                          <span
                            key={g.week}
                            title={`Week ${g.week} vs ${getPlayerName(g.opponentId)}: ${formatScore(
                              g.scoreFor
                            )}–${formatScore(g.scoreAgainst)}`}
                            className={`h-2 w-4 rounded-sm ${g.won ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollableTable>
        <p className="text-xs text-on-surface-faint">
          Shaded rows are in playoff position. Hover a Last 5 bar for that week&rsquo;s score.
        </p>
      </section>

      {/* ── Rivalry week ── */}
      {rivalryGames.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-[#f59e0b]" />
            <h2 className="font-heading text-2xl font-bold text-on-surface">
              Rivalry Week {upcomingWeek}
            </h2>
          </div>
          <p className="text-sm text-on-surface-muted">
            What&rsquo;s at stake, and how these matchups have gone since 2016
          </p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {rivalryGames.map((g, i) => {
              const series = getSeries(g.home_player_id, g.away_player_id);
              const homeName = getPlayerName(g.home_player_id);
              const awayName = getPlayerName(g.away_player_id);
              const stakes = getStakes(
                g.home_player_id,
                g.away_player_id,
                current.standings,
                current.playoff_team_count ?? 4
              );

              return (
                <div key={`${g.week}-${i}`} className="glass-card space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar playerId={g.away_player_id} size="md" />
                      <span className="font-heading text-sm font-semibold text-on-surface">{awayName}</span>
                    </div>
                    <span className="text-xs text-on-surface-faint">at</span>
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-sm font-semibold text-on-surface">{homeName}</span>
                      <PlayerAvatar playerId={g.home_player_id} size="md" />
                    </div>
                  </div>

                  {stakes && (
                    <div className="flex justify-center">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClasses[stakes.tone]}`}
                      >
                        {stakes.label}
                      </span>
                    </div>
                  )}

                  {series && series.total > 0 && (
                    <div className="space-y-1.5 border-t border-border-default/60 pt-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-on-surface-faint">All time</span>
                        <span className="font-medium text-on-surface">
                          {describeSeries(series, homeName, awayName)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-faint">Points</span>
                        <span className="font-score text-on-surface-muted">
                          {formatScore(Number(series.pointsFor.toFixed(2)))} –{' '}
                          {formatScore(Number(series.pointsAgainst.toFixed(2)))}
                        </span>
                      </div>
                      {series.lastMeeting && (
                        <div className="flex justify-between">
                          <span className="text-on-surface-faint">Last meeting</span>
                          <span className="font-score text-on-surface-muted">
                            {series.lastMeeting.season_id} wk{series.lastMeeting.week} ·{' '}
                            {formatScore(series.lastMeeting.scoreFor)}–
                            {formatScore(series.lastMeeting.scoreAgainst)}
                          </span>
                        </div>
                      )}
                      {series.playoffMeetings > 0 && (
                        <div className="flex justify-between">
                          <span className="text-on-surface-faint">Postseason</span>
                          <span className="font-medium text-[#f59e0b]">
                            {series.playoffMeetings} meeting{series.playoffMeetings === 1 ? '' : 's'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Hot and cold ── */}
      {latestPlayed > 1 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {hottest && hottest.streak > 0 && (
            <StatCard
              label="Hottest team"
              value={`${getPlayerName(hottest.player_id)} · ${streakLabel(hottest.streak)}`}
              icon={<Flame className="h-4 w-4" />}
              accent="green"
            />
          )}
          {coldest && coldest.streak < 0 && (
            <StatCard
              label="Coldest team"
              value={`${getPlayerName(coldest.player_id)} · ${streakLabel(coldest.streak)}`}
              accent="red"
            />
          )}
        </div>
      )}

      {/* ── Scoreboard ── */}
      <section className="space-y-3">
        <h2 className="font-heading text-2xl font-bold text-on-surface">Schedule</h2>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {allWeeks.map((w) => {
            const done = current.schedule.some((g) => g.week === w && isPlayed(g));
            return (
              <button
                key={w}
                type="button"
                onClick={() => setWeek(w)}
                className={`shrink-0 cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                  w === week
                    ? 'bg-[#f59e0b] text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                    : done
                      ? 'bg-surface-inset text-on-surface-muted hover:text-on-surface'
                      : 'bg-surface-inset/50 text-on-surface-faint hover:text-on-surface-muted'
                }`}
              >
                {w}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {weekGames.map((g, i) => (
            <GameCard key={`${g.week}-${i}`} game={g} />
          ))}
        </div>
      </section>

      <p className="text-xs text-on-surface-faint">
        {inSql
          ? `${year} is also in the SQL archive — season pages use that as the record of truth.`
          : `Live from ESPN. Refresh with \`node scripts/fetch-espn.mjs\`. Last updated ${new Date(
              current.last_updated
            ).toLocaleString()}.`}
      </p>
    </div>
  );
}
