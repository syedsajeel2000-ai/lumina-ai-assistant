// Small fetch wrapper for the JSON API. Streaming chat uses its own reader.

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response (should not happen with our API)
  }
  if (!res.ok) {
    const err = new Error(data?.error || 'Something went wrong. Please try again.');
    err.status = res.status;
    err.fields = data?.fields || null;
    err.kind = data?.kind || null;
    throw err;
  }
  return data;
}

export const api = {
  // auth
  signup: (payload) => request('/api/auth/signup', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),
  forgotPassword: (payload) => request('/api/auth/forgot-password', { method: 'POST', body: payload }),
  resetPassword: (payload) => request('/api/auth/reset-password', { method: 'POST', body: payload }),

  // conversations
  conversations: () => request('/api/conversations'),
  conversation: (id) => request(`/api/conversations/${id}`),
  createConversation: (title) => request('/api/conversations', { method: 'POST', body: { title } }),
  renameConversation: (id, title) => request(`/api/conversations/${id}`, { method: 'PATCH', body: { title } }),
  deleteConversation: (id) => request(`/api/conversations/${id}`, { method: 'DELETE' }),

  // saved responses
  saved: () => request('/api/saved'),
  saveResponse: (payload) => request('/api/saved', { method: 'POST', body: payload }),
  renameSaved: (id, title) => request(`/api/saved/${id}`, { method: 'PATCH', body: { title } }),
  deleteSaved: (id) => request(`/api/saved/${id}`, { method: 'DELETE' }),

  // templates / prefs / profile / ai
  templates: () => request('/api/templates'),
  preferences: () => request('/api/preferences'),
  updatePreferences: (payload) => request('/api/preferences', { method: 'PUT', body: payload }),
  updateProfile: (payload) => request('/api/profile', { method: 'PUT', body: payload }),
  updatePassword: (payload) => request('/api/password', { method: 'PUT', body: payload }),
  aiStatus: () => request('/api/ai/status'),
  reactToMessage: (id, reaction) => request(`/api/messages/${id}/reaction`, { method: 'PATCH', body: { reaction } })
};

/**
 * Stream a chat completion from POST /api/chat (Server-Sent Events).
 * Calls onEvent(type, data) for each event: start | delta | title | done | error | aborted.
 * Returns an abort function.
 */
export function streamChat(body, onEvent) {
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin',
        signal: controller.signal
      });
      if (!res.ok) {
        let msg = 'AI service is temporarily unavailable. Please try again.';
        let kind = null;
        try {
          const j = await res.json();
          msg = j.error || msg;
          kind = j.kind || null;
        } catch { /* ignore */ }
        onEvent('error', { error: msg, kind });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          let event = 'message';
          let data = '';
          for (const line of part.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (data) {
            try { onEvent(event, JSON.parse(data)); } catch { /* ignore */ }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') onEvent('error', { error: 'Connection lost. Please check your network and try again.', kind: 'network' });
    }
  })();
  return () => controller.abort();
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts / older browsers
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
      } catch {
      return false;
    }
  }
}
