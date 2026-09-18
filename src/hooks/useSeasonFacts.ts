import { useEffect, useState } from 'react';
import type { GameFact } from '@/data/types';

// Per-season chunks, same discipline as the lineups: ~1.3MB together.
const factFiles = import.meta.glob<{ default: GameFact[] }>('../data/facts/*.json');

export function useSeasonFacts(year: number): GameFact[] | null {
  const [loaded, setLoaded] = useState<{ year: number; facts: GameFact[] } | null>(null);

  useEffect(() => {
    const loader = factFiles[`../data/facts/${year}.json`];
    if (!loader) return;

    let cancelled = false;
    loader()
      .then((mod) => {
        if (!cancelled) setLoaded({ year, facts: mod.default });
      })
      .catch((err) => {
        console.error(`Failed to load ${year} facts`, err);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  return loaded?.year === year ? loaded.facts : null;
}
