const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'torrentwide_access_token';

export function getAccessToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 401) { clearAccessToken(); window.dispatchEvent(new Event('torrentwide:unauthorized')); }
  return response;
}

export async function readApiError(response: Response): Promise<string> {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const body = await response.json();
    return body.detail || body.error || 'API request failed';
  }
  return `API request failed (HTTP ${response.status}). Check VITE_API_BASE_URL and backend deployment.`;
}

export function getTorrentWebSocketUrl(): string {
  const base = API_BASE || window.location.origin;
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/api/torrents/ws`;
  url.search = '';
  return url.toString();
}

export async function downloadTorrentFile(torrentId: string, fileIndex: number): Promise<Blob> {
  const token = getAccessToken();
  if (!token) throw new Error('Please sign in again to download this file');
  const response = await fetch(
    `${API_BASE}/api/torrents/${encodeURIComponent(torrentId)}/files/${fileIndex}/download`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (response.status === 401) {
    clearAccessToken();
    window.dispatchEvent(new Event('torrentwide:unauthorized'));
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Download failed (HTTP ${response.status})`);
  }
  return response.blob();
}
