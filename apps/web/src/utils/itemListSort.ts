import type { ItemSummary } from '../types/item';

function completedAtMs(item: ItemSummary): number {
  if (!item.completedAt) return 0;
  const t = Date.parse(item.completedAt);
  return Number.isNaN(t) ? 0 : t;
}

/** 已完成：最近完成的排在前面（刚完成的会出现在已完成区第一个） */
export function compareDoneByCompletedAtDesc(a: ItemSummary, b: ItemSummary): number {
  return completedAtMs(b) - completedAtMs(a);
}

/**
 * 未完成在前、已完成在后；已完成区内按完成时间倒序。
 */
export function sortItemsForListDisplay(items: ItemSummary[]): ItemSummary[] {
  const active = items.filter((i) => i.progress !== 'done');
  const done = items.filter((i) => i.progress === 'done');
  const doneSorted = [...done].sort(compareDoneByCompletedAtDesc);
  return [...active, ...doneSorted];
}
