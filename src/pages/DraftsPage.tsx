import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Search, Trophy, LayoutGrid, ClipboardList } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import ScrollableTable from '@/components/common/ScrollableTable';
import SeasonSelector from '@/components/common/SeasonSelector';
import StatCard from '@/components/common/StatCard';
import RosterBoard from '@/components/RosterBoard';
import { getPositionColor } from '@/styles/theme';
import { formatRank } from '@/utils/formatting';
import { usePageTitle } from '@/hooks/usePageTitle';

import type { Player, DraftPick, TeamName, SeasonResult, Championship } from '@/data/types';
import playersData from '@/data/players.json';
import draftsData from '@/data/drafts.json';
import teamNamesData from '@/data/team-names.json';
import seasonResultsData from '@/data/season-results.json';
import championshipsData from '@/data/championships.json';

const players = playersData as Player[];
const drafts = draftsData as DraftPick[];
const teamNames = teamNamesData as TeamName[];
const seasonResults = seasonResultsData as SeasonResult[];
const championships = championshipsData as Championship[];

const finishOf = (seasonId: number, playerId: number) =>
  seasonResults.find((r) => r.season_id === seasonId && r.player_id === playerId)?.rank ?? null;

const draftYears = [...new Set(drafts.map((p) => p.season_id))].sort((a, b) => b - a);
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'];

function getPlayerName(id: number): string {
  return players.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

function PositionBadge({ position }: { position: string }) {
  const color = getPositionColor(position);
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
      style={{ color, backgroundColor: `${color}1a` }}
    >
      {position}
    </span>
  );
}

