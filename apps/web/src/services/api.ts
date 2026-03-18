import type { BootstrapData, ItemProgress, ItemSummary, SmartViewKey } from '../types/item';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

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

export async function getViewItems(view: SmartViewKey) {
  return requestJson<ItemSummary[]>(`/api/views/${view}`);
}

export async function createItem(payload: { title: string }) {
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

export async function completeItem(itemId: string) {
  return requestJson<ItemSummary>(`/api/items/${itemId}/complete`, {
    method: 'POST',
  });
}
