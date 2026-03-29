import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  completeItem,
  createDirectory,
  createItem,
  deleteDirectory,
  getBootstrap,
  getItems,
  patchItem,
} from '../services/api';
import {
  readPersistedDirSelection,
  validatePersistedDirSelection,
  writePersistedDirSelection,
} from '../services/directorySelectionStorage';
import { compareDoneByCompletedAtDesc, sortItemsForListDisplay } from '../utils/itemListSort';
import { DirectoryCascadePicker, type DirPickerAnchor } from '../components/DirectoryCascadePicker';
import {
  BootstrapData,
  DirectoryNode,
  DirFilter,
  ItemSummary,
  SMART_VIEW_LABELS,
  SmartViewKey,
} from '../types/item';

const VIEW_ORDER: SmartViewKey[] = ['today', 'upcoming', 'overdue'];
const IS_MAC = globalThis.navigator?.platform?.startsWith('Mac') ?? false;

const DIR_COLORS = [
  '#ef5350', '#ec407a', '#ab47bc', '#7e57c2',
  '#42a5f5', '#26c6da', '#26a69a', '#66bb6a',
  '#d4e157', '#ffa726', '#ff7043', '#8d6e63',
];

function randomDirColor(): string {
  return DIR_COLORS[Math.floor(Math.random() * DIR_COLORS.length)];
}

function findDirName(nodes: DirectoryNode[], id: string): string {
  for (const node of nodes) {
    if (node.id === id) return node.name;
    const found = findDirName(node.children, id);
    if (found) return found;
  }
  return '';
}

function findPathToDir(nodes: DirectoryNode[], targetId: string): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return [node.id];
    const childPath = findPathToDir(node.children, targetId);
    if (childPath) return [node.id, ...childPath];
  }
  return null;
}

function findDirNamePath(nodes: DirectoryNode[], targetId: string): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return [node.name];
    const childPath = findDirNamePath(node.children, targetId);
    if (childPath) return [node.name, ...childPath];
  }
  return null;
}

function findDirectoryNode(nodes: DirectoryNode[], id: string): DirectoryNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findDirectoryNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * 任务条左侧色条用的颜色：与侧栏里目录名旁小圆点（`category-dot`）同源，即该目录节点在数据里的 `color` 字段。
 * 子目录在创建时常为 `color: null`，此时沿 `parentId` 向上找**最近一个有颜色的祖先**（通常是侧栏里带圆点的「根」目录），
 * 这样任务挂在子目录下时条色仍与所属分类一致。
 */
function findDirectoryAccentColor(nodes: DirectoryNode[], directoryId: string | null): string | null {
  if (!directoryId) return null;
  let current: DirectoryNode | null = findDirectoryNode(nodes, directoryId);
  while (current) {
    if (current.color) return current.color;
    if (!current.parentId) return null;
    current = findDirectoryNode(nodes, current.parentId);
  }
  return null;
}

/** 侧栏最多展示到 level 2（0=根、1、2）；level 3 在主区以 tag 展示 */
const SIDEBAR_MAX_LEVEL = 2;

