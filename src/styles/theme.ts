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
