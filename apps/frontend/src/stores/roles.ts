import { defineStore } from 'pinia';
import type { Role } from '@opz-hub/shared';
import { fetchRoles } from '@/api/roles';

/**
 * 角色元数据缓存 Store
 *
 * 职责：缓存角色元数据，根据 Discord 角色顺序确定优先级
 * 策略：内存缓存 + TTL（1小时），页面刷新后失效
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface RolesState {
  roles: CacheEntry<Role[]> | null;
  loading: boolean;
}

// 缓存有效期：1小时（毫秒）
const CACHE_TTL = 60 * 60 * 1000;

function isCacheValid<T>(entry: CacheEntry<T> | null | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL;
}

export const useRolesStore = defineStore('roles', {
  state: (): RolesState => ({
    roles: null,
    loading: false,
  }),

  getters: {
    // 获取缓存的角色列表（如果有效）
    cachedRoles: (state): Role[] | null => {
      return isCacheValid(state.roles) ? state.roles!.data : null;
    },

    // 角色 ID -> Role 映射
    roleMap(): Map<string, Role> {
      const roles = this.cachedRoles;
      if (!roles) return new Map();
      return new Map(roles.map((r) => [r.id, r]));
    },
  },

  actions: {
    // 等待预加载完成（供组件使用，不触发新请求）
    async ensureLoaded(): Promise<void> {
      if (this.cachedRoles) return;
      if (!this.loading) return; // 未开始加载，直接返回

      // 等待加载完成
      await new Promise<void>((resolve) => {
        const unwatch = this.$subscribe(() => {
          if (!this.loading) {
            unwatch();
            resolve();
          }
        });
      });
    },

    // 获取角色列表（带缓存）
    async getRoles(forceRefresh = false): Promise<Role[]> {
      if (!forceRefresh && this.cachedRoles) {
        return this.cachedRoles;
      }

      if (this.loading) {
        await this.ensureLoaded();
        return this.cachedRoles ?? [];
      }

      this.loading = true;
      try {
        const data = await fetchRoles();
        this.roles = {
          data,
          timestamp: Date.now(),
        };
        return data;
      } finally {
        this.loading = false;
      }
    },

    // 根据角色 ID 获取角色信息
    getRoleById(roleId: string): Role | null {
      return this.roleMap.get(roleId) ?? null;
    },

    // 获取角色优先级（position 值越大优先级越高）
    getRoleOrder(roleId: string): number {
      const role = this.getRoleById(roleId);
      return role?.position ?? -1;
    },

    // 判断角色是否可渲染（有图标或 emoji）
    isRoleRenderable(role: Role | null): boolean {
      if (!role) return false;
      return Boolean(role.iconUrl || role.emoji);
    },

    // 从角色 ID 列表中获取优先级最高且可渲染的角色
    getPrimaryRole(roleIds: string[] | undefined): Role | null {
      if (!roleIds || roleIds.length === 0) return null;

      let primaryRole: Role | null = null;
      let maxOrder = -1;

      for (const roleId of roleIds) {
        const role = this.getRoleById(roleId);
        // 跳过不可渲染的角色（没有图标和 emoji）
        if (!this.isRoleRenderable(role)) continue;

        const order = this.getRoleOrder(roleId);
        if (order > maxOrder) {
          maxOrder = order;
          primaryRole = role;
        }
      }

      return primaryRole;
    },

    // 清除缓存
    clearCache() {
      this.roles = null;
    },
  },
});
