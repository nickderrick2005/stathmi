import { ofetch, type FetchContext, type FetchError } from 'ofetch';
import type { ApiErrorResponse } from '@opz-hub/shared';
import { notifyError } from '@/utils/notifications';

type UnauthorizedHandler = () => void;
const unauthorizedHandlers = new Set<UnauthorizedHandler>();
const RETRIABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

// 允许业务在需要时注册额外的 401 处理逻辑（例如 Pinia store 清理）。
export function onUnauthorized(handler: UnauthorizedHandler) {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;

  const isAlreadyOnLogin = window.location.pathname === '/login';
  unauthorizedHandlers.forEach((handler) => handler());

  if (!isAlreadyOnLogin) {
    window.location.replace('/login');
  }
}

export type ApiFetchError = FetchError<ApiErrorResponse>;

export const apiClient = ofetch.create({
  baseURL: '/api',
  credentials: 'include',
  retry: 1,
  retryStatusCodes: [...RETRIABLE_STATUS_CODES],
  retryDelay: 500,
  async onRequest({ options }: FetchContext<ApiErrorResponse>) {
    const headers = new Headers(options.headers as HeadersInit | undefined);
    headers.set('Accept', 'application/json');

    const shouldForceJson =
      options.body &&
      typeof options.body === 'object' &&
      !(options.body instanceof FormData) &&
      !(options.body instanceof Blob);

    if (shouldForceJson) {
      headers.set('Content-Type', 'application/json');
    }

    options.headers = headers;
  },
  async onResponseError({ response, error, options }: FetchContext<ApiErrorResponse>) {
    const retryCount = typeof options?.retry === 'number' ? options.retry : 0;
    const willRetry = Boolean(response && retryCount > 0 && RETRIABLE_STATUS_CODES.has(response.status));

    // Let retriable calls retry first instead of spamming a 5xx toast (e.g. transient 502 spike)
    if (willRetry) {
      return;
    }

    if (response?.status === 401) {
      redirectToLogin();
    } else {
      const fetchError = error as ApiFetchError | undefined;
      const message = fetchError?.data?.error?.message ?? fetchError?.message ?? '网络请求失败';
      notifyError(message);
    }

    throw error ?? new Error('Request failed');
  },
});

export type ApiClient = typeof apiClient;
