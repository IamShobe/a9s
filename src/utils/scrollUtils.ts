/** Clamp a scroll offset to a valid range given total items and visible count. */
export function clampScrollOffset(
  offset: number,
  totalItems: number,
  visibleCount: number,
): number {
  return Math.max(0, Math.min(offset, Math.max(0, totalItems - visibleCount)));
}

/** Derive scroll indicator booleans from clamped offset, total, and visible count. */
export function scrollIndicators(
  offset: number,
  totalItems: number,
  visibleCount: number,
): { hasMoreAbove: boolean; hasMoreBelow: boolean } {
  return {
    hasMoreAbove: offset > 0,
    hasMoreBelow: offset + visibleCount < totalItems,
  };
}
