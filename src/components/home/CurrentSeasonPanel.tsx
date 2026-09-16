import { Link } from 'react-router-dom';
import { Radio, ArrowRight, Flame } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { formatScore, formatRecord } from '@/utils/formatting';
import { getSeries, getStakes, describeSeries } from '@/utils/rivalry';

import type { Player, CurrentSeason, Season, CurrentGame } from '@/data/types';
import playersData from '@/data/players.json';
import seasonsData from '@/data/seasons.json';
import currentSeasonData from '@/data/current-season.json';

const players = playersData as Player[];
const seasons = seasonsData as Season[];
const current = currentSeasonData as CurrentSeason;

const getPlayerName = (id: number) =>
  players.find((p) => p.player_id === id)?.name ?? 'Unknown';

const toneClasses: Record<string, string> = {
  gold: 'bg-[#f59e0b]/10 text-[#f59e0b]',
  red: 'bg-[#ef4444]/10 text-[#ef4444]',
  green: 'bg-[#22c55e]/10 text-[#22c55e]',
  neutral: 'bg-surface-inset text-on-surface-muted',
};

function UpcomingMatchup({ game }: { game: CurrentGame }) {
  const homeName = getPlayerName(game.home_player_id);
  const awayName = getPlayerName(game.away_player_id);
  const series = getSeries(game.home_player_id, game.away_player_id);
  const stakes = getStakes(
    game.home_player_id,
    game.away_player_id,
    current.standings,
    current.playoff_team_count ?? 4
  );

  return (
    <div className="rounded-lg border border-border-default bg-surface-card/50 p-3">
      <div className="flex items-center gap-2">
        <PlayerAvatar playerId={game.away_player_id} size="sm" />
        <span className="text-sm font-medium text-on-surface">{awayName}</span>
        <span className="text-xs text-on-surface-faint">at</span>
        <span className="text-sm font-medium text-on-surface">{homeName}</span>
        <PlayerAvatar playerId={game.home_player_id} size="sm" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {stakes && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClasses[stakes.tone]}`}
          >
            {stakes.label}
          </span>
        )}
        {series && series.total > 0 && (
          <span className="text-[11px] text-on-surface-faint">
            {describeSeries(series, homeName, awayName)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function CurrentSeasonPanel() {
  // Hand off to the SQL archive once it covers this season.
  const supersededBySql = seasons.some((s) => s.year === current.season_id);
  if (!current.is_active || supersededBySql || !current.standings.length) return null;

  const playedWeeks = [...new Set(current.schedule.filter((g) => g.winner !== null).map((g) => g.week))];
  const latestPlayed = playedWeeks.length ? Math.max(...playedWeeks) : 0;
  const upcomingWeek = latestPlayed + 1;
  const upcoming = current.schedule.filter((g) => g.week === upcomingWeek);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-2xl font-bold text-on-surface md:text-3xl">
            {current.season_id} Season
          </h2>
          <span className="flex items-center gap-1.5 rounded-full bg-[#22c55e]/10 px-2.5 py-1 text-[11px] font-semibold text-[#22c55e]">
            <Radio className="h-3 w-3 animate-pulse" />
            Week {current.current_week}
          </span>
        </div>
        <Link
          to="/live"
          className="flex items-center gap-1 text-sm font-medium text-[#f59e0b] hover:underline"
        >
          Full standings
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Standings */}
        <div className="glass-card overflow-hidden p-4 lg:col-span-3">
          <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-on-surface-faint">
            Standings
          </h3>
          <div className="space-y-1">
            {current.standings.map((team, idx) => {
              const inPlayoffs = idx < (current.playoff_team_count ?? 4);
              return (
                <Link
                  key={team.player_id}
                  to={`/players/${team.player_id}`}
                  className={`flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-inset/60 ${
                    inPlayoffs ? 'bg-[#f59e0b]/[0.04]' : ''
                  }`}
                >
                  <span
                    className={`w-4 shrink-0 font-score text-xs ${
                      inPlayoffs ? 'text-[#f59e0b]' : 'text-on-surface-faint'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <PlayerAvatar playerId={team.player_id} size="sm" showRing={inPlayoffs} />
                  <span className="flex-1 truncate text-sm font-medium text-on-surface">
                    {getPlayerName(team.player_id)}
                  </span>
                  <span className="shrink-0 font-score text-xs text-on-surface-muted">
                    {formatRecord(team.wins, team.losses, team.ties)}
                  </span>
                  <span className="hidden w-16 shrink-0 text-right font-score text-xs text-on-surface-faint sm:block">
                    {formatScore(team.points_for)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Rivalry week */}
        <div className="glass-card p-4 lg:col-span-2">
          <h3 className="mb-3 flex items-center gap-1.5 font-heading text-sm font-semibold uppercase tracking-wider text-on-surface-faint">
            <Flame className="h-3.5 w-3.5 text-[#f59e0b]" />
            Week {upcomingWeek}
          </h3>
          {upcoming.length ? (
            <div className="space-y-2">
              {upcoming.map((g, i) => (
                <UpcomingMatchup key={`${g.week}-${i}`} game={g} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-muted">Regular season complete.</p>
          )}
        </div>
      </div>
    </section>
  );
}
