import { createDiscreteApi } from 'naive-ui';

function createApi() {
  return createDiscreteApi(['message']);
}

type Api = ReturnType<typeof createApi>;

let discreteApi: Api | null = null;

function ensureApi() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!discreteApi) {
    discreteApi = createApi();
  }

  return discreteApi;
}

export function notifyError(message: string) {
  const api = ensureApi();
  if (!api) {
    console.error(message);
    return;
  }
  api.message.error(message);
}

export function notifySuccess(message: string) {
  const api = ensureApi();
  if (!api) {
    console.info(message);
    return;
  }
  api.message.success(message);
}

export function notifyInfo(message: string) {
  const api = ensureApi();
  if (!api) {
    console.info(message);
    return;
  }
  api.message.info(message);
}
