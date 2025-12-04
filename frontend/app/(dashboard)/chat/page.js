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
  
  // Voice states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  
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
      const reply = response.data.reply;
      
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, memoriesUsed: response.data.memoriesUsed },
      ]);
      
      // Text-to-speech
      if (ttsEnabled) {
        speakText(reply);
      }
      
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

  // Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await sendVoiceMessage(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Could not access microphone. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
      audioChunksRef.current = [];
    }
  };

  const sendVoiceMessage = async (audioBlob) => {
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: '🎤 Voice message...', isVoice: true }]);

    try {
      const response = await api.sendVoiceMessage(audioBlob, conversationId);
      const { transcription, response: reply } = response.data;
      
      // Update the voice message with transcription
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastUserIndex = newMessages.findLastIndex(m => m.role === 'user');
        if (lastUserIndex !== -1) {
          newMessages[lastUserIndex] = { 
            role: 'user', 
            content: transcription,
            isVoice: true 
          };
        }
        return newMessages;
      });

      setConversationId(response.data.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply },
      ]);

      // Text-to-speech
      if (ttsEnabled) {
        speakText(reply);
      }

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

  // Text-to-Speech (ElevenLabs with browser fallback)
  const audioRef = useRef(null);
  
  const speakText = async (text) => {
    try {
      // Try ElevenLabs first
      const response = await api.generateSpeech(text);
      
      if (response.data.fallback) {
        // Fallback to browser TTS
        browserSpeak(text);
      } else {
        // Play ElevenLabs audio
        stopSpeaking();
        const audio = new Audio(`data:${response.data.mimeType};base64,${response.data.audio}`);
        audioRef.current = audio;
        audio.play();
      }
    } catch {
      // Fallback to browser TTS
      browserSpeak(text);
    }
  };

  const browserSpeak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'tr-TR';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const turkishVoice = voices.find(v => v.lang.startsWith('tr'));
      if (turkishVoice) {
        utterance.voice = turkishVoice;
      }
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-4">
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
          </div>
          
          {/* TTS Toggle */}
          <button
            onClick={() => {
              if (ttsEnabled) stopSpeaking();
              setTtsEnabled(!ttsEnabled);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              ttsEnabled 
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                : 'bg-white/5 text-muted'
            }`}
            title={ttsEnabled ? 'Voice responses ON' : 'Voice responses OFF'}
          >
            {ttsEnabled ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
            <span className="text-sm hidden sm:inline">{ttsEnabled ? 'Voice On' : 'Voice Off'}</span>
          </button>
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
              <p className="text-sm text-indigo-400 mt-2">🎤 Try sending a voice message!</p>
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
                    {message.isVoice && (
                      <span className="text-xs opacity-70 mr-2">🎤</span>
                    )}
                    <p className="whitespace-pre-wrap inline">{message.content}</p>
                    {message.memoriesUsed > 0 && (
                      <p className="text-xs text-indigo-300 mt-2 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Used {message.memoriesUsed} memories
                      </p>
                    )}
                    {/* Play button for assistant messages */}
                    {message.role === 'assistant' && (
                      <button
                        onClick={() => speakText(message.content)}
                        className="mt-2 text-xs text-muted hover:text-white flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Play
                      </button>
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
        <div className="p-4 border-t border-[var(--border)]">
          {/* Recording UI */}
          {isRecording ? (
            <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 font-mono">{formatTime(recordingTime)}</span>
              <span className="text-muted flex-1">Recording...</span>
              <button
                onClick={cancelRecording}
                className="p-2 hover:bg-white/10 rounded-lg text-muted hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={stopRecording}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-medium transition-colors"
              >
                Send
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl focus:outline-none focus:border-primary transition-colors"
                disabled={loading}
              />
              
              {/* Voice Record Button */}
              <button
                type="button"
                onClick={startRecording}
                disabled={loading}
                className="px-4 py-3 bg-[var(--card)] border border-[var(--border)] hover:border-indigo-500/50 hover:bg-indigo-500/10 rounded-xl transition-all disabled:opacity-50"
                title="Send voice message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
