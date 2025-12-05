/**
 * Array manipulation helpers
 * 从 stores/filters.ts 提取的通用数组操作工具函数
 */

/**
 * 清理字符串值
 */
export function sanitize(value: string): string {
  return value.trim();
}

/**
 * 切换数组中的元素（存在则删除，不存在则添加）
 */
export function toggleEntry(list: string[], value: string): string[] {
  const normalized = sanitize(value);
  if (!normalized) return list;
  const set = new Set(list);
  if (set.has(normalized)) {
    set.delete(normalized);
  } else {
    set.add(normalized);
  }
  return Array.from(set);
}

// 添加唯一元素到数组（避免重复）
export function addUnique(list: string[], value: string): string[] {
  const normalized = sanitize(value);
  if (!normalized || list.includes(normalized)) return list;
  return [...list, normalized];
}

// 从数组中移除元素
export function removeEntry(list: string[], value: string): string[] {
  const normalized = sanitize(value);
  if (!normalized) return list;
  return list.filter((item) => item !== normalized);
}
