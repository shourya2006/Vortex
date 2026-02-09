const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refreshToken");
  
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (data.success && data.accessToken && data.refreshToken) {
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function clearAuthAndRedirect() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("isAuthenticated");
  window.location.href = "/";
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("accessToken");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["auth-token"] = token;
  }

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshTokens();
    }

    const refreshed = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshed) {
      const newToken = localStorage.getItem("accessToken");
      (headers as Record<string, string>)["auth-token"] = newToken || "";
      response = await fetch(url, { ...options, headers });
    } else {
      clearAuthAndRedirect();
      throw new Error("Session expired. Please login again.");
    }
  }

  return response.json();
}

export async function apiStreamRequest(
  url: string,
  options: RequestInit,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void
): Promise<void> {
  const token = localStorage.getItem("accessToken");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["auth-token"] = token;
  }

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshTokens();
    }

    const refreshed = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshed) {
      const newToken = localStorage.getItem("accessToken");
      (headers as Record<string, string>)["auth-token"] = newToken || "";
      response = await fetch(url, { ...options, headers });
    } else {
      clearAuthAndRedirect();
      onError("Session expired. Please login again.");
      return;
    }
  }

  if (!response.ok) {
    onError("Failed to connect to stream");
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError("No response body");
    return;
  }

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.error) {
            onError(data.error);
            return;
          }
          if (data.done) {
            onComplete();
            return;
          }
          if (data.content) {
            onChunk(data.content);
          }
        } catch {
          // Ignore parse errors for incomplete chunks
        }
      }
    }
  }
}

export const apiClient = {
  get: <T>(url: string) => apiRequest<T>(url, { method: "GET" }),
  post: <T>(url: string, body: unknown) => 
    apiRequest<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) => 
    apiRequest<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(url: string) => apiRequest<T>(url, { method: "DELETE" }),
  stream: apiStreamRequest,
};
