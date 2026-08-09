export interface ApiRequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

export interface ApiClient {
  get: (path: string) => Promise<any>;
  post: (path: string, body?: any) => Promise<any>;
  postForm: (path: string, body: FormData) => Promise<any>;
  put: (path: string, body?: any) => Promise<any>;
  patch: (path: string, body?: any) => Promise<any>;
  del: (path: string, body?: any) => Promise<any>;
  delete: (path: string, body?: any) => Promise<any>;
}

export interface ApiError extends Error {
  status?: number;
  body?: unknown;
}
