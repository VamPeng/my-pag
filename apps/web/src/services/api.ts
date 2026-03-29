import type { BootstrapData, ItemProgress, ItemSummary, SmartViewKey, DirFilter } from '../types/item';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getBootstrap() {
  return requestJson<BootstrapData>('/api/bootstrap');
}

/** 统一查询接口：时间筛选与目录筛选可独立组合，null 表示该维度不限制 */
export async function getItems(params: {
  view?: SmartViewKey | null;
  dirFilter?: DirFilter | null;
}): Promise<ItemSummary[]> {
  const qs = new URLSearchParams();
  if (params.view) qs.set('view', params.view);
  if (params.dirFilter) {
    qs.set('directoryId', params.dirFilter.type === 'unclassified' ? 'unclassified' : params.dirFilter.id);
  }
  const query = qs.toString();
  return requestJson<ItemSummary[]>(`/api/items${query ? `?${query}` : ''}`);
}

/** @deprecated 使用 getItems 代替 */
export async function getViewItems(view: SmartViewKey) {
  return requestJson<ItemSummary[]>(`/api/views/${view}`);
}

export async function createItem(payload: { title: string; directoryId?: string | null; expectedAt?: string | null }) {
  return requestJson<ItemSummary>('/api/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function patchItem(
  itemId: string,
  payload: {
    title?: string;
    notes?: string | null;
    progress?: ItemProgress;
  },
) {
  return requestJson<ItemSummary>(`/api/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** @deprecated 使用 getItems 代替 */
export async function getUnclassifiedItems(): Promise<ItemSummary[]> {
  return requestJson<ItemSummary[]>('/api/views/unclassified');
}

/** @deprecated 使用 getItems 代替 */
export async function getDirectoryItems(directoryId: string): Promise<ItemSummary[]> {
  return requestJson<ItemSummary[]>(`/api/directories/${directoryId}/items`);
}

export async function completeItem(itemId: string) {
  return requestJson<ItemSummary>(`/api/items/${itemId}/complete`, {
    method: 'POST',
  });
}

export async function createDirectory(payload: { name: string; parentId?: string | null; sortOrder?: number; color?: string | null }) {
  return requestJson<import('../types/item').DirectoryNode>('/api/directories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteDirectory(dirId: string) {
  return requestJson<void>(`/api/directories/${dirId}?mode=move_to_inbox`, {
    method: 'DELETE',
  });
}
