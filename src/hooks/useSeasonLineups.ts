import { useEffect, useState } from 'react';
import type { WeeklyLineupSpot, LineupIndexEntry } from '@/data/types';
import lineupIndexData from '@/data/lineup-index.json';

const lineupIndex = lineupIndexData as LineupIndexEntry[];

// One chunk per season: the full archive is ~21k rows and must not ship in the
// main bundle. Vite turns this glob into a separate lazy chunk per file.
const lineupFiles = import.meta.glob<{ default: WeeklyLineupSpot[] }>('../data/lineups/*.json');

export function lineupSeasons(): number[] {
  return lineupIndex.map((e) => e.season_id).sort((a, b) => b - a);
}

export function weeksWithLineups(year: number): number[] {
  return lineupIndex.find((e) => e.season_id === year)?.weeks ?? [];
}

export function hasLineups(year: number): boolean {
  return lineupIndex.some((e) => e.season_id === year);
}

/**
 * Lazy-loads one season's weekly lineups. Returns null until the chunk lands,
 * and never returns another season's rows while a new one is loading.
 */
export function useSeasonLineups(year: number): WeeklyLineupSpot[] | null {
  const [loaded, setLoaded] = useState<{ year: number; rows: WeeklyLineupSpot[] } | null>(null);

  useEffect(() => {
    const loader = lineupFiles[`../data/lineups/${year}.json`];
    if (!loader) return;

    let cancelled = false;
    loader().then((mod) => {
      if (!cancelled) setLoaded({ year, rows: mod.default });
    });
    return () => {
      cancelled = true;
    };
  }, [year]);

  return loaded?.year === year ? loaded.rows : null;
}
