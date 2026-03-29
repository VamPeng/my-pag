import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  BootstrapData,
  DirectoryNode,
  DirFilter,
  ItemSummary,
  SMART_VIEW_LABELS,
  SmartViewKey,
} from '../types/item';

const VIEW_ORDER: SmartViewKey[] = ['today', 'upcoming', 'overdue'];
const IS_MAC = navigator.platform.startsWith('Mac');

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

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bootstrapReady = useRef(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // ── data ───────────────────────────────────────────────────────────────────
  const loadItems = useCallback(async (tf: SmartViewKey | null, df: DirFilter | null) => {
    setItems(await getItems({ view: tf, dirFilter: df }));
  }, []);

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
        bootstrapReady.current = true;
        await loadItems('today', null);
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
    if (!bootstrapReady.current) return;
    let cancelled = false;
    async function refresh() {
      try { setErrorMessage(null); await loadItems(timeFilter, dirFilter); }
      catch (e) { if (!cancelled) setErrorMessage((e as Error).message || '加载失败'); }
    }
    void refresh();
    return () => { cancelled = true; };
  }, [timeFilter, dirFilter, loadItems]);

  // 切换筛选条件时重置快速创建和 modal
  useEffect(() => {
    setQuickTitle('');
    setModalItem(null);
    setCloseWarningActive(false);
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
  }

  function handleDirFilterClick(df: DirFilter) {
    if (dirFilterEquals(dirFilter, df)) return;

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
    if (itemFilter === 'active') return items.filter((i) => i.progress !== 'done');
    if (itemFilter === 'done') return items.filter((i) => i.progress === 'done');
    return items;
  }, [items, itemFilter]);

  const upcomingRangeLabel = bootstrap
    ? `${bootstrap.settings.recentRangeValue}${bootstrap.settings.recentRangeUnit === 'day' ? '天' : '周'}`
    : '';

  // 头部标题：时间 · 根目录 · 子目录 · ... · 当前目录
  const activeViewLabel = useMemo(() => {
    const parts: string[] = [];
    if (timeFilter) parts.push(SMART_VIEW_LABELS[timeFilter]);
    if (dirFilter) {
      if (dirFilter.type === 'unclassified') {
        parts.push('全部');
      } else if (bootstrap) {
        const namePath = findDirNamePath(bootstrap.directories, dirFilter.id);
        if (namePath) parts.push(...namePath);
      }
    }
    return parts.length > 0 ? parts.join(' · ') : '全部';
  }, [timeFilter, dirFilter, bootstrap]);

  // ── quick create handler ───────────────────────────────────────────────────
  async function handleQuickTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!quickTitle.trim()) return;
    try {
      setIsCreating(true); setErrorMessage(null);
      const newItem = await createItem({
        title: quickTitle.trim(),
        directoryId: dirFilter?.type === 'directory' ? dirFilter.id : null,
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
      await Promise.all([loadItems(timeFilter, dirFilter), refreshBootstrap()]);
    } catch (e) {
      setErrorMessage((e as Error).message || '保存失败');
    } finally { setIsDetailSaving(false); }
  }

  async function handleComplete(itemId: string) {
    try {
      setErrorMessage(null);
      if (modalItem?.id === itemId) setModalItem(null);
      await completeItem(itemId);
      await Promise.all([loadItems(timeFilter, dirFilter), refreshBootstrap()]);
    } catch (e) { setErrorMessage((e as Error).message || '完成操作失败'); }
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
    const parentId = dirFilter?.type === 'directory' ? dirFilter.id : null;
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

  async function handleDeleteDir(dirId: string) {
    try {
      setErrorMessage(null);
      await deleteDirectory(dirId);
      setConfirmDeleteDirId(null);
      if (
        dirFilter?.type === 'directory' &&
        (dirFilter.id === dirId || isInSubtree(dirFilter.id, dirId, bootstrap?.directories ?? []))
      ) {
        setDirFilter(null);
      }
      await refreshBootstrap();
    } catch (e) {
      setErrorMessage((e as Error).message || '删除目录失败');
    }
  }

  // ── directory nodes ────────────────────────────────────────────────────────
  function renderDirNodes(nodes: DirectoryNode[], depth: number): React.ReactNode {
    return nodes.map((node) => {
      const isActive = dirFilter?.type === 'directory' && dirFilter.id === node.id;
      const isExpanded = expandedDirs.has(node.id);
      const hasChildren = node.children.length > 0;
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
          {hasChildren && (
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
                className={`nav-list__item${dirFilter?.type === 'unclassified' ? ' is-active' : ''}`}
                onClick={() => handleDirFilterClick({ type: 'unclassified' })}
              >
                <span>
                  全部
                  {(bootstrap?.unclassifiedCount ?? 0) > 0 && (
                    <span className="dir-inline-count">({bootstrap?.unclassifiedCount})</span>
                  )}
                </span>
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
              {isAddingDir ? (
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
              )}
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
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className={`item-morph${item.progress === 'done' ? ' item-morph--done' : ''}`}
              onClick={(e) => handleSelectItem(item, e)}
            >
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
          ))}
        </section>
      </main>

      {/* Modal */}
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
