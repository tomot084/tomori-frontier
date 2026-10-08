/** Counts are gameplay units; at most 100 shared visual pieces represent any load. */
const stackAnchors = [
  [0, 0],
  [10, 10],
  [100, 24],
  [500, 42],
  [1000, 56],
  [5000, 80],
  [10000, 100],
];
export function visualStack(count: number): number {
  for (let i = 1; i < stackAnchors.length; i++) {
    const [end, pieces] = stackAnchors[i],
      [start, previous] = stackAnchors[i - 1];
    if (count <= end)
      return Math.ceil(
        previous +
          (Math.max(0, count - start) / (end - start)) * (pieces - previous),
      );
  }
  return 100;
}
export const stackHeight = (count: number, spacing = 0.34) =>
  Math.ceil(visualStack(count) / 2) * spacing;

const bulkAnchors = [
  [0, 1],
  [100, 1],
  [500, 1.15],
  [1000, 1.3],
  [5000, 1.75],
  [10000, 2.3],
];
/** Width still communicates larger loads when the top is outside the phone screen. */
export function stackBulk(count: number): number {
  for (let i = 1; i < bulkAnchors.length; i++) {
    const [end, width] = bulkAnchors[i],
      [start, previous] = bulkAnchors[i - 1];
    if (count <= end)
      return (
        previous +
        (Math.max(0, count - start) / (end - start)) * (width - previous)
      );
  }
  return 2.3;
}
