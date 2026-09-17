// ============================================
// Fantasy Football History — Theme Configuration
// ============================================

/**
 * Tailwind-style color class names mapped to each player ID.
 * Use these with className for Tailwind utility classes.
 */
export const playerColors: Record<number, string> = {
  1: 'blue',
  2: 'red',
  3: 'green',
  4: 'orange',
  5: 'purple',
  6: 'cyan',
  7: 'pink',
  8: 'amber',
  9: 'lime',
  10: 'indigo',
};

/**
 * Hex color values mapped to each player ID.
 * Use these for charts, inline styles, canvas, or SVG rendering.
 */
export const playerColorValues: Record<number, string> = {
  1: '#3b82f6',   // blue-500
  2: '#ef4444',   // red-500
  3: '#22c55e',   // green-500
  4: '#f97316',   // orange-500
  5: '#a855f7',   // purple-500
  6: '#06b6d4',   // cyan-500
  7: '#ec4899',   // pink-500
  8: '#f59e0b',   // amber-500
  9: '#84cc16',   // lime-500
  10: '#6366f1',  // indigo-500
};

/**
 * Returns the hex color value for a given player ID.
 * Falls back to a neutral gray if the player ID is not found.
 */
export function getPlayerColor(id: number): string {
  return playerColorValues[id] ?? '#9ca3af';
}

/**
 * Hex colors for NFL positions, used on draft boards and transaction rows.
 */
export const positionColors: Record<string, string> = {
  QB: '#ef4444', // red
  RB: '#22c55e', // green
  WR: '#3b82f6', // blue
  TE: '#f59e0b', // amber
  K: '#a855f7', // purple
  'D/ST': '#64748b', // slate
};

export function getPositionColor(position: string): string {
  return positionColors[position] ?? '#9ca3af';
}

/** Lineup-slot order (includes FLEX). K and D/ST kept consistent with POSITION_ORDER. */
export const SLOT_ORDER = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'D/ST'];

/** Roster position order, used when there's no lineup slot to sort by. */
export const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'];

const rankIn = (order: string[], value: string) => {
  const i = order.indexOf(value);
  return i === -1 ? order.length : i;
};

export const slotRank = (slot: string) => rankIn(SLOT_ORDER, slot);
export const positionRank = (position: string) => rankIn(POSITION_ORDER, position);

/**
 * Returns Recharts-compatible tooltip style object for the current theme.
 */
export function getChartTooltipStyle(isDark: boolean) {
  return {
    backgroundColor: isDark ? '#111827' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 8,
    color: isDark ? '#e5e7eb' : '#111827',
  };
}