export default function DraftsPage() {
  usePageTitle('Drafts');
  const [year, setYear] = useState(draftYears[0]);
  const [query, setQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string | null>(null);
  const [view, setView] = useState<'draft' | 'rosters'>('draft');

  const seasonPicks = useMemo(() => drafts.filter((p) => p.season_id === year), [year]);

  // Managers ordered by their first-round slot, so each column reads as one draft.
  const columns = useMemo(() => {
    return seasonPicks
      .filter((p) => p.round === 1)
      .sort((a, b) => a.round_pick - b.round_pick)
      .map((p) => ({
        playerId: p.player_id,
        slot: p.round_pick,
        teamName: teamNames.find((t) => t.season_id === year && t.player_id === p.player_id)?.team_name,
        finish: finishOf(year, p.player_id),
        isChamp: championships.some((c) => c.season_id === year && c.winner_id === p.player_id),
      }));
  }, [seasonPicks, year]);

  const rounds = useMemo(() => {
    const max = seasonPicks.reduce((m, p) => Math.max(m, p.round), 0);
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [seasonPicks]);

  const pickAt = useMemo(() => {
    const map = new Map<string, DraftPick>();
    for (const p of seasonPicks) map.set(`${p.round}:${p.player_id}`, p);
    return map;
  }, [seasonPicks]);

  const matches = (pick: DraftPick) => {
    if (positionFilter && pick.position !== positionFilter) return false;
    if (query && !pick.nfl_player_name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  };
  const isFiltering = Boolean(query || positionFilter);

  // Draft slot vs. where that pick actually finished, across every completed season.
  const slotHistory = useMemo(() => {
    const bySlot = new Map<number, { finishes: number[]; titles: number; lasts: number; playoffs: number }>();

    for (const pick of drafts) {
      if (pick.round !== 1) continue;
      const finish = finishOf(pick.season_id, pick.player_id);
      if (finish === null) continue; // season still in progress

      if (!bySlot.has(pick.round_pick)) {
        bySlot.set(pick.round_pick, { finishes: [], titles: 0, lasts: 0, playoffs: 0 });
      }
      const entry = bySlot.get(pick.round_pick)!;
      entry.finishes.push(finish);
      if (championships.some((c) => c.season_id === pick.season_id && c.winner_id === pick.player_id)) {
        entry.titles++;
      }
      if (finish === 10) entry.lasts++;
      if (
        seasonResults.find((r) => r.season_id === pick.season_id && r.player_id === pick.player_id)?.made_playoffs
      ) {
        entry.playoffs++;
      }
    }

    return [...bySlot.entries()]
      .map(([slot, e]) => ({
        slot,
        seasons: e.finishes.length,
        avgFinish: e.finishes.reduce((s, f) => s + f, 0) / e.finishes.length,
        titles: e.titles,
        lasts: e.lasts,
        playoffRate: e.playoffs / e.finishes.length,
      }))
      .sort((a, b) => a.slot - b.slot);
  }, []);

  const bestSlot = useMemo(
    () => slotHistory.reduce((best, s) => (s.avgFinish < best.avgFinish ? s : best), slotHistory[0]),
    [slotHistory]
  );
  const worstSlot = useMemo(
    () => slotHistory.reduce((worst, s) => (s.avgFinish > worst.avgFinish ? s : worst), slotHistory[0]),
    [slotHistory]
  );

  const insights = useMemo(() => {
    const firstOf = (position: string) =>
      seasonPicks.filter((p) => p.position === position).sort((a, b) => a.overall_pick - b.overall_pick)[0];
    return {
      firstQb: firstOf('QB'),
      firstRb: firstOf('RB'),
      firstWr: firstOf('WR'),
      firstTe: firstOf('TE'),
    };
  }, [seasonPicks]);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="font-heading text-4xl font-bold text-on-surface">Draft Room</h1>
        <p className="mt-2 text-on-surface-muted">
          Every pick from {draftYears[draftYears.length - 1]} to {draftYears[0]} &mdash;{' '}
          {drafts.length.toLocaleString()} selections
        </p>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border-default bg-surface-inset p-1">
          {([
            { id: 'draft' as const, label: 'Draft Board', icon: LayoutGrid },
            { id: 'rosters' as const, label: 'Rosters', icon: ClipboardList },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                view === id
                  ? 'bg-[#f59e0b] text-black'
                  : 'text-on-surface-muted hover:text-on-surface'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <SeasonSelector value={year} onChange={setYear} years={draftYears} />

      {/* ── Season insights ── */}
      {view === 'draft' && (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'First QB', pick: insights.firstQb, accent: 'red' as const },
          { label: 'First RB', pick: insights.firstRb, accent: 'green' as const },
          { label: 'First WR', pick: insights.firstWr, accent: 'purple' as const },
          { label: 'First TE', pick: insights.firstTe, accent: 'gold' as const },
        ].map(({ label, pick, accent }) =>
          pick ? (
            <StatCard
              key={label}
              label={`${label} — pick ${pick.overall_pick} (${getPlayerName(pick.player_id)})`}
              value={pick.nfl_player_name}
              accent={accent}
            />
          ) : null
        )}
      </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a player..."
            className="w-full rounded-lg border border-border-default bg-surface-inset py-2 pl-9 pr-3 text-sm text-on-surface placeholder:text-on-surface-faint focus:border-[#f59e0b] focus:outline-none"
          />
        </div>

        {view === 'draft' && (
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((pos) => {
            const active = positionFilter === pos;
            const color = getPositionColor(pos);
            return (
              <button
                key={pos}
                type="button"
                onClick={() => setPositionFilter(active ? null : pos)}
                className="cursor-pointer rounded-full px-3 py-2 text-xs font-semibold transition-all duration-200"
                style={
                  active
                    ? { backgroundColor: color, color: '#fff' }
                    : { backgroundColor: `${color}1a`, color }
                }
              >
                {pos}
              </button>
            );
          })}
        </div>
        )}
      </div>

      {view === 'draft' ? (
       <>
      {/* ── Draft board ── */}
      <ScrollableTable>
        <table className="w-full min-w-[900px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-10 text-xs font-medium text-on-surface-faint">Rd</th>
              {columns.map((col) => (
                <th key={col.playerId} className="px-1 pb-2 align-bottom">
                  <Link to={`/players/${col.playerId}`} className="flex flex-col items-center gap-1 group">
                    <PlayerAvatar playerId={col.playerId} size="sm" showRing />
                    <span className="font-heading text-xs font-semibold text-on-surface group-hover:text-[#f59e0b]">
                      {getPlayerName(col.playerId)}
                    </span>
                    <span className="text-[10px] font-normal text-on-surface-faint">
                      pick {col.slot}
                    </span>
                    {col.finish !== null && (
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          col.isChamp
                            ? 'bg-[#f59e0b]/15 text-[#f59e0b]'
                            : col.finish === 10
                              ? 'bg-[#ef4444]/10 text-[#ef4444]'
                              : 'bg-surface-inset text-on-surface-muted'
                        }`}
                      >
                        {col.isChamp && <Trophy className="h-3 w-3" />}
                        {formatRank(col.finish)}
                      </span>
                    )}
                    {col.teamName && (
                      <span className="max-w-[9rem] truncate text-[10px] font-normal text-on-surface-faint">
                        {col.teamName}
                      </span>
                    )}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((round) => (
              <tr key={round}>
                <td className="text-center font-score text-xs text-on-surface-faint">{round}</td>
                {columns.map((col) => {
                  const pick = pickAt.get(`${round}:${col.playerId}`);
                  if (!pick) return <td key={col.playerId} />;

                  const dimmed = isFiltering && !matches(pick);
                  const color = getPositionColor(pick.position);
                  return (
                    <td key={col.playerId}>
                      <div
                        className={`h-full rounded-lg border-l-2 bg-surface-card/70 p-2 transition-opacity duration-200 ${
                          dimmed ? 'opacity-20' : 'opacity-100'
                        }`}
                        style={{ borderLeftColor: color }}
                      >
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="truncate text-xs font-medium text-on-surface">
                            {pick.nfl_player_name}
                          </span>
                          <span className="shrink-0 font-score text-[10px] text-on-surface-faint">
                            {pick.overall_pick}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <PositionBadge position={pick.position} />
                          <span className="text-[10px] text-on-surface-faint">{pick.pro_team}</span>
                          {pick.keeper && (
                            <span className="text-[10px] font-semibold text-[#f59e0b]">K</span>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>

      <p className="flex items-center gap-2 text-xs text-on-surface-faint">
        <Users className="h-3.5 w-3.5" />
        Columns follow each manager&rsquo;s first-round slot; the number on each card is the overall pick.
      </p>

      {/* ── Does draft slot matter? ── */}
      <section className="space-y-4 pt-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-on-surface">Does Your Pick Matter?</h2>
          <p className="mt-1 text-sm text-on-surface-muted">
            Where each first-round slot has actually finished, across {slotHistory[0]?.seasons ?? 0} completed
            seasons
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label={`Luckiest slot — ${bestSlot?.titles ?? 0} title${bestSlot?.titles === 1 ? '' : 's'}`}
            value={`Pick ${bestSlot?.slot} · ${bestSlot?.avgFinish.toFixed(1)} avg finish`}
            accent="green"
          />
          <StatCard
            label={`Cursed slot — ${worstSlot?.lasts ?? 0} last-place finish${worstSlot?.lasts === 1 ? '' : 'es'}`}
            value={`Pick ${worstSlot?.slot} · ${worstSlot?.avgFinish.toFixed(1)} avg finish`}
            accent="red"
          />
        </div>

        <ScrollableTable>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-on-surface-faint">
                <th className="py-2 pr-4 font-medium">Draft slot</th>
                <th className="py-2 pr-4 font-medium">Avg finish</th>
                <th className="py-2 pr-4 font-medium">Playoff rate</th>
                <th className="py-2 pr-4 font-medium">Titles</th>
                <th className="py-2 pr-4 font-medium">Last place</th>
                <th className="py-2 font-medium">Finish spread</th>
              </tr>
            </thead>
            <tbody>
              {slotHistory.map((s) => {
                // Scale the bar so a 1st-place average fills it and 10th empties it.
                const quality = (10 - s.avgFinish) / 9;
                return (
                  <tr key={s.slot} className="border-b border-border-default/50">
                    <td className="py-2.5 pr-4 font-score text-on-surface">{s.slot}</td>
                    <td className="py-2.5 pr-4 font-score text-on-surface">{s.avgFinish.toFixed(1)}</td>
                    <td className="py-2.5 pr-4 text-on-surface-muted">{Math.round(s.playoffRate * 100)}%</td>
                    <td className="py-2.5 pr-4">
                      {s.titles > 0 ? (
                        <span className="flex items-center gap-1 text-[#f59e0b]">
                          <Trophy className="h-3.5 w-3.5" />
                          {s.titles}
                        </span>
                      ) : (
                        <span className="text-on-surface-faint">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-on-surface-muted">
                      {s.lasts > 0 ? s.lasts : <span className="text-on-surface-faint">—</span>}
                    </td>
                    <td className="py-2.5">
                      <div className="h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-surface-inset">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#f59e0b] to-[#fbbf24]"
                          style={{ width: `${Math.max(quality * 100, 3)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollableTable>
      </section>
       </>
      ) : (
        <RosterBoard year={year} query={query} />
      )}
    </div>
  );
}
