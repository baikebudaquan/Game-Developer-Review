export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export function createApi(token, base = '/api/admin') {
  if (!token) throw new Error('缺少登录凭证');

  async function request(path, { method = 'GET', body } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = { message: text }; }
    }
    if (!response.ok) {
      throw new ApiError(data?.message || `HTTP ${response.status}`, response.status, data);
    }
    return data;
  }

  return {
    me: () => request('/me'),
    listPending: (limit = 50) => request(`/submissions?status=pending&limit=${encodeURIComponent(limit)}`),
    approve: (id, payload) => request(`/submissions/${encodeURIComponent(id)}`, {
      method: 'POST', body: { action: 'approve', ...payload },
    }),
    reject: (id, payload) => request(`/submissions/${encodeURIComponent(id)}`, {
      method: 'POST', body: { action: 'reject', ...payload },
    }),
  };
}
