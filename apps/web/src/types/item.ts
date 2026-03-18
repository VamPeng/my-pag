export type ItemProgress = '未开始' | '进行中' | '已完成' | '搁置';

export interface ItemSummary {
  id: string;
  title: string;
  progress: ItemProgress;
  expectedAt: string | null;
  completed: boolean;
}
