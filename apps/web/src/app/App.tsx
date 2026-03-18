import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

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

const VIEW_ORDER: SmartViewKey[] = ['inbox', 'today', 'upcoming', 'overdue'];

function formatExpectedAt(value: string | null) {
  if (!value) {
    return '未设置时间';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

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
      {node.children.length > 0 ? <div className="tree__children">{renderDirectoryNodes(node.children)}</div> : null}
    </div>
  ));
}

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [activeView, setActiveView] = useState<SmartViewKey>('inbox');
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailDraft, setDetailDraft] = useState<{
    title: string;
    notes: string;
    progress: ItemProgress;
  }>({
    title: '',
    notes: '',
    progress: 'todo',
  });

  const loadViewItems = useCallback(async (view: SmartViewKey) => {
    const data = await getViewItems(view);
    setItems(data);
    setSelectedItemId((previous) => {
      if (previous && data.some((item) => item.id === previous)) {
        return previous;
      }
      return data.length > 0 ? data[0].id : null;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const bootstrapData = await getBootstrap();
        if (cancelled) {
          return;
        }
        setBootstrap(bootstrapData);
        await loadViewItems('inbox');
      } catch (error) {
        if (!cancelled) {
          setErrorMessage((error as Error).message || '初始化失败');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [loadViewItems]);

  useEffect(() => {
    if (!bootstrap) {
      return;
    }

    let cancelled = false;

    async function refreshActiveView() {
      try {
        setErrorMessage(null);
        await loadViewItems(activeView);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage((error as Error).message || '加载视图失败');
        }
      }
    }

    void refreshActiveView();

    return () => {
      cancelled = true;
    };
  }, [activeView, bootstrap, loadViewItems]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  useEffect(() => {
    if (!selectedItem) {
      setDetailDraft({ title: '', notes: '', progress: 'todo' });
      return;
    }

    setDetailDraft({
      title: selectedItem.title,
      notes: selectedItem.notes ?? '',
      progress: selectedItem.progress,
    });
  }, [selectedItem]);

  const visibleItems = useMemo(() => {
    if (showCompleted) {
      return items;
    }
    return items.filter((item) => item.progress !== 'done');
  }, [items, showCompleted]);

  const upcomingRangeLabel = bootstrap
    ? `${bootstrap.settings.recentRangeValue}${bootstrap.settings.recentRangeUnit === 'day' ? '天' : '周'}`
    : '可配置范围';

  async function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title) {
      return;
    }

    try {
      setErrorMessage(null);
      await createItem({ title });
      setQuickTitle('');
      await loadViewItems(activeView);
    } catch (error) {
      setErrorMessage((error as Error).message || '创建失败');
    }
  }

  async function handleComplete(itemId: string) {
    try {
      setErrorMessage(null);
      await completeItem(itemId);
      await loadViewItems(activeView);
    } catch (error) {
      setErrorMessage((error as Error).message || '完成操作失败');
    }
  }

  async function handleSaveDetail() {
    if (!selectedItem) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      const updated = await patchItem(selectedItem.id, {
        title: detailDraft.title,
        notes: detailDraft.notes.trim() === '' ? null : detailDraft.notes,
        progress: detailDraft.progress,
      });
      setItems((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setErrorMessage((error as Error).message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  }

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
          <div>
            <span className="section-tag">当前视图</span>
            <h2>{SMART_VIEW_LABELS[activeView]}</h2>
          </div>
          <div className="toolbar">
            <button type="button" onClick={() => setShowCompleted(true)}>
              全部
            </button>
            <button type="button" onClick={() => setShowCompleted(false)}>
              未完成
            </button>
            <button type="button" onClick={() => setShowCompleted((previous) => !previous)}>
              {showCompleted ? '隐藏已完成' : '显示已完成'}
            </button>
          </div>
        </header>

        {isLoading ? <p>正在加载数据...</p> : null}
        {errorMessage ? <p className="error-message">{errorMessage}</p> : null}

        <section className="list">
          {visibleItems.map((item) => (
            <article
              key={item.id}
              className={`card${item.progress === 'done' ? ' card--done' : ''}${item.id === selectedItemId ? ' card--active' : ''}`}
              onClick={() => setSelectedItemId(item.id)}
            >
              <div className="card__meta">
                <span>{ITEM_PROGRESS_LABELS[item.progress]}</span>
                <span>{formatExpectedAt(item.expectedAt)}</span>
              </div>
              <h3>{item.title}</h3>
              {item.progress !== 'done' ? (
                <button
                  type="button"
                  className="card__complete"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleComplete(item.id);
                  }}
                >
                  完成
                </button>
              ) : null}
            </article>
          ))}
        </section>

        <footer className="quick-create">
          <form onSubmit={handleCreateItem}>
            <input
              aria-label="快速创建事项"
              placeholder="输入标题，回车创建到后端"
              type="text"
              value={quickTitle}
              onChange={(event) => setQuickTitle(event.target.value)}
            />
          </form>
        </footer>
      </main>

      <aside className="detail">
        <div className="detail__header">
          <span className="section-tag">详情区</span>
          <button type="button" disabled={!selectedItem || isSaving} onClick={() => void handleSaveDetail()}>
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>

        {selectedItem ? (
          <div className="detail__body">
            <label>
              标题
              <input
                value={detailDraft.title}
                type="text"
                onChange={(event) => setDetailDraft((previous) => ({ ...previous, title: event.target.value }))}
              />
            </label>
            <label>
              备注
              <textarea
                value={detailDraft.notes}
                rows={6}
                onChange={(event) => setDetailDraft((previous) => ({ ...previous, notes: event.target.value }))}
              />
            </label>
            <label>
              进度
              <select
                value={detailDraft.progress}
                onChange={(event) =>
                  setDetailDraft((previous) => ({ ...previous, progress: event.target.value as ItemProgress }))
                }
              >
                <option value="todo">未开始</option>
                <option value="doing">进行中</option>
                <option value="done">已完成</option>
                <option value="paused">搁置</option>
              </select>
            </label>
          </div>
        ) : (
          <p>请选择一个事项查看详情。</p>
        )}
      </aside>
    </div>
  );
}
