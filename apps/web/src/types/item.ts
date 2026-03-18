export type ItemProgress = 'todo' | 'doing' | 'done' | 'paused';
export type ItemPriority = 'low' | 'medium' | 'high' | null;
export type RecentRangeUnit = 'day' | 'week';
export type SmartViewKey = 'inbox' | 'today' | 'upcoming' | 'overdue';

export interface ItemSummary {
  id: string;
  directoryId: string | null;
  title: string;
  progress: ItemProgress;
  priority: ItemPriority;
  notes: string | null;
  expectedAt: string | null;
  completedAt: string | null;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DirectoryNode {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  children: DirectoryNode[];
}

export interface SettingsData {
  recentRangeValue: number;
  recentRangeUnit: RecentRangeUnit;
}

export interface BootstrapData {
  account: {
    id: string;
    name: string;
    status: string;
  };
  settings: SettingsData;
  directories: DirectoryNode[];
}

export const SMART_VIEW_LABELS: Record<SmartViewKey, string> = {
  inbox: '收件箱',
  today: '今天',
  upcoming: '近期',
  overdue: '逾期',
};

export const ITEM_PROGRESS_LABELS: Record<ItemProgress, string> = {
  todo: '未开始',
  doing: '进行中',
  done: '已完成',
  paused: '搁置',
};
