import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import players from '@/data/players.json';
import championships from '@/data/championships.json';
import type { Player, Championship } from '@/data/types';

const typedPlayers = players as Player[];
const typedChampionships = championships as Championship[];

interface PlayerCardProps {
  playerId: number;
  stats?: { label: string; value: string | number }[];
  onClick?: () => void;
}

export default function PlayerCard({ playerId, stats, onClick }: PlayerCardProps) {
  const player = typedPlayers.find((p) => p.player_id === playerId);
  const playerName = player?.name ?? 'Unknown';
  const championshipCount = typedChampionships.filter(
    (c) => c.winner_id === playerId
  ).length;

  const content = (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border-default bg-surface-card/70 p-5 backdrop-blur transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]">
      <PlayerAvatar playerId={playerId} size="lg" showRing />

      <div className="flex items-center gap-2">
        <h3 className="font-heading text-lg font-semibold text-on-surface">
          {playerName}
        </h3>
        {championshipCount > 0 && (
          <div className="flex items-center gap-0.5">
            {Array.from({ length: championshipCount }).map((_, i) => (
              <Trophy
                key={i}
                className="h-4 w-4 text-[#f59e0b]"
              />
            ))}
          </div>
        )}
      </div>

      {stats && stats.length > 0 && (
        <div className="mt-1 grid w-full grid-cols-2 gap-x-4 gap-y-2">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center">
              <span className="font-score text-sm font-semibold text-on-surface">
                {stat.value}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-on-surface-faint">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left cursor-pointer">
        {content}
      </button>
    );
  }

  return (
    <Link to={`/players/${playerId}`} className="block">
      {content}
    </Link>
  );
}
