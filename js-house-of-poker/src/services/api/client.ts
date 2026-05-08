import { requireEnvValue } from '../../config/env';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiValidationError = {
  field: string;
  message: string;
  value?: unknown;
};

export type ApiErrorPayload = {
  error?: string;
  errors?: ApiValidationError[];
  message?: string;
};

type ApiRequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  method?: RequestMethod;
  token?: string | null;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
  }
}

function buildUrl(path: string) {
  const baseUrl = requireEnvValue('apiBaseUrl');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

function parsePayload(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isApiErrorPayload(payload: unknown): payload is ApiErrorPayload {
  return typeof payload === 'object' && payload !== null;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const { body, headers, method = 'GET', token } = options;
  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  const url = buildUrl(path);

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Unable to reach the server at ${url}. Check that the backend is running and that this device can access the API host.`,
      );
    }

    throw error;
  }

  const rawText = await response.text();
  const payload = parsePayload(rawText);

  if (!response.ok) {
    const message =
      isApiErrorPayload(payload) && typeof payload.message === 'string'
        ? payload.message
        : `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export function getApiErrorDetails(error: unknown, fallbackMessage = 'Something went wrong') {
  const fieldErrors: Record<string, string> = {};

  if (error instanceof ApiError) {
    const payload = error.payload;

    if (isApiErrorPayload(payload) && Array.isArray(payload.errors)) {
      for (const item of payload.errors) {
        if (!item?.field || typeof item.message !== 'string' || fieldErrors[item.field]) {
          continue;
        }

        fieldErrors[item.field] = item.message;
      }
    }

    const payloadMessage =
      isApiErrorPayload(payload) && typeof payload.message === 'string'
        ? payload.message
        : undefined;

    const message =
      payloadMessage === 'Validation failed' && Object.keys(fieldErrors).length > 0
        ? 'Please correct the highlighted fields.'
        : payloadMessage ?? error.message ?? fallbackMessage;

    return {
      fieldErrors,
      message,
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      fieldErrors,
      message: error.message || fallbackMessage,
      status: null,
    };
  }

  return {
    fieldErrors,
    message: fallbackMessage,
    status: null,
  };
}
