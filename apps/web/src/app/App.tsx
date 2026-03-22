import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  completeItem,
  createItem,
  getBootstrap,
  getViewItems,
  patchItem,
} from '../services/api';
import {
  BootstrapData,
  DirectoryNode,
  ITEM_PROGRESS_LABELS,
  ItemProgress,
  ItemSummary,
  SMART_VIEW_LABELS,
  SmartViewKey,
} from '../types/item';

type CreateFormState = 'hidden' | 'visible' | 'closing';
type MorphPhase = 'card' | 'opening' | 'open' | 'closing';

const VIEW_ORDER: SmartViewKey[] = ['inbox', 'today', 'upcoming', 'overdue'];
const IS_MAC = navigator.platform.startsWith('Mac');

function formatExpectedAt(value: string | null) {
  if (!value) return '未设置时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderDirectoryNodes(nodes: DirectoryNode[]) {
  return nodes.map((node) => (
    <div key={node.id} className="tree__group">
      <div className="tree__node">{node.name}</div>
      {node.children.length > 0 ? (
        <div className="tree__children">{renderDirectoryNodes(node.children)}</div>
      ) : null}
    </div>
  ));
}

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [activeView, setActiveView] = useState<SmartViewKey>('inbox');
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [itemFilter, setItemFilter] = useState<'all' | 'active' | 'done'>('all');
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── create form ────────────────────────────────────────────────────────────
  const [formState, setFormState] = useState<CreateFormState>('hidden');
  const [isCreating, setIsCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState({ title: '', notes: '' });
  const pendingCreatedId = useRef<string | null>(null);

  // ── item morph ─────────────────────────────────────────────────────────────
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [morphPhase, setMorphPhase] = useState<MorphPhase>('card');
  const [isDetailSaving, setIsDetailSaving] = useState(false);
  const [detailDraft, setDetailDraft] = useState({ title: '', notes: '' });
  const morphRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const detailFaceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const savedCardH = useRef(0);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  const loadViewItems = useCallback(async (view: SmartViewKey) => {
    setItems(await getViewItems(view));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setIsLoading(true); setErrorMessage(null);
        const data = await getBootstrap();
        if (cancelled) return;
        setBootstrap(data);
        await loadViewItems('inbox');
      } catch (e) {
        if (!cancelled) setErrorMessage((e as Error).message || '初始化失败');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void init();
    return () => { cancelled = true; };
  }, [loadViewItems]);

  useEffect(() => {
    if (!bootstrap) return;
    let cancelled = false;
    async function refresh() {
      try { setErrorMessage(null); await loadViewItems(activeView); }
      catch (e) { if (!cancelled) setErrorMessage((e as Error).message || '加载失败'); }
    }
    void refresh();
    return () => { cancelled = true; };
  }, [activeView, bootstrap, loadViewItems]);

  // Reset both forms on view switch
  useEffect(() => {
    if (selectedItemId) {
      const el = morphRefs.current.get(selectedItemId);
      if (el) { el.style.height = ''; el.style.transition = ''; }
    }
    setFormState('hidden'); setCreateDraft({ title: '', notes: '' }); pendingCreatedId.current = null;
    setMorphPhase('card'); setSelectedItemId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  // ── morph animation (height) ───────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!selectedItemId) return;
    const el = morphRefs.current.get(selectedItemId);
    if (!el) return;

    if (morphPhase === 'opening') {
      // Phase 1: card face fades out (CSS, 160ms)
      // Phase 2 (after 160ms): animate height card→detail
      const detailFace = detailFaceRefs.current.get(selectedItemId);
      if (!detailFace) return;
      const detailH = detailFace.offsetHeight;
      el.style.height = `${savedCardH.current}px`;
      el.style.overflow = 'hidden';
      const t = setTimeout(() => {
        el.style.transition = 'height 260ms cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.height = `${detailH}px`;
      }, 160);
      return () => clearTimeout(t);
    }

    if (morphPhase === 'closing') {
      // Phase 1: detail face fades out (CSS, 160ms)
      // Phase 2 (after 160ms): animate height detail→card
      const t = setTimeout(() => {
        el.style.transition = 'height 260ms cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.height = `${savedCardH.current}px`;
      }, 160);
      return () => clearTimeout(t);
    }
  }, [morphPhase, selectedItemId]);

  // ── derived ────────────────────────────────────────────────────────────────
  const visibleItems = useMemo(() => {
    if (itemFilter === 'active') return items.filter((i) => i.progress !== 'done');
    if (itemFilter === 'done') return items.filter((i) => i.progress === 'done');
    return items;
  }, [items, itemFilter]);

  const upcomingRangeLabel = bootstrap
    ? `${bootstrap.settings.recentRangeValue}${bootstrap.settings.recentRangeUnit === 'day' ? '天' : '周'}`
    : '可配置范围';

  // ── create form handlers ───────────────────────────────────────────────────
  function handleQuickTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!createDraft.title.trim()) return;
    if (selectedItemId) {
      const el = morphRefs.current.get(selectedItemId);
      if (el) { el.style.height = ''; el.style.transition = ''; }
      setMorphPhase('card'); setSelectedItemId(null);
    }
    setFormState('visible');
  }

  async function handleCreateConfirm() {
    const title = createDraft.title.trim();
    if (!title && !pendingCreatedId.current) return;
    try {
      setIsCreating(true); setErrorMessage(null);
      let itemId = pendingCreatedId.current;
      if (!itemId) {
        const created = await createItem({ title });
        itemId = created.id;
        pendingCreatedId.current = created.id;
      }
      if (createDraft.notes.trim()) await patchItem(itemId, { notes: createDraft.notes });
      pendingCreatedId.current = null;
      setCreateDraft({ title: '', notes: '' });
      setFormState('closing');
      void loadViewItems(activeView);
    } catch (e) {
      setErrorMessage((e as Error).message || '创建失败');
    } finally { setIsCreating(false); }
  }

  function handleCreateCancel() {
    if (pendingCreatedId.current) { pendingCreatedId.current = null; void loadViewItems(activeView); }
    setCreateDraft({ title: '', notes: '' });
    setFormState('closing');
  }

  function handleCreateFormAnimationEnd(e: React.AnimationEvent) {
    if (e.target !== e.currentTarget) return;
    if (formState === 'closing') setFormState('hidden');
  }

  // ── item detail handlers ───────────────────────────────────────────────────
  function handleSelectItem(item: ItemSummary) {
    if (formState !== 'hidden') {
      setFormState('hidden'); setCreateDraft({ title: '', notes: '' }); pendingCreatedId.current = null;
    }

    if (selectedItemId === item.id) {
      setMorphPhase('closing');
      return;
    }

    // Instant-close previous if any
    if (selectedItemId) {
      const prev = morphRefs.current.get(selectedItemId);
      if (prev) { prev.style.height = ''; prev.style.transition = ''; }
    }

    const el = morphRefs.current.get(item.id);
    if (el) savedCardH.current = el.offsetHeight;

    setSelectedItemId(item.id);
    setDetailDraft({ title: item.title, notes: item.notes ?? '' });
    setMorphPhase('opening');
  }

  async function handleSaveDetail() {
    if (!selectedItemId) return;
    try {
      setIsDetailSaving(true); setErrorMessage(null);
      await patchItem(selectedItemId, {
        title: detailDraft.title,
        notes: detailDraft.notes.trim() === '' ? null : detailDraft.notes,
      });
      setMorphPhase('closing');
      void loadViewItems(activeView);
    } catch (e) {
      setErrorMessage((e as Error).message || '保存失败');
    } finally { setIsDetailSaving(false); }
  }

  function handleDiscardDetail() { setMorphPhase('closing'); }

  function handleContainerTransitionEnd(e: React.TransitionEvent<HTMLDivElement>, itemId: string) {
    if (e.propertyName !== 'height' || e.target !== e.currentTarget) return;
    if (selectedItemId !== itemId) return;
    const el = morphRefs.current.get(itemId);
    if (!el) return;

    if (morphPhase === 'opening') {
      el.style.transition = '';
      // keep explicit height so absolute detail-face is fully visible
      setMorphPhase('open');
    } else if (morphPhase === 'closing') {
      el.style.height = ''; el.style.overflow = ''; el.style.transition = '';
      setMorphPhase('card'); setSelectedItemId(null);
    }
  }

  async function handleComplete(itemId: string) {
    try {
      setErrorMessage(null);
      await completeItem(itemId);
      if (selectedItemId === itemId) {
        const el = morphRefs.current.get(itemId);
        if (el) { el.style.height = ''; el.style.transition = ''; }
        setMorphPhase('card'); setSelectedItemId(null);
      }
      await loadViewItems(activeView);
    } catch (e) { setErrorMessage((e as Error).message || '完成操作失败'); }
  }

  // ── form body (shared between create + detail) ─────────────────────────────
  function renderFormBody(
    draft: { title: string; notes: string },
    onTitle: (v: string) => void,
    onNotes: (v: string) => void,
    onConfirm: () => void,
    onCancel: () => void,
    saving: boolean,
    label: string,
    autoFocus: boolean,
    progress?: ItemProgress,
  ) {
    const progressWidth: Record<ItemProgress, string> = {
      todo: '0%', doing: '55%', paused: '30%', done: '100%',
    };

    return (
      <>
        <input
          className="create-form__title-input"
          type="text"
          value={draft.title}
          autoFocus={autoFocus}
          onChange={(e) => onTitle(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.altKey) && e.key === 'Enter') onConfirm(); }}
        />
        <label className="create-form__label">
          <span>备注</span>
          <textarea
            className="create-form__textarea"
            rows={4}
            value={draft.notes}
            placeholder="添加备注..."
            onChange={(e) => onNotes(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.altKey) && e.key === 'Enter') onConfirm(); }}
          />
        </label>
        <div className="create-form__actions">
          {progress !== undefined && (
            <div className="create-form__progress-track">
              <div
                className={`create-form__progress-fill create-form__progress-fill--${progress}`}
                style={{ width: progressWidth[progress] }}
              />
            </div>
          )}
          <div className="create-form__actions-right">
            <button
              type="button"
              className="create-form__confirm"
              disabled={saving || !draft.title.trim()}
              onClick={onConfirm}
            >
              {saving ? `${label}中...` : label}
              {!saving && <kbd className="create-form__kbd">{IS_MAC ? '⌘↵' : 'Alt↵'}</kbd>}
            </button>
            <button type="button" className="create-form__cancel" disabled={saving} onClick={onCancel}>
              取消
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__eyebrow">Personal Item Manager</span>
          <h1>My Pag</h1>
        </div>
        <section className="panel">
          <div className="panel__title">智能视图</div>
          <ul className="nav-list">
            {VIEW_ORDER.map((view) => (
              <li key={view}>
                <button
                  type="button"
                  className={`nav-list__item${view === activeView ? ' is-active' : ''}`}
                  onClick={() => setActiveView(view)}
                >
                  <span>{SMART_VIEW_LABELS[view]}</span>
                  {view === 'upcoming' ? <small>{upcomingRangeLabel}</small> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <div className="panel__title">目录</div>
          <div className="tree">{bootstrap ? renderDirectoryNodes(bootstrap.directories) : null}</div>
        </section>
      </aside>

      <main className="content">
        <header className="content__header">
          <div className="content__header-left">
            <span className="section-tag">当前视图</span>
            <div className="content__header-title-row">
              <h2>{SMART_VIEW_LABELS[activeView]}</h2>
              {formState === 'hidden' && (
                <input
                  className="header-quick-input"
                  aria-label="新建计划标题"
                  placeholder="new plan..."
                  type="text"
                  value={createDraft.title}
                  onChange={(e) => setCreateDraft((p) => ({ ...p, title: e.target.value }))}
                  onKeyDown={handleQuickTitleKeyDown}
                />
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

        {/* Create form */}
        {formState !== 'hidden' && (
          <div
            className={`create-form${formState === 'closing' ? ' is-closing' : ''}`}
            onAnimationEnd={handleCreateFormAnimationEnd}
          >
            {renderFormBody(
              createDraft,
              (v) => setCreateDraft((p) => ({ ...p, title: v })),
              (v) => setCreateDraft((p) => ({ ...p, notes: v })),
              () => void handleCreateConfirm(),
              handleCreateCancel,
              isCreating, '创建', true,
            )}
          </div>
        )}

        <section className="list">
          {visibleItems.map((item) => {
            const isSelected = selectedItemId === item.id;
            const phase = isSelected ? morphPhase : 'card';
            return (
              <div
                key={item.id}
                ref={(el) => { if (el) morphRefs.current.set(item.id, el); else morphRefs.current.delete(item.id); }}
                className={`item-morph item-morph--${phase}${item.progress === 'done' ? ' item-morph--done' : ''}`}
                onTransitionEnd={(e) => handleContainerTransitionEnd(e, item.id)}
                onClick={() => handleSelectItem(item)}
              >
                {/* Card face — always in DOM, position normal flow */}
                <div className="item-morph__card-face">
                  <div className="card__meta">
                    <span>{ITEM_PROGRESS_LABELS[item.progress]}</span>
                    <span>{formatExpectedAt(item.expectedAt)}</span>
                  </div>
                  <h3>{item.title}</h3>
                  {item.progress !== 'done' && (
                    <button
                      type="button"
                      className="card__complete"
                      onClick={(e) => { e.stopPropagation(); void handleComplete(item.id); }}
                    >
                      完成
                    </button>
                  )}
                </div>

                {/* Detail face — position absolute, overlays card face */}
                {isSelected && phase !== 'card' && (
                  <div
                    ref={(el) => { if (el) detailFaceRefs.current.set(item.id, el); else detailFaceRefs.current.delete(item.id); }}
                    className="item-morph__detail-face"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderFormBody(
                      detailDraft,
                      (v) => setDetailDraft((p) => ({ ...p, title: v })),
                      (v) => setDetailDraft((p) => ({ ...p, notes: v })),
                      () => void handleSaveDetail(),
                      handleDiscardDetail,
                      isDetailSaving, '保存', true,
                      item.progress,
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
