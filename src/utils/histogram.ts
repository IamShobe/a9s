export interface HistogramBar {
  rangeLabel: string;
  count: number;
  bar: string;
}

const BLOCK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export function buildHistogram(values: string[], buckets = 8): HistogramBar[] | null {
  const nums = values.map((v) => parseFloat(v.replace(/[,KMGkgb ]/gi, ""))).filter((n) => !isNaN(n));
  if (nums.length === 0) return null;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (max === min) return [{ rangeLabel: String(min), count: nums.length, bar: "█".repeat(8) }];

  const bucketSize = (max - min) / buckets;
  const counts = new Array<number>(buckets).fill(0);
  for (const n of nums) {
    const idx = Math.min(Math.floor((n - min) / bucketSize), buckets - 1);
    counts[idx]!++;
  }

  const maxCount = Math.max(...counts);

  return counts.map((count, i) => {
    const lo = min + i * bucketSize;
    const hi = lo + bucketSize;
    const barLen = maxCount === 0 ? 0 : Math.round((count / maxCount) * 8);
    const barChar = barLen > 0 ? BLOCK_CHARS[barLen - 1]! : " ";
    const bar = barChar.repeat(Math.max(1, barLen));
    return {
      rangeLabel: `${lo.toFixed(1)}–${hi.toFixed(1)}`,
      count,
      bar: bar.padEnd(8),
    };
  });
}
