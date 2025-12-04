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
      body: options.body instanceof FormData 
        ? options.body 
        : options.body 
          ? JSON.stringify(options.body) 
          : undefined,
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

  // Twin
  async getTwinDashboard() {
    return this.request('/twin/dashboard');
  }

  async getTwinProfile() {
    return this.request('/twin/profile');
  }

  // Questions
  async getNextQuestion() {
    return this.request('/questions/next');
  }

  async getPendingQuestions(limit = 10) {
    return this.request(`/questions/pending?limit=${limit}`);
  }

  async answerQuestion(questionId, answer) {
    return this.request(`/questions/${questionId}/answer`, {
      method: 'POST',
      body: { answer },
    });
  }

  async skipQuestion(questionId) {
    return this.request(`/questions/${questionId}/skip`, {
      method: 'POST',
    });
  }

  async generateQuestions(count = 5) {
    return this.request('/questions/generate', {
      method: 'POST',
      body: { count },
    });
  }

  async getQuestionStats() {
    return this.request('/questions/stats');
  }

  async getAnsweredQuestions(limit = 20, offset = 0) {
    return this.request(`/questions/answered?limit=${limit}&offset=${offset}`);
  }

  // Photos
  async uploadPhoto(file, description = '') {
    const formData = new FormData();
    formData.append('photo', file);
    if (description) {
      formData.append('description', description);
    }
    return this.request('/photos/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async getPhotos(limit = 20, offset = 0, category = null) {
    let url = `/photos?limit=${limit}&offset=${offset}`;
    if (category) url += `&category=${category}`;
    return this.request(url);
  }

  async getPhoto(photoId) {
    return this.request(`/photos/${photoId}`);
  }

  async deletePhoto(photoId) {
    return this.request(`/photos/${photoId}`, { method: 'DELETE' });
  }

  async getPhotoStats() {
    return this.request('/photos/stats');
  }

  // Voice
  async sendVoiceMessage(audioBlob, conversationId = null) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice.webm');
    if (conversationId) {
      formData.append('conversationId', conversationId);
    }
    return this.request('/voice/message', {
      method: 'POST',
      body: formData,
    });
  }

  // Notifications
  async getNotifications(limit = 20) {
    return this.request(`/notifications?limit=${limit}`);
  }

  async markNotificationRead(id) {
    return this.request(`/notifications/${id}/read`, { method: 'POST' });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'POST' });
  }

  async deleteNotification(id) {
    return this.request(`/notifications/${id}`, { method: 'DELETE' });
  }

  // TTS / Voice
  async getVoices() {
    return this.request('/tts/voices');
  }

  async getVoiceSettings() {
    return this.request('/tts/settings');
  }

  async updateVoiceSettings(settings) {
    return this.request('/tts/settings', {
      method: 'PUT',
      body: settings,
    });
  }

  async generateSpeech(text, voiceId = null) {
    return this.request('/tts/generate', {
      method: 'POST',
      body: { text, voiceId },
    });
  }

  async cloneVoice(name, audioFiles, description = '') {
    const formData = new FormData();
    formData.append('name', name);
    if (description) formData.append('description', description);
    audioFiles.forEach((file) => formData.append('audio', file));
    
    return this.request('/tts/clone', {
      method: 'POST',
      body: formData,
    });
  }

  async deleteVoice(voiceId) {
    return this.request(`/tts/voices/${voiceId}`, { method: 'DELETE' });
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

  async uploadTwitter(file) {
    const formData = new FormData();
    formData.append('file', file);

    return this.request('/datasources/twitter', {
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
