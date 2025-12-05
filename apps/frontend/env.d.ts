/// <reference types="vite/client" />

import type { HomeTab } from './src/types/navigation';
import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    requiresOnboardingComplete?: boolean;
    title?: string;
    tab?: HomeTab;
    loadingTitle?: string;
    loadingDescription?: string;
  }
}
