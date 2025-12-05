import { defineStore } from 'pinia';

/**
 * UI 状态管理 Store
 *
 * 管理全局 UI 状态，如抽屉、弹窗、移动端搜索等
 */
export const useUIStore = defineStore('ui', {
  state: () => ({
    /** 持久筛选抽屉（自定义页等） */
    showFilterDrawer: false,
    showMobileSearch: false,
    showProfileDrawer: false,
  }),
  actions: {
    openFilterDrawer() {
      this.showFilterDrawer = true;
    },
    closeFilterDrawer() {
      this.showFilterDrawer = false;
    },
    toggleFilterDrawer() {
      this.showFilterDrawer = !this.showFilterDrawer;
    },
    openMobileSearch() {
      this.showMobileSearch = true;
    },
    closeMobileSearch() {
      this.showMobileSearch = false;
    },
    toggleMobileSearch() {
      this.showMobileSearch = !this.showMobileSearch;
    },
    openProfileDrawer() {
      this.showProfileDrawer = true;
    },
    closeProfileDrawer() {
      this.showProfileDrawer = false;
    },
    toggleProfileDrawer() {
      this.showProfileDrawer = !this.showProfileDrawer;
    },
  },
});
