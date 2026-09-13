export function mergeRetainedIndices(
  start: number,
  endExclusive: number,
  total: number,
  retained: readonly number[]
): number[] {
  const boundedStart = Math.max(0, Math.min(total, start));
  const boundedEnd = Math.max(boundedStart, Math.min(total, endExclusive));
  const indices = new Set<number>();
  for (let index = boundedStart; index < boundedEnd; index += 1) indices.add(index);
  for (const index of retained) {
    if (Number.isInteger(index) && index >= 0 && index < total) indices.add(index);
  }
  return [...indices].sort((left, right) => left - right);
}
