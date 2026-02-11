import { useState } from 'react';
import { getPlayerColor } from '@/styles/theme';
import { getPlayerImagePath } from '@/utils/formatting';
import players from '@/data/players.json';
import type { Player } from '@/data/types';

const typedPlayers = players as Player[];

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 80,
  xl: 120,
} as const;

interface PlayerAvatarProps {
  playerId: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showRing?: boolean;
  className?: string;
}

export default function PlayerAvatar({
  playerId,
  size = 'md',
  showRing = false,
  className = '',
}: PlayerAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const player = typedPlayers.find((p) => p.player_id === playerId);
  const playerName = player?.name ?? '?';
  const initial = playerName.charAt(0).toUpperCase();
  const color = getPlayerColor(playerId);
  const px = sizeMap[size];
  const imageSize = size === 'sm' || size === 'md' ? 'thumb' : 'full';
  const src = getPlayerImagePath(playerId, imageSize);

  const ringStyle = showRing
    ? { boxShadow: `0 0 0 2px ${color}` }
    : undefined;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: px, height: px, ...ringStyle }}
    >
      {imgError ? (
        <div
          className="flex h-full w-full items-center justify-center font-heading font-bold text-on-surface"
          style={{ backgroundColor: color, fontSize: px * 0.4 }}
        >
          {initial}
        </div>
      ) : (
        <img
          src={src}
          alt={playerName}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      )}
    </div>
  );
}
