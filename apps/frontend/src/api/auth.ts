import type { SessionUser, SuccessResponse, ApiErrorResponse } from '@opz-hub/shared';
import { apiClient } from './client';

interface SilentAuthError extends Error {
  data?: ApiErrorResponse;
  status: string;
}

function buildSilentUnauthorizedError(payload?: ApiErrorResponse): SilentAuthError {
  const error = new Error(payload?.error.message || 'Unauthorized') as SilentAuthError;
  error.data = payload;
  error.status = payload ? payload.error.code : 'UNAUTHORIZED';
  return error;
}

export async function fetchSessionUser(options: { silent?: boolean } = {}) {
  if (options.silent) {
    const response = await apiClient.raw<SessionUser>('/auth/me', {
      ignoreResponseError: true,
    });

    if (!response.ok) {
      throw buildSilentUnauthorizedError(response._data as ApiErrorResponse | undefined);
    }

    return response._data as SessionUser;
  }

  return apiClient<SessionUser>('/auth/me');
}

export function logout() {
  return apiClient<SuccessResponse>('/auth/logout', {
    method: 'POST',
    body: {}, // 显式发送空 body
  });
}

export function getDiscordOAuthUrl() {
  return '/api/auth/discord';
}
