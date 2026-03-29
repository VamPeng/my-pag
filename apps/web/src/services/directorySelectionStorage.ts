import type { DirFilter, DirectoryNode } from '../types/item';

/** 与后端目录树无关，仅前端记住「侧栏目录 + 可选三级 tag」 */
export const DIR_SELECTION_STORAGE_KEY = 'mypag.dirSelection.v1';

export interface PersistedDirSelection {
  dirFilter: DirFilter | null;
  level3DirId: string | null;
}

function findDirectoryNode(nodes: DirectoryNode[], id: string): DirectoryNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findDirectoryNode(node.children, id);
    if (found) return found;
  }
  return null;
}

function parseStored(raw: string | null): PersistedDirSelection | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object') return null;
    const rec = o as Record<string, unknown>;
    const level3DirId =
      rec.level3DirId === null || rec.level3DirId === undefined
        ? null
        : typeof rec.level3DirId === 'string'
          ? rec.level3DirId
          : null;
    if (rec.dirFilter === null || rec.dirFilter === undefined) {
      return { dirFilter: null, level3DirId };
    }
    const df = rec.dirFilter as Record<string, unknown>;
    if (df.type === 'unclassified') {
      return { dirFilter: { type: 'unclassified' }, level3DirId: null };
    }
    if (df.type === 'directory' && typeof df.id === 'string') {
      return { dirFilter: { type: 'directory', id: df.id }, level3DirId };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 用当前目录树校验本地存的 id 是否仍有效；无效则回退为「全部」。
 */
export function validatePersistedDirSelection(
  directories: DirectoryNode[],
  persisted: PersistedDirSelection | null,
): PersistedDirSelection {
  if (!persisted) return { dirFilter: null, level3DirId: null };

  let { dirFilter, level3DirId } = persisted;

  if (dirFilter?.type === 'directory') {
    const n = findDirectoryNode(directories, dirFilter.id);
    if (!n) dirFilter = null;
  }

  if (dirFilter === null || dirFilter.type === 'unclassified') {
    return { dirFilter, level3DirId: null };
  }

  if (!level3DirId) {
    return { dirFilter, level3DirId: null };
  }

  const l3Node = findDirectoryNode(directories, level3DirId);
  const parent = dirFilter.type === 'directory' ? findDirectoryNode(directories, dirFilter.id) : null;
  if (
    !l3Node ||
    !parent ||
    l3Node.parentId !== parent.id
  ) {
    return { dirFilter, level3DirId: null };
  }

  return { dirFilter, level3DirId };
}

export function readPersistedDirSelection(): PersistedDirSelection | null {
  if (typeof localStorage === 'undefined') return null;
  return parseStored(localStorage.getItem(DIR_SELECTION_STORAGE_KEY));
}

export function writePersistedDirSelection(selection: PersistedDirSelection): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DIR_SELECTION_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // 隐私模式 / 配额等：忽略
  }
}
