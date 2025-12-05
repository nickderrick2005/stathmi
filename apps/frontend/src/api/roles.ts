import type { Role } from '@opz-hub/shared';
import { apiClient } from './client';

// 获取所有角色元数据
export async function fetchRoles(): Promise<Role[]> {
  return apiClient<Role[]>('/roles');
}
