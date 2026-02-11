import PlayerAvatar from '@/components/common/PlayerAvatar';
import { formatScore } from '@/utils/formatting';
import players from '@/data/players.json';
import type { Player, WeeklyMatchup } from '@/data/types';

const typedPlayers = players as Player[];

function getPlayerName(id: number): string {
  return typedPlayers.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

const gameTypeBadges: Record<string, { label: string; className: string }> = {
  semifinal: {
    label: 'Semifinal',
    className: 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30',
  },
  championship: {
    label: 'Championship',
    className: 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30',
  },
  '3rd_place': {
    label: '3rd Place',
    className: 'bg-surface-inset/30 text-on-surface-muted border border-border-default',
  },
  toilet_bowl: {
    label: 'Toilet Bowl',
    className: 'bg-[#92400e]/15 text-[#b45309] border border-[#92400e]/30',
  },
};

interface MatchupRowProps {
  matchup: WeeklyMatchup;
  highlightPlayerId?: number;
}

export default function MatchupRow({ matchup, highlightPlayerId }: MatchupRowProps) {
  const {
    player1_id,
    player2_id,
    player1_score,
    player2_score,
    game_type,
  } = matchup;

  const p1Wins = player1_score > player2_score;
  const p2Wins = player2_score > player1_score;
  const isTie = player1_score === player2_score;

  function scoreColor(isWinner: boolean): string {
    if (isTie) return 'text-on-surface-muted';
    return isWinner ? 'text-[#22c55e]' : 'text-[#ef4444]';
  }

  function nameHighlight(playerId: number): string {
    if (highlightPlayerId === playerId) return 'text-on-surface font-semibold';
    return 'text-on-surface-muted';
  }

  const badge = gameTypeBadges[game_type];

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-card/50 px-4 py-3">
      {/* Player 1 (left side) */}
      <div className="flex flex-1 items-center gap-2">
        <PlayerAvatar playerId={player1_id} size="sm" />
        <span className={`truncate text-sm ${nameHighlight(player1_id)}`}>
          {getPlayerName(player1_id)}
        </span>
      </div>

      {/* Scores */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`font-score text-sm font-bold ${scoreColor(p1Wins)}`}>
          {formatScore(player1_score)}
        </span>
        <span className="text-xs text-on-surface-faint">vs</span>
        <span className={`font-score text-sm font-bold ${scoreColor(p2Wins)}`}>
          {formatScore(player2_score)}
        </span>
      </div>

      {/* Player 2 (right side) */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <span className={`truncate text-right text-sm ${nameHighlight(player2_id)}`}>
          {getPlayerName(player2_id)}
        </span>
        <PlayerAvatar playerId={player2_id} size="sm" />
      </div>

      {/* Game type badge */}
      {badge && (
        <span
          className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${badge.className}`}
        >
          {badge.label}
        </span>
      )}
    </div>
  );
}
