const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

class ApiClient {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    
    // Load tokens from localStorage on init (client-side only)
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    }
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const headers = {
      ...options.headers,
    };

    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      body: options.body instanceof FormData ? options.body : JSON.stringify(options.body),
    });

    const data = await response.json();

    if (!response.ok) {
      // Try to refresh token if unauthorized
      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          // Retry original request
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          const retryResponse = await fetch(url, { ...options, headers });
          return retryResponse.json();
        }
      }
      throw new Error(data.message || 'API Error');
    }

    return data;
  }

  async tryRefreshToken() {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      }
    } catch {
      // Refresh failed
    }
    this.clearTokens();
    return false;
  }

  // Auth
  async register(email, password, name) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: { email, password, name },
    });
    this.setTokens(data.data.accessToken, data.data.refreshToken);
    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    this.setTokens(data.data.accessToken, data.data.refreshToken);
    return data;
  }

  async googleAuth(idToken) {
    const data = await this.request('/auth/google', {
      method: 'POST',
      body: { idToken },
    });
    this.setTokens(data.data.accessToken, data.data.refreshToken);
    return data;
  }

  async appleAuth(identityToken, user = null) {
    const data = await this.request('/auth/apple', {
      method: 'POST',
      body: { identityToken, user },
    });
    this.setTokens(data.data.accessToken, data.data.refreshToken);
    return data;
  }

  async logout() {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
        body: { refreshToken: this.refreshToken },
      });
    } finally {
      this.clearTokens();
    }
  }

  // User
  async getProfile() {
    return this.request('/users/me');
  }

  // Chat
  async sendMessage(message, conversationId = null) {
    return this.request('/chat', {
      method: 'POST',
      body: { message, conversationId },
    });
  }

  async getConversations(page = 1, limit = 20) {
    return this.request(`/chat/conversations?page=${page}&limit=${limit}`);
  }

  async getConversation(id) {
    return this.request(`/chat/conversations/${id}`);
  }

  async deleteConversation(id) {
    return this.request(`/chat/conversations/${id}`, { method: 'DELETE' });
  }

  // Memories
  async getMemories(page = 1, limit = 20, category = null) {
    let url = `/memories?page=${page}&limit=${limit}`;
    if (category) url += `&category=${category}`;
    return this.request(url);
  }

  async searchMemories(query) {
    return this.request(`/memories/search?q=${encodeURIComponent(query)}`);
  }

  async deleteMemory(id) {
    return this.request(`/memories/${id}`, { method: 'DELETE' });
  }

  // Data Sources
  async getDataSources() {
    return this.request('/datasources');
  }

  async uploadWhatsApp(file, ownerName) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ownerName', ownerName);

    return this.request('/datasources/whatsapp', {
      method: 'POST',
      body: formData,
    });
  }

  async uploadInstagram(file, ownerName) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ownerName', ownerName);

    return this.request('/datasources/instagram', {
      method: 'POST',
      body: formData,
    });
  }

  async deleteDataSource(id) {
    return this.request(`/datasources/${id}`, { method: 'DELETE' });
  }

  isAuthenticated() {
    return !!this.accessToken;
  }
}

export const api = new ApiClient();
