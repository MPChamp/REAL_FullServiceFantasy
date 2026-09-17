import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Anchor, Info, CircleCheck } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import StatCard from '@/components/common/StatCard';
import { getPositionColor } from '@/styles/theme';
import { formatRank } from '@/utils/formatting';

import type {
  Player,
  RosterSpot,
  TeamName,
  SeasonResult,
  Championship,
  WeeklyLineupSpot,
} from '@/data/types';
import playersData from '@/data/players.json';
import rostersData from '@/data/rosters.json';
import teamNamesData from '@/data/team-names.json';
import seasonResultsData from '@/data/season-results.json';
import championshipsData from '@/data/championships.json';
import weeklyLineupsData from '@/data/weekly-lineups.json';

const players = playersData as Player[];
const rosters = rostersData as RosterSpot[];
const teamNames = teamNamesData as TeamName[];
const seasonResults = seasonResultsData as SeasonResult[];
const championships = championshipsData as Championship[];
const weeklyLineups = weeklyLineupsData as WeeklyLineupSpot[];

/** First season the site captured live lineups — nothing earlier can be backfilled. */
const LINEUP_TRACKING_FROM = weeklyLineups.length
  ? Math.min(...weeklyLineups.map((r) => r.season_id))
  : null;

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'];

const getPlayerName = (id: number) => players.find((p) => p.player_id === id)?.name ?? 'Unknown';

function positionRank(position: string) {
  const i = POSITION_ORDER.indexOf(position);
  return i === -1 ? POSITION_ORDER.length : i;
}

