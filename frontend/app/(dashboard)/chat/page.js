'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = async () => {
    setLoadingConversations(true);
    try {
      const response = await api.getConversations(1, 50);
      setConversations(response.data.conversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadConversation = async (id) => {
    try {
      const response = await api.getConversation(id);
      setConversationId(id);
      setMessages(response.data.messages.map(m => ({
        role: m.role,
        content: m.content
      })));
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const deleteConversation = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    
    try {
      await api.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) {
        startNewChat();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await api.sendMessage(userMessage, conversationId);
      setConversationId(response.data.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.data.reply, memoriesUsed: response.data.memoriesUsed },
      ]);
      // Refresh conversations list
      loadConversations();
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'error', content: error.message },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
  };

  return (
    <div className="h-full flex">
      {/* Conversations Sidebar */}
      <div className={`${showHistory ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-[var(--border)] flex flex-col bg-black/20`}>
        <div className="p-4 border-b border-[var(--border)]">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl font-medium transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {loadingConversations ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">No conversations yet</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all ${
                    conversationId === conv.id
                      ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{conv.title || 'New conversation'}</p>
                    <p className="text-xs text-muted">{conv.messageCount} messages</p>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="p-1 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border)]">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold">Chat with your Twin</h1>
            <p className="text-sm text-muted">Your AI learns from every conversation</p>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
              <p className="text-muted max-w-md">
                Your Twin learns from every interaction. Share your thoughts, preferences, and experiences to help it understand you better.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {['Tell me about yourself', 'What do you like?', 'How was your day?'].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-[var(--border)] rounded-full transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'message-user text-white'
                        : message.role === 'error'
                        ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                        : 'message-assistant'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.memoriesUsed > 0 && (
                      <p className="text-xs text-indigo-300 mt-2 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Used {message.memoriesUsed} memories
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start animate-fadeIn">
                  <div className="message-assistant px-4 py-3 rounded-2xl">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--border)]">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl focus:outline-none focus:border-primary transition-colors"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
