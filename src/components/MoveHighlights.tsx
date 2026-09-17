import { useMemo, useState } from 'react';
import { Trophy, Gem, Skull, ArrowRight } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { getPositionColor } from '@/styles/theme';
import { formatScore } from '@/utils/formatting';

import type { Player, ReconstructedMove, TradeSummary, TradePiece } from '@/data/types';
import playersData from '@/data/players.json';
import movesData from '@/data/reconstructed-moves.json';
import tradesData from '@/data/trades.json';

const players = playersData as Player[];
const moves = movesData as ReconstructedMove[];
const trades = tradesData as TradeSummary[];

const getPlayerName = (id: number) => players.find((p) => p.player_id === id)?.name ?? 'Unknown';

type Tab = 'pickups' | 'trades' | 'busts';

const TABS: { id: Tab; label: string; icon: typeof Gem }[] = [
  { id: 'pickups', label: 'Best pickups', icon: Gem },
  { id: 'trades', label: 'Most lopsided trades', icon: Trophy },
  { id: 'busts', label: 'Never started', icon: Skull },
];

/** A zero means "never in the lineup" far more often than "played and scored nothing". */
function describePiece(p: TradePiece): string {
  if (p.weeks_rostered === 0) return 'dropped before playing a week';
  if (p.weeks_started === 0) {
    const kept = `${p.weeks_rostered} wk${p.weeks_rostered === 1 ? '' : 's'} on roster`;
    return p.rostered_points > 0
      ? `never started — ${formatScore(p.rostered_points)} pts on the bench, ${kept}`
      : `never started, ${kept}`;
  }
  return `${p.weeks_started} start${p.weeks_started === 1 ? '' : 's'} of ${p.weeks_rostered} wks rostered`;
}

function PositionTag({ position }: { position: string }) {
  const color = getPositionColor(position);
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ color, backgroundColor: `${color}1a` }}
    >
      {position}
    </span>
  );
}

