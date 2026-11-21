const STEP = 1024;

/**
 * Fractional ordering inside a column: only the moved card changes.
 * `before` / `after` are the positions of the neighbours at the drop target.
 */
export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return STEP;
  if (before === undefined) return (after as number) - STEP;
  if (after === undefined) return before + STEP;
  return (before + after) / 2;
}

/** Position for appending to the end of a column. */
export function positionAtEnd(positions: readonly number[]): number {
  return positions.length === 0 ? STEP : Math.max(...positions) + STEP;
}
