import type { HeadToHeadRecord, CurrentStanding, Player } from '@/data/types';
import headToHeadData from '@/data/head-to-head.json';
import playersData from '@/data/players.json';

const headToHead = headToHeadData as Record<string, HeadToHeadRecord>;
const players = playersData as Player[];

const nameOf = (id: number) => players.find((p) => p.player_id === id)?.name ?? '';

export interface Series {
  wins: number;
  losses: number;
  ties: number;
  total: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Consecutive wins (+) or losses (-) for `playerId` heading into the next meeting. */
  streak: number;
  lastMeeting: { season_id: number; week: number; scoreFor: number; scoreAgainst: number } | null;
  playoffMeetings: number;
}

/** The all-time series between two managers, told from `playerId`'s side. */
export function getSeries(playerId: number, opponentId: number): Series | null {
  const [lo, hi] = playerId < opponentId ? [playerId, opponentId] : [opponentId, playerId];
  const record = headToHead[`${lo}_${hi}`];
  if (!record) return null;

  const isLo = playerId === lo;
  const games = [...record.matchups].sort(
    (a, b) => a.season_id - b.season_id || a.week_start - b.week_start
  );

  let streak = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    const g = games[i];
    const scoreFor = isLo ? g.player1_score : g.player2_score;
    const scoreAgainst = isLo ? g.player2_score : g.player1_score;
    if (scoreFor === scoreAgainst) break;
    const won = scoreFor > scoreAgainst;
    if (streak === 0) streak = won ? 1 : -1;
    else if (won === streak > 0) streak += won ? 1 : -1;
    else break;
  }

  const last = games[games.length - 1];
  return {
    wins: isLo ? record.player1_wins : record.player2_wins,
    losses: isLo ? record.player2_wins : record.player1_wins,
    ties: record.ties,
    total: record.total_matchups,
    pointsFor: isLo ? record.player1_total_points : record.player2_total_points,
    pointsAgainst: isLo ? record.player2_total_points : record.player1_total_points,
    streak,
    lastMeeting: last
      ? {
          season_id: last.season_id,
          week: last.week_start,
          scoreFor: isLo ? last.player1_score : last.player2_score,
          scoreAgainst: isLo ? last.player2_score : last.player1_score,
        }
      : null,
    playoffMeetings: games.filter((g) => g.game_type !== 'regular').length,
  };
}

export type StakesTone = 'gold' | 'red' | 'green' | 'neutral';

export interface Stakes {
  label: string;
  tone: StakesTone;
}

/**
 * The most interesting thing true about this matchup — standings stakes first,
 * then the shape of the all-time series.
 */
export function getStakes(
  homeId: number,
  awayId: number,
  standings: CurrentStanding[],
  playoffCount: number
): Stakes | null {
  const rankOf = (id: number) => standings.findIndex((s) => s.player_id === id) + 1;
  const homeRank = rankOf(homeId);
  const awayRank = rankOf(awayId);
  const series = getSeries(homeId, awayId);

  // Standings stakes first — they're the rarest and most immediate.
  if (homeRank > 0 && awayRank > 0) {
    if (homeRank <= 2 && awayRank <= 2) return { label: 'First place on the line', tone: 'gold' };
    if (homeRank >= standings.length - 1 && awayRank >= standings.length - 1) {
      return { label: 'Toilet bowl preview', tone: 'red' };
    }
    if (homeRank <= playoffCount && awayRank <= playoffCount) {
      return { label: 'Playoff seeding clash', tone: 'gold' };
    }
  }

  if (!series || series.total < 4) return null;

  // Then the shape of the series, most distinctive fact first.
  const decided = series.wins + series.losses;
  const winRate = decided ? series.wins / decided : 0.5;

  if (series.total >= 8 && winRate >= 0.75) {
    return { label: `${nameOf(homeId)} owns this matchup ${series.wins}-${series.losses}`, tone: 'green' };
  }
  if (series.total >= 8 && winRate <= 0.25) {
    return { label: `${nameOf(awayId)} owns this matchup ${series.losses}-${series.wins}`, tone: 'red' };
  }
  if (series.total >= 8 && series.wins === series.losses) {
    return { label: `Dead even ${series.wins}-${series.losses} all time`, tone: 'neutral' };
  }
  if (Math.abs(series.streak) >= 3) {
    const leader = series.streak > 0 ? homeId : awayId;
    return {
      label: `${nameOf(leader)} has won ${Math.abs(series.streak)} straight`,
      tone: series.streak > 0 ? 'green' : 'red',
    };
  }
  if (series.playoffMeetings >= 3) {
    return { label: `${series.playoffMeetings} postseason meetings`, tone: 'gold' };
  }

  // Nothing notable — better a bare card than a badge on every game.
  return null;
}

/** "Spirk leads 9-8" / "Dead even 8-8" — always phrased from the leader's side. */
export function describeSeries(
  series: Series,
  playerName: string,
  opponentName: string
): string {
  const { wins, losses, ties } = series;
  const tieSuffix = ties > 0 ? `-${ties}` : '';
  if (wins === losses) return `Dead even ${wins}-${losses}${tieSuffix}`;
  return wins > losses
    ? `${playerName} leads ${wins}-${losses}${tieSuffix}`
    : `${opponentName} leads ${losses}-${wins}${tieSuffix}`;
}