function dirFilterEquals(a: DirFilter | null, b: DirFilter | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.type !== b.type) return false;
  if (a.type === 'directory' && b.type === 'directory') return a.id === b.id;
  return true; // both unclassified
}

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);

  // ── 双筛选器状态 ────────────────────────────────────────────────────────────
  // 时间筛选：默认今天；null 表示不限制时间
  const [timeFilter, setTimeFilter] = useState<SmartViewKey | null>('today');
  // 目录筛选：默认不选；null 表示不限制目录（全部）
  const [dirFilter, setDirFilter] = useState<DirFilter | null>(null);
  /** 选中二级目录时，其下三级目录在主区 tag 单选；null 表示未选三级（列表为二级子树） */
  const [level3DirId, setLevel3DirId] = useState<string | null>(null);

  const [items, setItems] = useState<ItemSummary[]>([]);
  const [itemFilter, setItemFilter] = useState<'all' | 'active' | 'done'>('all');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);

  // ── quick create input ─────────────────────────────────────────────────────
  const [quickTitle, setQuickTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // ── directory delete confirm ───────────────────────────────────────────────
  const [confirmDeleteDirId, setConfirmDeleteDirId] = useState<string | null>(null);
  const [confirmDeleteLevel3Id, setConfirmDeleteLevel3Id] = useState<string | null>(null);

  // ── add directory ──────────────────────────────────────────────────────────
  const [isAddingDir, setIsAddingDir] = useState(false);
  const [newDirName, setNewDirName] = useState('');
  const [isCreatingDir, setIsCreatingDir] = useState(false);
  const addDirInputRef = useRef<HTMLInputElement>(null);

  // ── modal detail ───────────────────────────────────────────────────────────
  const [modalItem, setModalItem] = useState<ItemSummary | null>(null);
  const [isDetailSaving, setIsDetailSaving] = useState(false);
  const [detailDraft, setDetailDraft] = useState({ title: '', notes: '' });
  const [modalOrigin, setModalOrigin] = useState('50% 50%');
  const [closeWarningActive, setCloseWarningActive] = useState(false);
  const originalDraft = useRef({ title: '', notes: '' });
  const closeWarningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tryCloseModalRef = useRef<() => void>(() => {});
  const modalNotesRef = useRef<HTMLTextAreaElement>(null);

  /** 点击任务左侧色条：级联选择目录 */
  const [dirPicker, setDirPicker] = useState<{ itemId: string; anchor: DirPickerAnchor } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** bootstrap 已就绪且已应用本地恢复的目录筛选后，再拉列表与写入 localStorage，避免覆盖恢复数据 */
  const [isBootstrapReady, setIsBootstrapReady] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  /** 点击完成时 FLIP：记录点击前列顶位置，乐观重排后再 translateY 到新位置 */
  const completeFlipSnapshotRef = useRef<{ itemId: string; firstTop: number } | null>(null);
  const [completeFlipTick, setCompleteFlipTick] = useState(0);
  /** 有 FLIP 时需「接口成功 + 动画结束」再 loadItems，避免拉到旧状态 */
  const completeFlipSyncRef = useRef({ apiDone: false, animDone: false });
  /** 三级删除进入「确认」后，需间隔一段时间才允许真正删除，避免双击第二次误触删除 */
  const level3DeleteConfirmReadyAtRef = useRef(0);

  // ── filter menu ────────────────────────────────────────────────────────────
  const toggleFilterMenu = () => {
    if (menuVisible && !menuClosing) { setMenuClosing(true); }
    else { setMenuClosing(false); setMenuVisible(true); }
  };
  const closeFilterMenu = () => setMenuClosing(true);
  const handleFilterMenuAnimationEnd = () => {
    if (menuClosing) { setMenuVisible(false); setMenuClosing(false); }
  };
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) closeFilterMenu();
    };
    if (menuVisible) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuVisible, menuClosing]);

  const effectiveDirFilter = useMemo((): DirFilter | null => {
    if (level3DirId) return { type: 'directory', id: level3DirId };
    return dirFilter;
  }, [level3DirId, dirFilter]);

  const timeFilterRef = useRef(timeFilter);
  const effectiveDirFilterRef = useRef(effectiveDirFilter);
  timeFilterRef.current = timeFilter;
  effectiveDirFilterRef.current = effectiveDirFilter;

  // ── data ───────────────────────────────────────────────────────────────────
  const loadItems = useCallback(async (tf: SmartViewKey | null, df: DirFilter | null) => {
    setItems(await getItems({ view: tf, dirFilter: df }));
  }, []);

  function tryCompleteFlipSync() {
    const s = completeFlipSyncRef.current;
    if (!s.apiDone || !s.animDone) return;
    completeFlipSyncRef.current = { apiDone: false, animDone: false };
    void loadItems(timeFilterRef.current, effectiveDirFilterRef.current);
  }

  useLayoutEffect(() => {
    const snap = completeFlipSnapshotRef.current;
    if (!snap) return;
    completeFlipSnapshotRef.current = null;

    const el = document.querySelector(`[data-item-id="${snap.itemId}"]`) as HTMLElement | null;
    if (!el) {
      completeFlipSyncRef.current.animDone = true;
      tryCompleteFlipSync();
      return;
    }

    const lastRect = el.getBoundingClientRect();
    const dy = snap.firstTop - lastRect.top;

    if (Math.abs(dy) < 1) {
      completeFlipSyncRef.current.animDone = true;
      tryCompleteFlipSync();
      return;
    }

    el.classList.add('item-morph--flip');
    el.style.willChange = 'transform';
    el.style.zIndex = '3';
    el.style.position = 'relative';
    el.style.transform = `translateY(${dy}px)`;
    el.style.transition = 'none';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = 'translateY(0)';
        const onEnd = (e: TransitionEvent) => {
          if (e.propertyName !== 'transform') return;
          el.removeEventListener('transitionend', onEnd);
          el.style.transition = '';
          el.style.transform = '';
          el.style.willChange = '';
          el.style.zIndex = '';
          el.style.position = '';
          el.classList.remove('item-morph--flip');
          completeFlipSyncRef.current.animDone = true;
          tryCompleteFlipSync();
        };
        el.addEventListener('transitionend', onEnd);
      });
    });
  }, [completeFlipTick, loadItems]);

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await getBootstrap();
      setBootstrap(data);
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setIsLoading(true); setErrorMessage(null);
        const data = await getBootstrap();
        if (cancelled) return;
        setBootstrap(data);
        const persisted = readPersistedDirSelection();
        const restored = validatePersistedDirSelection(data.directories, persisted);
        setDirFilter(restored.dirFilter);
        setLevel3DirId(restored.level3DirId);
        if (restored.dirFilter?.type === 'directory') {
          const path = findPathToDir(data.directories, restored.dirFilter.id);
          setExpandedDirs(new Set(path ?? []));
        } else {
          setExpandedDirs(new Set());
        }
        setIsBootstrapReady(true);
      } catch (e) {
        if (!cancelled) setErrorMessage((e as Error).message || '初始化失败');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void init();
    return () => { cancelled = true; };
  }, [loadItems]);

  useEffect(() => {
    if (!isBootstrapReady) return;
    let cancelled = false;
    async function refresh() {
      try { setErrorMessage(null); await loadItems(timeFilter, effectiveDirFilter); }
      catch (e) { if (!cancelled) setErrorMessage((e as Error).message || '加载失败'); }
    }
    void refresh();
    return () => { cancelled = true; };
  }, [timeFilter, effectiveDirFilter, loadItems, isBootstrapReady]);

  useEffect(() => {
    if (!isBootstrapReady) return;
    writePersistedDirSelection({ dirFilter, level3DirId });
  }, [dirFilter, level3DirId, isBootstrapReady]);

  // 切换筛选条件时重置快速创建、modal（三级 tag 仅在用户切换时间/目录时清除，见 handle*，以便刷新后可恢复三级）
  useEffect(() => {
    setQuickTitle('');
    setModalItem(null);
    setCloseWarningActive(false);
    setConfirmDeleteLevel3Id(null);
  }, [timeFilter, dirFilter]);

  // Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tryCloseModalRef.current();
    };
    if (modalItem) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalItem]);

  // ── 筛选器点击交互 ──────────────────────────────────────────────────────────
  function handleTimeFilterClick(view: SmartViewKey) {
    // 单选 + 可反选：再次点击取消
    setTimeFilter((prev) => (prev === view ? null : view));
    setLevel3DirId(null);
  }

  function handleDirFilterClick(df: DirFilter) {
    if (dirFilterEquals(dirFilter, df)) return;

    setLevel3DirId(null);
    setDirFilter(df);

    if (df.type === 'directory') {
      const path = findPathToDir(bootstrap!.directories, df.id);
      setExpandedDirs(new Set(path ?? []));
    } else {
      setExpandedDirs(new Set());
    }
  }

  // ── derived ────────────────────────────────────────────────────────────────
  const visibleItems = useMemo(() => {
    if (itemFilter === 'active') {
      return items.filter((i) => i.progress !== 'done');
    }
    if (itemFilter === 'done') {
      return [...items.filter((i) => i.progress === 'done')].sort(compareDoneByCompletedAtDesc);
    }
    return sortItemsForListDisplay(items);
  }, [items, itemFilter]);

  const upcomingRangeLabel = bootstrap
    ? `${bootstrap.settings.recentRangeValue}${bootstrap.settings.recentRangeUnit === 'day' ? '天' : '周'}`
    : '';

  // 头部标题：时间 · 目录路径（若选了三级 tag 则显示至三级）
  const activeViewLabel = useMemo(() => {
    const parts: string[] = [];
    if (timeFilter) parts.push(SMART_VIEW_LABELS[timeFilter]);
    if (bootstrap) {
      const dirIdForLabel =
        level3DirId ?? (dirFilter?.type === 'directory' ? dirFilter.id : null);
      if (dirIdForLabel) {
        const namePath = findDirNamePath(bootstrap.directories, dirIdForLabel);
        if (namePath) parts.push(...namePath);
      }
    }
    return parts.length > 0 ? parts.join(' · ') : '全部';
  }, [timeFilter, dirFilter, bootstrap, level3DirId]);

  const level2SelectedNode = useMemo(() => {
    if (!bootstrap || dirFilter?.type !== 'directory') return null;
    const n = findDirectoryNode(bootstrap.directories, dirFilter.id);
    return n && n.level === SIDEBAR_MAX_LEVEL ? n : null;
  }, [bootstrap, dirFilter]);

  useEffect(() => {
    if (!level3DirId || !level2SelectedNode) return;
    const ok = level2SelectedNode.children.some((c) => c.id === level3DirId);
    if (!ok) setLevel3DirId(null);
  }, [level2SelectedNode, level3DirId]);

  // 二级子列表变化后，若确认中的 id 已不存在（例如已删除），清除确认态，避免错位显示「确认」
  useEffect(() => {
    if (!confirmDeleteLevel3Id || !level2SelectedNode) return;
    const ok = level2SelectedNode.children.some((c) => c.id === confirmDeleteLevel3Id);
    if (!ok) setConfirmDeleteLevel3Id(null);
  }, [level2SelectedNode, confirmDeleteLevel3Id]);

  useEffect(() => {
    if (!confirmDeleteLevel3Id || modalItem) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmDeleteLevel3Id(null);
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [confirmDeleteLevel3Id, modalItem]);

  useEffect(() => {
    if (level3DirId) {
      setIsAddingDir(false);
      setNewDirName('');
    }
  }, [level3DirId]);

  // ── quick create handler ───────────────────────────────────────────────────
  async function handleQuickTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!quickTitle.trim()) return;
    try {
      setIsCreating(true); setErrorMessage(null);
      const targetDirId =
        level3DirId ?? (dirFilter?.type === 'directory' ? dirFilter.id : null);
      const newItem = await createItem({
        title: quickTitle.trim(),
        directoryId: targetDirId,
        expectedAt: new Date().toISOString(),
      });
      setItems((prev) => [newItem, ...prev]);
      void refreshBootstrap();
      setQuickTitle('');
      const draft = { title: newItem.title, notes: newItem.notes ?? '' };
      originalDraft.current = draft;
      setDetailDraft(draft);
      setModalItem(newItem);
    } catch (e) {
      setErrorMessage((e as Error).message || '创建失败');
    } finally { setIsCreating(false); }
  }

  // ── item detail handlers ───────────────────────────────────────────────────
  function handleSelectItem(item: ItemSummary, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cardCx = rect.left + rect.width / 2;
    const cardCy = rect.top + rect.height / 2;
    const modalW = window.innerWidth * 0.66;
    const modalH = modalW * 0.75;
    const modalLeft = (window.innerWidth - modalW) / 2;
    const modalTop = (window.innerHeight - modalH) / 2;
    setModalOrigin(`${cardCx - modalLeft}px ${cardCy - modalTop}px`);
    const draft = { title: item.title, notes: item.notes ?? '' };
    originalDraft.current = draft;
    setDetailDraft(draft);
    setModalItem(item);
  }

  function isDirty() {
    return (
      detailDraft.title !== originalDraft.current.title ||
      detailDraft.notes !== originalDraft.current.notes
    );
  }

  function forceCloseModal() {
    if (closeWarningTimer.current) { clearTimeout(closeWarningTimer.current); closeWarningTimer.current = null; }
    setCloseWarningActive(false);
    setModalItem(null);
  }

  function tryCloseModal() {
    if (!isDirty()) { forceCloseModal(); return; }
    if (closeWarningTimer.current !== null) { forceCloseModal(); return; }
    setCloseWarningActive(true);
    closeWarningTimer.current = setTimeout(() => {
      setCloseWarningActive(false);
      closeWarningTimer.current = null;
    }, 2000);
  }

  tryCloseModalRef.current = tryCloseModal;

  async function handleSaveDetail() {
    if (!modalItem) return;
    try {
      setIsDetailSaving(true); setErrorMessage(null);
      await patchItem(modalItem.id, {
        title: detailDraft.title,
        notes: detailDraft.notes.trim() === '' ? null : detailDraft.notes,
      });
      setModalItem(null);
      await Promise.all([loadItems(timeFilter, effectiveDirFilter), refreshBootstrap()]);
    } catch (e) {
      setErrorMessage((e as Error).message || '保存失败');
    } finally { setIsDetailSaving(false); }
  }

  async function handleComplete(itemId: string) {
    if (itemFilter !== 'all') {
      try {
        setErrorMessage(null);
        if (modalItem?.id === itemId) setModalItem(null);
        await completeItem(itemId);
        await Promise.all([loadItems(timeFilter, effectiveDirFilter), refreshBootstrap()]);
      } catch (e) {
        setErrorMessage((e as Error).message || '完成操作失败');
      }
      return;
    }

    const rowEl = document.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement | null;
    const firstTop = rowEl?.getBoundingClientRect().top;
    const useFlip = rowEl !== null && firstTop !== undefined;

    if (useFlip) {
      completeFlipSyncRef.current = { apiDone: false, animDone: false };
    }

    setItems((prev) => {
      const updated = prev.map((i) =>
        i.id === itemId
          ? { ...i, progress: 'done' as const, completedAt: new Date().toISOString() }
          : i
      );
      return sortItemsForListDisplay(updated);
    });

    if (useFlip) {
      completeFlipSnapshotRef.current = { itemId, firstTop };
      setCompleteFlipTick((t) => t + 1);
    }

    try {
      setErrorMessage(null);
      if (modalItem?.id === itemId) setModalItem(null);
      await completeItem(itemId);
      await refreshBootstrap();
      if (useFlip) {
        completeFlipSyncRef.current.apiDone = true;
        tryCompleteFlipSync();
      } else {
        await loadItems(timeFilter, effectiveDirFilter);
      }
    } catch (e) {
      setErrorMessage((e as Error).message || '完成操作失败');
      completeFlipSyncRef.current = { apiDone: false, animDone: false };
      await loadItems(timeFilter, effectiveDirFilter);
      completeFlipSnapshotRef.current = null;
    }
  }

  async function handleAssignDirectoryFromPicker(itemId: string, directoryId: string | null) {
    try {
      setErrorMessage(null);
      await patchItem(itemId, { directoryId });
      setDirPicker(null);
      await Promise.all([loadItems(timeFilter, effectiveDirFilter), refreshBootstrap()]);
    } catch (e) {
      setErrorMessage((e as Error).message || '更新目录失败');
    }
  }

  // ── directory create handlers ──────────────────────────────────────────────
  function openAddDir() {
    setIsAddingDir(true);
    setNewDirName('');
    setTimeout(() => addDirInputRef.current?.focus(), 0);
  }

  function cancelAddDir() {
    setIsAddingDir(false);
    setNewDirName('');
  }

  async function handleConfirmAddDir() {
    if (!newDirName.trim()) return;
    const parentId =
      level3DirId ?? (dirFilter?.type === 'directory' ? dirFilter.id : null);
    const color = parentId === null ? randomDirColor() : null;
    try {
      setIsCreatingDir(true);
      await createDirectory({ name: newDirName.trim(), parentId, color });
      setIsAddingDir(false);
      setNewDirName('');
      await refreshBootstrap();
    } catch (e) {
      setErrorMessage((e as Error).message || '创建目录失败');
    } finally {
      setIsCreatingDir(false);
    }
  }

  // ── directory delete ──────────────────────────────────────────────────────
  function isInSubtree(targetId: string, rootId: string, nodes: DirectoryNode[]): boolean {
    for (const node of nodes) {
      if (node.id === rootId) return true;
      if (isInSubtree(targetId, rootId, node.children)) return true;
    }
    return false;
  }

  async function handleDeleteLevel3Dir(dirId: string) {
    try {
      setErrorMessage(null);
      const wasSelectedL3 = level3DirId === dirId;
      await deleteDirectory(dirId, 'move_to_parent');
      if (wasSelectedL3) setLevel3DirId(null);
      await refreshBootstrap();
      const nextDf: DirFilter | null = wasSelectedL3
        ? dirFilter
        : level3DirId && level3DirId !== dirId
          ? { type: 'directory', id: level3DirId }
          : dirFilter;
      await loadItems(timeFilter, nextDf);
    } catch (e) {
      setErrorMessage((e as Error).message || '删除目录失败');
    } finally {
      setConfirmDeleteLevel3Id(null);
      level3DeleteConfirmReadyAtRef.current = 0;
    }
  }

  function handleLevel3DeleteControl(e: React.SyntheticEvent, nodeId: string) {
    e.stopPropagation();
    if (confirmDeleteLevel3Id !== nodeId) {
      setConfirmDeleteLevel3Id(nodeId);
      level3DeleteConfirmReadyAtRef.current = Date.now() + 420;
      return;
    }
    if (Date.now() < level3DeleteConfirmReadyAtRef.current) return;
    void handleDeleteLevel3Dir(nodeId);
  }

  async function handleDeleteDir(dirId: string) {
    try {
      setErrorMessage(null);
      await deleteDirectory(dirId, 'move_to_inbox');
      setConfirmDeleteDirId(null);
      if (
        dirFilter?.type === 'directory' &&
        (dirFilter.id === dirId || isInSubtree(dirFilter.id, dirId, bootstrap?.directories ?? []))
      ) {
        setDirFilter(null);
      }
      await refreshBootstrap();
      if (level3DirId) {
        const path = findPathToDir(bootstrap?.directories ?? [], level3DirId);
        if (path?.includes(dirId)) setLevel3DirId(null);
      }
    } catch (e) {
      setErrorMessage((e as Error).message || '删除目录失败');
    }
  }

  function handleLevel3TagClick(nodeId: string) {
    setLevel3DirId((prev) => (prev === nodeId ? null : nodeId));
  }

  // ── directory nodes（侧栏仅展示 level ≤ 2；三级在主页 tag）──────────────────
  function renderDirNodes(nodes: DirectoryNode[], depth: number): React.ReactNode {
    return nodes.map((node) => {
      const isActive = dirFilter?.type === 'directory' && dirFilter.id === node.id;
      const isExpanded = expandedDirs.has(node.id);
      const showNestedInSidebar = node.level < SIDEBAR_MAX_LEVEL;
      const hasChildrenInSidebar = showNestedInSidebar && node.children.length > 0;
      const isConfirming = confirmDeleteDirId === node.id;

      return (
        <li key={node.id}>
          <button
            type="button"
            className={`nav-list__item${depth > 0 ? ' nav-list__item--child' : ''}${isActive ? ' is-active' : ''} nav-list__item--deletable${isConfirming ? ' is-confirming' : ''}`}
            onClick={() => handleDirFilterClick({ type: 'directory', id: node.id })}
            onMouseLeave={() => setConfirmDeleteDirId(null)}
          >
            <span className="dir-root__label">
              {node.color && <span className="category-dot" style={{ background: node.color }} />}
              <span>
                {node.name}
                {node.activeCount > 0 && <span className="dir-inline-count">({node.activeCount})</span>}
              </span>
            </span>
            <span
              role="button"
              tabIndex={0}
              className={`dir-delete-btn${isConfirming ? ' dir-delete-btn--confirm' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                isConfirming ? void handleDeleteDir(node.id) : setConfirmDeleteDirId(node.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  isConfirming ? void handleDeleteDir(node.id) : setConfirmDeleteDirId(node.id);
                }
              }}
            >
              {isConfirming ? '确认' : (
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 4h10M6 4V3h4v1M5 4l.5 8h5L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
          </button>
          {hasChildrenInSidebar && (
            <div className={`dir-children-wrapper${isExpanded ? ' is-expanded' : ''}`}>
              <ul className="dir-children">
                {renderDirNodes(node.children, depth + 1)}
              </ul>
            </div>
          )}
        </li>
      );
    });
  }

  // ── form body ──────────────────────────────────────────────────────────────
  function renderFormBody(
    draft: { title: string; notes: string },
    onTitle: (v: string) => void,
    onNotes: (v: string) => void,
    onConfirm: () => void,
    saving: boolean,
    notesRef?: React.RefObject<HTMLTextAreaElement | null>,
  ) {
    return (
      <>
        <div className="create-form__title-row">
          <input
            className="create-form__title-input"
            type="text"
            value={draft.title}
            autoFocus
            onChange={(e) => onTitle(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.altKey) && e.key === 'Enter') { onConfirm(); return; }
              if (e.key === 'Enter') { e.preventDefault(); notesRef?.current?.focus(); }
            }}
          />
          <button
            type="button"
            className="create-form__confirm"
            disabled={saving || !draft.title.trim()}
            onClick={onConfirm}
          >
            {saving ? '保存中...' : '保存'}
            {!saving && <kbd className="create-form__kbd">{IS_MAC ? '⌘↵' : 'Alt↵'}</kbd>}
          </button>
        </div>
        <textarea
          ref={notesRef}
          className="create-form__textarea"
          value={draft.notes}
          placeholder="plan..."
          onChange={(e) => onNotes(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.altKey) && e.key === 'Enter') onConfirm(); }}
        />
      </>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>My Pag</h1>
        </div>

        {/* 时间分区：横向 tab，单选可反选，null = 不限时间 */}
        <div className="time-tabs">
          {VIEW_ORDER.map((view) => (
            <button
              key={view}
              type="button"
              className={`time-tabs__tab${timeFilter === view ? ' is-active' : ''}`}
              onClick={() => handleTimeFilterClick(view)}
            >
              {SMART_VIEW_LABELS[view]}
            </button>
          ))}
        </div>

        {/* 目录分区：单选可反选，null = 不限目录 */}
        <section className="panel">
          <ul className="nav-list">
            <li>
              <button
                type="button"
                className={`nav-list__item${dirFilter === null ? ' is-active' : ''}`}
                onClick={() => {
                  setDirFilter(null);
                  setExpandedDirs(new Set());
                  setLevel3DirId(null);
                }}
              >
                <span>全部</span>
              </button>
            </li>
            {bootstrap ? renderDirNodes(bootstrap.directories, 0) : null}
          </ul>

        </section>
      </aside>

      <main className="content">
        <header className="content__header">
          <div className="content__header-left">
            <div className="content__header-title-row">
              <h2>{activeViewLabel}</h2>
              {/* 三级为最深目录：选中三级时不显示「添加目录」 */}
              {!level3DirId && (isAddingDir ? (
                <div className="dir-add-inline">
                  <input
                    ref={addDirInputRef}
                    className="dir-add-inline__input"
                    type="text"
                    placeholder="目录名称..."
                    value={newDirName}
                    disabled={isCreatingDir}
                    onChange={(e) => setNewDirName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleConfirmAddDir();
                      if (e.key === 'Escape') cancelAddDir();
                    }}
                  />
                  <button
                    type="button"
                    className="dir-add-inline__confirm"
                    disabled={isCreatingDir || !newDirName.trim()}
                    onClick={() => void handleConfirmAddDir()}
                  >
                    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button type="button" className="dir-add-inline__cancel" disabled={isCreatingDir} onClick={cancelAddDir}>
                    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <button type="button" className="dir-add-icon-btn" onClick={openAddDir} aria-label="添加目录">
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 6a2 2 0 012-2h3.586a1 1 0 01.707.293L9.707 5.7A1 1 0 0010.414 6H16a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M10 9v4M8 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
          <div className="filter-dropdown" ref={dropdownRef}>
            <button type="button" className="filter-dropdown__trigger" onClick={toggleFilterMenu}>
              {itemFilter === 'all' ? '全部' : itemFilter === 'active' ? '未完成' : '已完成'}
              <span className="filter-dropdown__arrow">▾</span>
            </button>
            {menuVisible && (
              <ul
                className={`filter-dropdown__menu${menuClosing ? ' is-closing' : ' is-open'}`}
                onAnimationEnd={handleFilterMenuAnimationEnd}
              >
                <li><button type="button" className={itemFilter === 'all' ? 'is-active' : ''} onClick={() => { setItemFilter('all'); closeFilterMenu(); }}>全部</button></li>
                <li><button type="button" className={itemFilter === 'active' ? 'is-active' : ''} onClick={() => { setItemFilter('active'); closeFilterMenu(); }}>未完成</button></li>
                <li><button type="button" className={itemFilter === 'done' ? 'is-active' : ''} onClick={() => { setItemFilter('done'); closeFilterMenu(); }}>已完成</button></li>
              </ul>
            )}
          </div>
        </header>

        {isLoading ? <p>正在加载数据...</p> : null}
        {errorMessage ? <p className="error-message">{errorMessage}</p> : null}

        {level2SelectedNode && level2SelectedNode.children.length > 0 ? (
          <div className="dir-tag-row" role="toolbar" aria-label="三级目录">
            {level2SelectedNode.children.map((node) => {
              const isTagActive = level3DirId === node.id;
              const isConfirmingL3 = confirmDeleteLevel3Id === node.id;
              return (
                <div
                  key={node.id}
                  className={`dir-tag-wrap dir-tag-wrap--deletable${isTagActive ? ' is-active' : ''}${isConfirmingL3 ? ' is-confirming' : ''}`}
                >
                  <button
                    type="button"
                    className="dir-tag__main"
                    aria-pressed={isTagActive}
                    onClick={() => handleLevel3TagClick(node.id)}
                  >
                    {node.color ? (
                      <span className="category-dot" style={{ background: node.color }} />
                    ) : null}
                    <span>{node.name}</span>
                    {node.activeCount > 0 ? (
                      <span className="dir-inline-count">({node.activeCount})</span>
                    ) : null}
                  </button>
                  <span
                    role="button"
                    tabIndex={0}
                    className={`dir-delete-btn${isConfirmingL3 ? ' dir-delete-btn--confirm' : ''}`}
                    onClick={(e) => handleLevel3DeleteControl(e, node.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        handleLevel3DeleteControl(e, node.id);
                      }
                    }}
                  >
                    {isConfirmingL3 ? '确认' : (
                      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 4h10M6 4V3h4v1M5 4l.5 8h5L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="quick-create-row">
          <input
            className="header-quick-input"
            aria-label="新建计划标题"
            placeholder={isCreating ? '创建中...' : 'new plan...'}
            type="text"
            value={quickTitle}
            disabled={isCreating}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => void handleQuickTitleKeyDown(e)}
          />
        </div>

        <section className="list">
          {visibleItems.map((item) => {
            const accentColor =
              bootstrap && item.directoryId
                ? findDirectoryAccentColor(bootstrap.directories, item.directoryId)
                : null;
            return (
            <div
              key={item.id}
              data-item-id={item.id}
              className={`item-morph${item.progress === 'done' ? ' item-morph--done' : ''}`}
              onClick={(e) => handleSelectItem(item, e)}
            >
              <button
                type="button"
                className={`item-morph__accent${!accentColor ? ' item-morph__accent--placeholder' : ''}`}
                style={accentColor ? { backgroundColor: accentColor } : undefined}
                aria-label="分配目录"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!bootstrap) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  setDirPicker({
                    itemId: item.id,
                    anchor: {
                      left: r.left,
                      top: r.top,
                      width: r.width,
                      height: r.height,
                    },
                  });
                }}
              />
              <div className="item-morph__card-face">
                <div className="card__body">
                  <div className="card__title-row">
                    <button
                      type="button"
                      className={`card__checkbox${item.progress === 'done' ? ' card__checkbox--done' : ''}`}
                      aria-label={item.progress === 'done' ? '已完成' : '标记完成'}
                      onClick={(e) => { e.stopPropagation(); if (item.progress !== 'done') void handleComplete(item.id); }}
                    >
                      {item.progress === 'done' && (
                        <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    <h3 className="card__title">{item.title}</h3>
                  </div>
                  {item.notes && <p className="card__excerpt">{item.notes}</p>}
                </div>
              </div>
            </div>
            );
          })}
        </section>
      </main>

      {/* Modal */}
      {dirPicker && bootstrap ? (
        <DirectoryCascadePicker
          key={dirPicker.itemId}
          roots={bootstrap.directories}
          anchor={dirPicker.anchor}
          initialDirectoryId={items.find((i) => i.id === dirPicker.itemId)?.directoryId ?? null}
          onClose={() => setDirPicker(null)}
          onConfirm={(directoryId) => void handleAssignDirectoryFromPicker(dirPicker.itemId, directoryId)}
        />
      ) : null}

      {modalItem && (
        <div className="modal-overlay" onClick={tryCloseModal}>
          <div className="modal-dialog" style={{ transformOrigin: modalOrigin }} onClick={(e) => e.stopPropagation()}>
            {renderFormBody(
              detailDraft,
              (v) => setDetailDraft((p) => ({ ...p, title: v })),
              (v) => setDetailDraft((p) => ({ ...p, notes: v })),
              () => void handleSaveDetail(),
              isDetailSaving,
              modalNotesRef,
            )}
          </div>
          {closeWarningActive && (
            <div className="close-toast">
              <span>再按一次以放弃修改</span>
              <div className="close-toast__bar" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
