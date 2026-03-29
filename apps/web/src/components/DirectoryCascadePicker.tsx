import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { DirectoryNode } from '../types/item';

export type DirPickerAnchor = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

type DirSelection =
  | { kind: 'unclassified' }
  | { kind: 'directory'; id: string };

type Props = {
  roots: DirectoryNode[];
  anchor: DirPickerAnchor;
  /** 打开时任务当前所属目录，用于展开路径与默认选中 */
  initialDirectoryId: string | null;
  onClose: () => void;
  /** null = 未分类 */
  onConfirm: (directoryId: string | null) => void;
};

const COL_WIDTH = 200;
const GAP = 8;

const IS_MAC = typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac');

function findDirectoryPath(nodes: DirectoryNode[], targetId: string): DirectoryNode[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return [node];
    const sub = findDirectoryPath(node.children, targetId);
    if (sub) return [node, ...sub];
  }
  return null;
}

function buildInitialColumns(path: DirectoryNode[], roots: DirectoryNode[]): DirectoryNode[][] {
  const cols: DirectoryNode[][] = [roots];
  for (const n of path) {
    if (n.children.length > 0) cols.push(n.children);
  }
  return cols;
}

function computeInitial(
  roots: DirectoryNode[],
  initialDirectoryId: string | null,
): {
  columns: DirectoryNode[][];
  pathIds: string[];
  selection: DirSelection;
} {
  if (!initialDirectoryId) {
    return {
      columns: [roots],
      pathIds: [],
      selection: { kind: 'unclassified' },
    };
  }
  const path = findDirectoryPath(roots, initialDirectoryId);
  if (!path || path.length === 0) {
    return {
      columns: [roots],
      pathIds: [],
      selection: { kind: 'unclassified' },
    };
  }
  return {
    columns: buildInitialColumns(path, roots),
    pathIds: path.map((n) => n.id),
    selection: { kind: 'directory', id: path[path.length - 1].id },
  };
}

export function DirectoryCascadePicker({
  roots,
  anchor,
  initialDirectoryId,
  onClose,
  onConfirm,
}: Props) {
  const init = useMemo(() => computeInitial(roots, initialDirectoryId), [roots, initialDirectoryId]);
  const [columns, setColumns] = useState<DirectoryNode[][]>(() => init.columns);
  const [pathIds, setPathIds] = useState<string[]>(() => init.pathIds);
  const [selection, setSelection] = useState<DirSelection>(() => init.selection);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = computeInitial(roots, initialDirectoryId);
    setColumns(next.columns);
    setPathIds(next.pathIds);
    setSelection(next.selection);
  }, [roots, initialDirectoryId]);

  const handleUnclassifiedClick = useCallback(() => {
    setSelection({ kind: 'unclassified' });
    setPathIds([]);
    setColumns([roots]);
  }, [roots]);

  const handleNode = useCallback(
    (node: DirectoryNode, depth: number) => {
      setSelection({ kind: 'directory', id: node.id });
      setPathIds((prev) => [...prev.slice(0, depth), node.id]);
      if (node.children.length > 0) {
        setColumns((prev) => {
          const next = prev.slice(0, depth + 1);
          next.push(node.children);
          return next;
        });
      } else {
        setColumns((prev) => prev.slice(0, depth + 1));
      }
    },
    [],
  );

  const submit = useCallback(() => {
    if (selection.kind === 'unclassified') {
      onConfirm(null);
    } else {
      onConfirm(selection.id);
    }
  }, [onConfirm, selection]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  /** 与创建任务 / 详情保存一致：⌘↵（Mac）或 Alt+Enter */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.altKey) && e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [submit]);

  const panelW = Math.max(1, columns.length) * COL_WIDTH + 2;
  let left = anchor.left;
  const top = anchor.top + anchor.height + GAP;
  if (typeof window !== 'undefined') {
    left = Math.min(left, window.innerWidth - panelW - 8);
    left = Math.max(8, left);
  }

  const panel = (
    <div
      ref={panelRef}
      className="dir-cascade-picker"
      style={{ position: 'fixed', left, top, zIndex: 150, width: panelW }}
      role="dialog"
      aria-label="选择目录"
    >
      <div className="dir-cascade-picker__columns">
        {columns.map((colNodes, depth) => (
          <div key={depth} className="dir-cascade-picker__col">
            {depth === 0 ? (
              <button
                type="button"
                className={`dir-cascade-picker__row dir-cascade-picker__row--unclassified${
                  selection.kind === 'unclassified' ? ' is-active' : ''
                }`}
                onClick={handleUnclassifiedClick}
              >
                未分类
              </button>
            ) : null}
            {colNodes.map((node) => {
              const active = pathIds[depth] === node.id;
              const hasKids = node.children.length > 0;
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`dir-cascade-picker__row${active ? ' is-active' : ''}`}
                  onClick={() => handleNode(node, depth)}
                >
                  {node.color ? (
                    <span className="category-dot" style={{ background: node.color }} />
                  ) : (
                    <span className="dir-cascade-picker__dot-spacer" />
                  )}
                  <span className="dir-cascade-picker__label">{node.name}</span>
                  {hasKids ? <span className="dir-cascade-picker__chev" aria-hidden>›</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="dir-cascade-picker__footer">
        <button type="button" className="dir-cascade-picker__confirm" onClick={submit}>
          确认
          <kbd className="create-form__kbd">{IS_MAC ? '⌘↵' : 'Alt↵'}</kbd>
        </button>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
