import { useMemo } from 'react';
import recordsData from '@/data/records.json';
import allTimeRecordsData from '@/data/all-time-records.json';
import championshipsData from '@/data/championships.json';
import playersData from '@/data/players.json';
import type { AllTimeRecord, Championship, Player } from '@/data/types';

const allTimeRecords = allTimeRecordsData as AllTimeRecord[];
const championships = championshipsData as Championship[];
const players = playersData as Player[];

interface RecordEntry {
  player_name?: string;
  winner_name?: string;
  loser_name?: string;
  player1_name?: string;
  player2_name?: string;
  value?: number;
  margin?: number;
  combined?: number;
  winner_score?: number;
  loser_score?: number;
  player1_score?: number;
  player2_score?: number;
  record?: string;
  season_id?: number;
  week?: number;
}

const records = recordsData as Record<string, RecordEntry[]>;

function playerName(id: number): string {
  return players.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

interface TickerItem {
  emoji: string;
  label: string;
  text: string;
}

function buildItems(): TickerItem[] {
  const items: TickerItem[] = [];

  const latestChamp = [...championships].sort((a, b) => b.season_id - a.season_id)[0];
  if (latestChamp) {
    items.push({
      emoji: '\u{1F451}',
      label: 'Reigning Champ',
      text: `${playerName(latestChamp.winner_id)} took the ${latestChamp.season_id} crown`,
    });
  }

  const blowout = records.biggest_blowouts?.[0];
  if (blowout) {
    items.push({
      emoji: '\u{1F4A5}',
      label: 'Biggest Blowout',
      text: `${blowout.winner_name} destroyed ${blowout.loser_name} by ${blowout.margin?.toFixed(2)} (${blowout.season_id} W${blowout.week})`,
    });
  }

  const closest = records.closest_games?.[0];
  if (closest) {
    items.push({
      emoji: '\u{1F62C}',
      label: 'Closest Game',
      text: `${closest.winner_name} edged ${closest.loser_name} ${closest.winner_score?.toFixed(2)}–${closest.loser_score?.toFixed(2)} (${closest.season_id} W${closest.week})`,
    });
  }

  const high = records.highest_regular_score?.[0];
  if (high) {
    items.push({
      emoji: '\u{1F525}',
      label: 'Highest Score Ever',
      text: `${high.player_name} dropped ${high.value?.toFixed(2)} (${high.season_id} W${high.week})`,
    });
  }

  const low = records.lowest_regular_score?.[0];
  if (low) {
    items.push({
      emoji: '\u{1F976}',
      label: 'Lowest Score Ever',
      text: `${low.player_name} managed just ${low.value?.toFixed(2)} (${low.season_id} W${low.week})`,
    });
  }

  const titles = [...allTimeRecords].sort((a, b) => b.championships - a.championships)[0];
  if (titles) {
    items.push({
      emoji: '\u{1F3C6}',
      label: 'Most Titles',
      text: `${titles.name} owns ${titles.championships} championships`,
    });
  }

  const wins = [...allTimeRecords].sort((a, b) => b.total_wins - a.total_wins)[0];
  if (wins) {
    items.push({
      emoji: '\u{1F4C8}',
      label: 'Wins Leader',
      text: `${wins.name} leads all-time with ${wins.total_wins} career wins`,
    });
  }

  const bestSeason = records.most_wins_season?.[0];
  if (bestSeason) {
    items.push({
      emoji: '\u{1F9E8}',
      label: 'Best Season',
      text: `${bestSeason.player_name} went ${bestSeason.record} in ${bestSeason.season_id}`,
    });
  }

  const ppgSeason = records.highest_ppg_season?.[0];
  if (ppgSeason) {
    items.push({
      emoji: '⚡',
      label: 'Hottest Season',
      text: `${ppgSeason.player_name} averaged ${ppgSeason.value?.toFixed(1)} PPG in ${ppgSeason.season_id}`,
    });
  }

  const tbKing = records.toilet_bowl_wins?.[0];
  if (tbKing) {
    items.push({
      emoji: '\u{1F6BD}',
      label: 'Toilet Bowl King',
      text: `${tbKing.player_name} has survived the bowl ${tbKing.value}x`,
    });
  }

  const shame = records.last_place_counts?.[0];
  if (shame) {
    items.push({
      emoji: '\u{1F4A9}',
      label: 'Shame Leader',
      text: `${shame.player_name} has finished dead last ${shame.value}x`,
    });
  }

  return items;
}

/**
 * ESPN-style breaking-news marquee of league records and shame.
 * Content is duplicated for a seamless CSS loop; pauses on hover.
 */
export default function NewsTicker() {
  const items = useMemo(buildItems, []);

  const strip = (keyPrefix: string, ariaHidden = false) => (
    <div className="flex shrink-0 items-center" aria-hidden={ariaHidden || undefined}>
      {items.map((item, i) => (
        <span key={`${keyPrefix}-${i}`} className="flex items-center whitespace-nowrap">
          <span className="mx-3 text-base">{item.emoji}</span>
          <span className="font-heading text-xs font-bold uppercase tracking-widest text-gold">
            {item.label}
          </span>
          <span className="mx-2 text-on-surface-faint">&mdash;</span>
          <span className="text-sm text-on-surface-muted">{item.text}</span>
          <span className="mx-5 text-gold/40">&#9733;</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="relative -mx-4 overflow-hidden border-y border-gold/20 bg-surface-card/60 py-2.5 backdrop-blur-sm">
      <div className="ticker-track flex w-max">
        {strip('a')}
        {strip('b', true)}
      </div>
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-surface to-transparent" />
    </div>
  );
}
