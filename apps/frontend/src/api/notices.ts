import { apiClient } from './client';

export type NoticeType = 'error' | 'warning' | 'hint' | 'info';

export interface Notice {
  type: NoticeType;
  content: string;
  filename: string;
  updatedAt: string;
}

// 获取最新公告
export async function fetchLatestNotice(): Promise<Notice | null> {
  return apiClient<Notice | null>('/notices/latest');
}