export default function MoveHighlights() {
  const [tab, setTab] = useState<Tab>('pickups');

  const acquisitions = useMemo(
    () => moves.filter((m) => m.started_points !== undefined && (m.kind === 'add' || m.kind === 'claimed')),
    []
  );

  const bestPickups = useMemo(
    () => [...acquisitions].sort((a, b) => (b.started_points ?? 0) - (a.started_points ?? 0)).slice(0, 10),
    [acquisitions]
  );

  // Players acquired, never put in the lineup, who went on to score anyway.
  const busts = useMemo(
    () =>
      acquisitions
        .filter((m) => m.weeks_started === 0 && (m.bench_points ?? 0) > 0)
        .sort((a, b) => (b.bench_points ?? 0) - (a.bench_points ?? 0))
        .slice(0, 10),
    [acquisitions]
  );

  const lopsided = useMemo(
    () => [...trades].filter((t) => t.winner !== null).sort((a, b) => b.margin - a.margin).slice(0, 8),
    []
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-2xl font-bold text-on-surface">Hits and Misses</h2>
        <p className="mt-1 text-sm text-on-surface-muted">
          Every move since 2018, judged on points the player went on to score in the acquirer's starting lineup. A zero usually means he was never started — not that he played badly.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border-default bg-surface-inset p-1 sm:inline-flex">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-all duration-200 sm:px-3 sm:text-sm ${
              tab === id ? 'bg-[#f59e0b] text-black' : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'pickups' && (
        <div className="space-y-2">
          {bestPickups.map((m, i) => (
            <div
              key={`${m.season_id}-${m.nfl_player_id}-${m.player_id}`}
              className="glass-card flex items-center gap-3 p-3"
            >
              <span className="w-5 shrink-0 font-score text-sm text-on-surface-faint">{i + 1}</span>
              <PlayerAvatar playerId={m.player_id} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-on-surface">
                    {m.nfl_player_name}
                  </span>
                  <PositionTag position={m.position} />
                </div>
                <div className="truncate text-[11px] text-on-surface-faint">
                  {getPlayerName(m.player_id)} &middot; {m.season_id} wk{m.week} &middot;{' '}
                  {m.weeks_started} starts
                </div>
              </div>
              <span className="shrink-0 text-right font-score text-sm text-[#22c55e]">
                {formatScore(m.started_points ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'trades' && (
        <div className="space-y-3">
          {lopsided.map((t) => {
            const winnerIsA = t.winner === t.manager_a;
            const winner = winnerIsA ? t.manager_a : t.manager_b;
            const loser = winnerIsA ? t.manager_b : t.manager_a;
            const winnerGot = winnerIsA ? t.a_received : t.b_received;
            const loserGot = winnerIsA ? t.b_received : t.a_received;
            const winnerPts = winnerIsA ? t.a_points : t.b_points;
            const loserPts = winnerIsA ? t.b_points : t.a_points;

            return (
              <div key={`${t.season_id}-${t.week}-${t.manager_a}-${t.manager_b}`} className="glass-card p-4">
                <div className="mb-3 flex items-center gap-2 border-b border-border-default pb-2">
                  <span className="text-[11px] text-on-surface-faint">
                    {t.season_id} &middot; week {t.week}
                  </span>
                  <div className="h-px flex-1 bg-border-default" />
                  <span className="rounded-full bg-[#f59e0b]/10 px-2 py-0.5 text-[11px] font-semibold text-[#f59e0b]">
                    {getPlayerName(winner)} +{formatScore(t.margin)}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { managerId: winner, got: winnerGot, pts: winnerPts, won: true },
                    { managerId: loser, got: loserGot, pts: loserPts, won: false },
                  ].map(({ managerId, got, pts, won }) => (
                    <div key={managerId}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <PlayerAvatar playerId={managerId} size="sm" showRing={won} />
                        <span className="flex-1 text-sm font-medium text-on-surface">
                          {getPlayerName(managerId)}
                        </span>
                        <span
                          className={`font-score text-sm ${won ? 'text-[#22c55e]' : 'text-on-surface-muted'}`}
                        >
                          {formatScore(pts)}
                        </span>
                      </div>
                      <ul className="space-y-0.5">
                        {got.map((p) => (
                          <li key={p.nfl_player_id} className="text-xs">
                            <div className="flex items-center gap-2">
                              <ArrowRight className="h-3 w-3 shrink-0 text-on-surface-faint" />
                              <span className="min-w-0 flex-1 truncate text-on-surface-muted">
                                {p.nfl_player_name}
                              </span>
                              <PositionTag position={p.position} />
                              <span className="w-12 shrink-0 text-right font-score text-on-surface-faint">
                                {formatScore(p.started_points)}
                              </span>
                            </div>
                            <div className="pl-5 text-[10px] text-on-surface-faint">
                              {describePiece(p)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'busts' && (
        <div className="space-y-2">
          <p className="text-xs text-on-surface-faint">
            Picked up, then left on the bench every single week &mdash; these are the points that never
            made it into a lineup.
          </p>
          {busts.map((m, i) => (
            <div
              key={`${m.season_id}-${m.nfl_player_id}-${m.player_id}`}
              className="glass-card flex items-center gap-3 p-3"
            >
              <span className="w-5 shrink-0 font-score text-sm text-on-surface-faint">{i + 1}</span>
              <PlayerAvatar playerId={m.player_id} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-on-surface">
                    {m.nfl_player_name}
                  </span>
                  <PositionTag position={m.position} />
                </div>
                <div className="truncate text-[11px] text-on-surface-faint">
                  {getPlayerName(m.player_id)} &middot; {m.season_id} wk{m.week} &middot; never started
                </div>
              </div>
              <span className="shrink-0 text-right font-score text-sm text-[#ef4444]">
                {formatScore(m.bench_points ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
