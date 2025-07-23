import { FetchError } from "./custom-errors";

interface Options<T = object> {
  params?: T;
  headers?: HeadersInit;
  validateStatus?: (status: number) => boolean;
}

function isAbsoluteURL(url: string): boolean {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

function combineUrls(baseURL: string, relativeURL: string): string {
  return relativeURL
    ? `${baseURL.replace(/\/+$/, "")}/${relativeURL.replace(/^\/+/, "")}`
    : baseURL;
}

function buildFullPath(baseURL: string, requestedURL: string): string {
  if (baseURL && !isAbsoluteURL(requestedURL)) {
    return combineUrls(baseURL, requestedURL);
  }
  return requestedURL;
}

function buildHeaders<T = HeadersInit>(headers?: T): HeadersInit {
  if (!headers) {
    // 未指定(undefined)の場合、`Content-Type: application/json` を返す
    return {
      "Content-Type": "application/json",
    };
  }

  return headers;
}

function buildRequestBody<T = object>(body: T): string | FormData | null {
  if (body instanceof FormData) {
    // FormDataの場合、 `JSON.stringify()` せずそのまま返す
    return body;
  }

  if (!body) {
    return null;
  }

  return JSON.stringify(body);
}

function buildPathWithSearchParams<T = object>(path: string, params?: T) {
  if (!params || Object.keys(params).length === 0) {
    return path;
  }

  for (const key in params) {
    if (params[key] === undefined) {
      delete params[key]; // URLSearchParamsで`key="undefined"`になるので削除する
    }
  }

  const urlSearchParams = new URLSearchParams(params);
  return `${path}?${urlSearchParams.toString()}`;
}

async function http<T>(
  path: string,
  config: RequestInit,
  validateStatus?: (status: number) => boolean
): Promise<T> {
  // サーバーサイドかクライアントサイドかを判定
  const isServer = typeof window === 'undefined';
  // サーバーサイドでは内部URL、クライアントサイドでは外部URLを使用
  // SERVER_API_URLが未設定の場合はNEXT_PUBLIC_API_URLをフォールバックとして使用
  const baseURL = isServer 
    ? (process.env.SERVER_API_URL || process.env.NEXT_PUBLIC_API_URL)
    : process.env.NEXT_PUBLIC_API_URL;
  
  if (!baseURL) {
    throw new Error('API_URLが設定されていません');
  }
  
  const request = new Request(
    buildFullPath(baseURL, path),
    config
  );

  const res = await fetch(request);

  if (!res.ok) {
    const error = new FetchError("データのfetch中にエラーが発生しました", {
      status: res.status,
    });
    error.message = "データが見つかりませんでした";
    throw error;
  }

  if (validateStatus && !validateStatus(res.status)) {
    const error = new FetchError(
      "HTTPステータスコードがバリデーションエラーになりました",
      { status: res.status }
    );
    throw error;
  }

  if (res.status === 204) return {} as T; // statusCodeが204のときにres.json()を実行するとエラーになるため

  return await res.json();
}

export async function get<T, U = object>(
  path: string,
  options?: Options<U>
): Promise<T> {
  return http<T>(
    buildPathWithSearchParams(path, options?.params),
    {
      method: "GET",
      headers: buildHeaders(options?.headers),
    },
    options?.validateStatus
  );
}

export async function post<T, U, V = object>(
  path: string,
  body: T,
  options?: Options<V>
): Promise<U> {
  return http<U>(
    path,
    {
      method: "POST",
      headers: buildHeaders(options?.headers),
      body: buildRequestBody(body),
    },
    options?.validateStatus
  );
}

export async function put<T, U = object>(
  path: string,
  body: T,
  options?: Options<U>
): Promise<U> {
  return http<U>(
    path,
    {
      method: "PUT",
      body: buildRequestBody(body),
      headers: buildHeaders(options?.headers),
    },
    options?.validateStatus
  );
}

// deleteはJSの予約語であるためdestroyとする
export async function destroy<T = object>(
  path: string,
  options?: Options<T>
): Promise<unknown> {
  return http(
    buildPathWithSearchParams(path, options?.params),
    {
      method: "DELETE",
      headers: buildHeaders(options?.headers),
    },
    options?.validateStatus
  );
}