export default function RosterBoard({ year, query }: { year: number; query: string }) {
  const seasonRosters = useMemo(() => rosters.filter((r) => r.season_id === year), [year]);

  const teams = useMemo(() => {
    const byManager = new Map<number, RosterSpot[]>();
    for (const spot of seasonRosters) {
      if (!byManager.has(spot.player_id)) byManager.set(spot.player_id, []);
      byManager.get(spot.player_id)!.push(spot);
    }

    return [...byManager.entries()]
      .map(([playerId, spots]) => {
        const result = seasonResults.find((r) => r.season_id === year && r.player_id === playerId);
        return {
          playerId,
          finish: result?.rank ?? null,
          isChamp: championships.some((c) => c.season_id === year && c.winner_id === playerId),
          teamName: teamNames.find((t) => t.season_id === year && t.player_id === playerId)?.team_name,
          kept: spots.filter((s) => s.drafted).length,
          spots: [...spots].sort(
            (a, b) =>
              positionRank(a.position) - positionRank(b.position) ||
              a.nfl_player_name.localeCompare(b.nfl_player_name)
          ),
        };
      })
      .sort((a, b) => (a.finish ?? 99) - (b.finish ?? 99));
  }, [seasonRosters, year]);

  const leagueWide = useMemo(() => {
    const kept = seasonRosters.filter((s) => s.drafted).length;
    const mostLoyal = [...teams].sort((a, b) => b.kept - a.kept)[0];
    const mostChurn = [...teams].sort((a, b) => a.kept - b.kept)[0];
    return {
      retention: seasonRosters.length ? kept / seasonRosters.length : 0,
      mostLoyal,
      mostChurn,
    };
  }, [seasonRosters, teams]);

  const matches = (spot: RosterSpot) =>
    !query || spot.nfl_player_name.toLowerCase().includes(query.toLowerCase());

  if (!seasonRosters.length) {
    return <p className="text-on-surface-muted">No roster data for {year}.</p>;
  }

  const tracksLineups = LINEUP_TRACKING_FROM !== null && year >= LINEUP_TRACKING_FROM;
  const weeksRecorded = tracksLineups
    ? new Set(weeklyLineups.filter((r) => r.season_id === year).map((r) => r.week)).size
    : 0;

  return (
    <div className="space-y-6">
      {/* What this data is — and isn't. */}
      {tracksLineups ? (
        <div className="flex items-start gap-3 rounded-lg border border-[#22c55e]/20 bg-[#22c55e]/5 p-4">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#22c55e]" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-on-surface">Live roster, with weekly lineups being recorded</p>
            <p className="text-on-surface-muted">
              This is the roster as it stands right now. Starting with {LINEUP_TRACKING_FROM}, the site also
              archives who was <em>started</em> each week and what they scored &mdash;{' '}
              {weeksRecorded > 0
                ? `${weeksRecorded} week${weeksRecorded === 1 ? '' : 's'} saved so far.`
                : 'capture begins once week 1 finishes.'}{' '}
              ESPN deletes that detail when the season rolls over, so it survives only because it&rsquo;s
              saved here each week.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-border-default bg-surface-inset/50 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-faint" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-on-surface">End-of-season rosters only</p>
            <p className="text-on-surface-muted">
              These are the squads as they stood when {year} ended &mdash; not week-by-week. There is no
              record of who was <em>started</em> or benched in any given week, what they scored, or when
              players were picked up, because ESPN keeps only a single final roster for a finished season
              and discards the weekly detail.
              {LINEUP_TRACKING_FROM !== null && (
                <>
                  {' '}
                  That history begins with <strong className="text-on-surface">{LINEUP_TRACKING_FROM}</strong>,
                  which the site now records every week.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Drafted players still rostered"
          value={`${Math.round(leagueWide.retention * 100)}%`}
          accent="gold"
        />
        {leagueWide.mostLoyal && (
          <StatCard
            label="Stuck with the draft"
            value={`${getPlayerName(leagueWide.mostLoyal.playerId)} · ${leagueWide.mostLoyal.kept} kept`}
            icon={<Anchor className="h-4 w-4" />}
            accent="green"
          />
        )}
        {leagueWide.mostChurn && (
          <StatCard
            label="Rebuilt on the fly"
            value={`${getPlayerName(leagueWide.mostChurn.playerId)} · ${leagueWide.mostChurn.kept} kept`}
            accent="red"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => (
          <div key={team.playerId} className="glass-card p-4">
            <div className="mb-3 flex items-center gap-3 border-b border-border-default pb-3">
              <PlayerAvatar playerId={team.playerId} size="md" showRing={team.isChamp} />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/players/${team.playerId}`}
                  className="font-heading text-sm font-semibold text-on-surface hover:text-[#f59e0b]"
                >
                  {getPlayerName(team.playerId)}
                </Link>
                {team.teamName && (
                  <span className="block truncate text-[11px] text-on-surface-faint">
                    {team.teamName}
                  </span>
                )}
              </div>
              {team.finish !== null && (
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    team.isChamp
                      ? 'bg-[#f59e0b]/15 text-[#f59e0b]'
                      : team.finish === 10
                        ? 'bg-[#ef4444]/10 text-[#ef4444]'
                        : 'bg-surface-inset text-on-surface-muted'
                  }`}
                >
                  {team.isChamp && <Trophy className="h-3 w-3" />}
                  {formatRank(team.finish)}
                </span>
              )}
            </div>

            <ul className="space-y-1">
              {team.spots.map((spot) => {
                const color = getPositionColor(spot.position);
                const dimmed = query && !matches(spot);
                return (
                  <li
                    key={spot.nfl_player_id}
                    className={`flex items-center gap-2 text-xs transition-opacity ${
                      dimmed ? 'opacity-20' : 'opacity-100'
                    }`}
                  >
                    <span
                      className="w-10 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-semibold"
                      style={{ color, backgroundColor: `${color}1a` }}
                    >
                      {spot.position}
                    </span>
                    <span
                      className={`flex-1 truncate ${
                        spot.slot === 'starter' ? 'text-on-surface' : 'text-on-surface-muted'
                      }`}
                    >
                      {spot.nfl_player_name}
                    </span>
                    <span className="shrink-0 text-[10px] text-on-surface-faint">{spot.pro_team}</span>
                    {spot.drafted && (
                      <span
                        title="Drafted by this manager"
                        className="shrink-0 font-score text-[10px] text-[#f59e0b]"
                      >
                        D
                      </span>
                    )}
                    {spot.slot === 'ir' && (
                      <span className="shrink-0 text-[10px] text-[#ef4444]">IR</span>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="mt-3 border-t border-border-default pt-2 text-[11px] text-on-surface-faint">
              {team.kept} of {team.spots.length} drafted by {getPlayerName(team.playerId)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
