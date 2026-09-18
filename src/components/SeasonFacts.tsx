import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Skull, Target, Armchair, Crosshair, TrendingDown } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { formatScore } from '@/utils/formatting';

import type { Player, SeasonFact } from '@/data/types';
import playersData from '@/data/players.json';
import seasonFactsData from '@/data/season-facts.json';

const players = playersData as Player[];
const seasonFacts = seasonFactsData as SeasonFact[];

const getPlayerName = (id: number) => players.find((p) => p.player_id === id)?.name ?? 'Unknown';

function Fact({
  icon: Icon,
  tone,
  headline,
  detail,
  managerId,
}: {
  icon: typeof Flame;
  tone: string;
  headline: React.ReactNode;
  detail: React.ReactNode;
  managerId?: number;
}) {
  return (
    <div className="glass-card flex items-start gap-3 p-4">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: tone }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-on-surface">{headline}</p>
        <p className="mt-0.5 text-xs text-on-surface-muted">{detail}</p>
      </div>
      {managerId !== undefined && (
        <Link to={`/players/${managerId}`} className="shrink-0">
          <PlayerAvatar playerId={managerId} size="sm" />
        </Link>
      )}
    </div>
  );
}

export default function SeasonFacts({ year }: { year: number }) {
  const facts = useMemo(() => seasonFacts.find((f) => f.season_id === year), [year]);
  if (!facts) return null;

  const { costliest_benching: costly, biggest_boom: boom, biggest_bust: bust } = facts;
  const bestStart = facts.best_single_start;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading text-2xl font-bold text-on-surface">Fun Facts</h2>
        <p className="mt-1 text-sm text-on-surface-muted">
          What the lineups say about {year} &mdash; every start, bench and projection
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {costly?.missed_swap && (
          <Fact
            icon={Armchair}
            tone="#ef4444"
            managerId={costly.player_id}
            headline={
              <>
                <strong>{getPlayerName(costly.player_id)}</strong> benched{' '}
                <strong>{costly.missed_swap.benched.name}</strong> for{' '}
                {formatScore(costly.missed_swap.benched.points)} and started{' '}
                {costly.missed_swap.started.name} for{' '}
                {formatScore(costly.missed_swap.started.points)}
              </>
            }
            detail={
              <>
                Week {costly.week} &middot; the season&rsquo;s costliest call at{' '}
                {formatScore(costly.missed_swap.gain)} points
                {costly.swap_would_have_won && ' — and it lost him the game'}
              </>
            }
          />
        )}

        {bestStart && (
          <Fact
            icon={Flame}
            tone="#f59e0b"
            managerId={bestStart.player_id}
            headline={
              <>
                <strong>{bestStart.top_starter.name}</strong> put up{' '}
                <strong>{formatScore(bestStart.top_starter.points)}</strong> for{' '}
                {getPlayerName(bestStart.player_id)}
              </>
            }
            detail={`Week ${bestStart.week} · the best single start of ${year}`}
          />
        )}

        {boom?.boom && (
          <Fact
            icon={Crosshair}
            tone="#22c55e"
            managerId={boom.player_id}
            headline={
              <>
                <strong>{boom.boom.name}</strong> was projected for{' '}
                {formatScore(boom.boom.projected ?? 0)} and scored{' '}
                <strong>{formatScore(boom.boom.points)}</strong>
              </>
            }
            detail={`Week ${boom.week} · beat the projection by ${formatScore(boom.boom.over)} for ${getPlayerName(boom.player_id)}`}
          />
        )}

        {bust?.bust && (
          <Fact
            icon={TrendingDown}
            tone="#ef4444"
            managerId={bust.player_id}
            headline={
              <>
                <strong>{bust.bust.name}</strong> was projected for{' '}
                {formatScore(bust.bust.projected ?? 0)} and managed{' '}
                <strong>{formatScore(bust.bust.points)}</strong>
              </>
            }
            detail={`Week ${bust.week} · ${formatScore(bust.bust.under)} below projection for ${getPlayerName(bust.player_id)}`}
          />
        )}

        {facts.games_lost_by_one_swap > 0 && (
          <Fact
            icon={Target}
            tone="#a855f7"
            headline={
              <>
                <strong>{facts.games_lost_by_one_swap} games</strong> were lost by a single lineup
                decision
              </>
            }
            detail={`One different start would have flipped each of them${
              facts.perfect_lineups > 0
                ? ` · ${facts.perfect_lineups} perfect lineup${facts.perfect_lineups === 1 ? ' was' : 's were'} set all season`
                : ''
            }`}
          />
        )}

        {facts.best_manager && facts.worst_manager && facts.best_manager.efficiency != null && (
          <Fact
            icon={Skull}
            tone="#64748b"
            headline={
              <>
                <strong>{getPlayerName(facts.best_manager.player_id)}</strong> set the best lineups
                at {Math.round((facts.best_manager.efficiency ?? 0) * 100)}% of possible
              </>
            }
            detail={
              <>
                {getPlayerName(facts.worst_manager.player_id)} managed{' '}
                {Math.round((facts.worst_manager.efficiency ?? 0) * 100)}%
                {facts.most_bench_points &&
                  ` · ${getPlayerName(facts.most_bench_points.player_id)} left ${formatScore(
                    facts.most_bench_points.bench_points
                  )} points on the bench`}
              </>
            }
          />
        )}
      </div>
    </section>
  );
}
