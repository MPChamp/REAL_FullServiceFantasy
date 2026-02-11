// ============================================
// Fantasy Football History — Formatting Utilities
// ============================================

/**
 * Formats a score for display.
 * Integers are shown without decimals; decimals are shown with 2 decimal places.
 *
 * @example formatScore(120)    → "120"
 * @example formatScore(120.5)  → "120.50"
 */
export function formatScore(score: number): string {
  if (Number.isInteger(score)) {
    return score.toString();
  }
  return score.toFixed(2);
}

/**
 * Formats a win-loss-tie record string.
 *
 * @example formatRecord(8, 5, 0)  → "8-5-0"
 * @example formatRecord(10, 3, 1) → "10-3-1"
 */
export function formatRecord(wins: number, losses: number, ties: number): string {
  return `${wins}-${losses}-${ties}`;
}

/**
 * Formats a decimal value as a percentage string.
 * The input value should be between 0 and 1 (e.g. 0.538 → "53.8%").
 *
 * @example formatPercent(0.538)  → "53.8%"
 * @example formatPercent(1)      → "100.0%"
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Formats a numeric rank with the appropriate ordinal suffix.
 *
 * @example formatRank(1)  → "1st"
 * @example formatRank(2)  → "2nd"
 * @example formatRank(3)  → "3rd"
 * @example formatRank(4)  → "4th"
 * @example formatRank(11) → "11th"
 * @example formatRank(12) → "12th"
 * @example formatRank(13) → "13th"
 * @example formatRank(21) → "21st"
 */
export function formatRank(rank: number): string {
  const remainder10 = rank % 10;
  const remainder100 = rank % 100;

  // Special case: 11th, 12th, 13th (not 1st, 2nd, 3rd)
  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${rank}th`;
  }

  switch (remainder10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

/**
 * Returns the image path for a player photo.
 *
 * @param playerId - The player's unique ID
 * @param size     - 'full' for the full-size image, 'thumb' for the thumbnail
 *
 * @example getPlayerImagePath(1, 'full')  → "/images/players/1.webp"
 * @example getPlayerImagePath(3, 'thumb') → "/images/players/3-thumb.webp"
 */
export function getPlayerImagePath(playerId: number, size: 'full' | 'thumb'): string {
  if (size === 'thumb') {
    return `/images/players/${playerId}-thumb.webp`;
  }
  return `/images/players/${playerId}.webp`;
}
