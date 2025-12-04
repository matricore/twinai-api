'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

export default function VoiceSettingsPage() {
  const [voices, setVoices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testText, setTestText] = useState('Merhaba! Ben senin dijital ikizin. Nasıl yardımcı olabilirim?');
  const [playing, setPlaying] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneFiles, setCloneFiles] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [clonedVoiceId, setClonedVoiceId] = useState(null); // Store cloned voice ID separately
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const recordingTimeRef = useRef(0); // Keep track of actual time

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [voicesRes, settingsRes] = await Promise.all([
        api.getVoices(),
        api.getVoiceSettings(),
      ]);
      console.log('Voices loaded:', voicesRes.data);
      console.log('Settings loaded:', settingsRes.data);
      setVoices(voicesRes.data || []);
      setSettings(settingsRes.data || {});
      // Remember cloned voice ID
      if (settingsRes.data?.isCloned && settingsRes.data?.voiceId) {
        setClonedVoiceId(settingsRes.data.voiceId);
      }
    } catch (error) {
      console.error('Failed to load voice data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateVoiceSettings(settings);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const selectVoice = (voiceId) => {
    console.log('Selecting voice:', voiceId);
    if (!voiceId) {
      console.error('Voice ID is undefined!');
      return;
    }
    const isClonedVoice = voiceId === clonedVoiceId;
    setSettings((prev) => {
      const newSettings = {
        ...prev,
        voiceId,
        isCloned: isClonedVoice,
      };
      console.log('New settings:', newSettings);
      return newSettings;
    });
  };

  const handleTest = async () => {
    if (!testText.trim()) return;
    
    setPlaying(true);
    try {
      const response = await api.generateSpeech(testText, settings?.voiceId);
      
      if (response.data.fallback) {
        // Use browser TTS
        const utterance = new SpeechSynthesisUtterance(testText);
        utterance.lang = 'tr-TR';
        utterance.onend = () => setPlaying(false);
        window.speechSynthesis.speak(utterance);
      } else {
        // Play ElevenLabs audio
        const audio = new Audio(`data:${response.data.mimeType};base64,${response.data.audio}`);
        audioRef.current = audio;
        audio.onended = () => setPlaying(false);
        audio.play();
      }
    } catch (error) {
      console.error('Failed to generate speech:', error);
      setPlaying(false);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setPlaying(false);
  };

  const handleClone = async () => {
    const allFiles = [...cloneFiles, ...recordings.map(r => r.blob)];
    if (!cloneName.trim() || allFiles.length === 0) return;
    
    setCloning(true);
    try {
      const result = await api.cloneVoice(cloneName, allFiles);
      const newVoiceId = result.data.voiceId;
      setClonedVoiceId(newVoiceId);
      setSettings((prev) => ({ ...prev, voiceId: newVoiceId, isCloned: true }));
      setCloneName('');
      setCloneFiles([]);
      setRecordings([]);
    } catch (error) {
      console.error('Failed to clone voice:', error);
      alert('Failed to clone voice. Make sure you have clear audio samples (at least 30 seconds total).');
    } finally {
      setCloning(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setCloneFiles((prev) => [...prev, ...files].slice(0, 5));
  };

  const removeFile = (index) => {
    setCloneFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Voice Recording for Cloning
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingTimeRef.current = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        
        // Use ref value which has the correct time
        const finalDuration = recordingTimeRef.current;
        
        setRecordings(prev => [...prev, {
          id: Date.now(),
          blob: new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' }),
          url: audioUrl,
          duration: finalDuration,
        }].slice(0, 5));
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        recordingTimeRef.current += 1; // Update ref
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

  const removeRecording = (id) => {
    setRecordings(prev => {
      const recording = prev.find(r => r.id === id);
      if (recording?.url) {
        URL.revokeObjectURL(recording.url);
      }
      return prev.filter(r => r.id !== id);
    });
  };

  const playRecording = (url) => {
    const audio = new Audio(url);
    audio.play();
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalRecordingTime = recordings.reduce((sum, r) => sum + r.duration, 0);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedVoiceId = settings?.voiceId || '';
  const selectedVoice = voices.find((v) => v.id === selectedVoiceId);

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <header className="px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-xl font-bold">Voice Settings</h1>
        <p className="text-sm text-muted">Customize how your Twin sounds</p>
      </header>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Current Voice */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Current Voice</h2>
          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold">{selectedVoice?.name || 'Default Voice'}</p>
              <p className="text-sm text-muted">
                {settings?.isCloned ? '🎤 Your cloned voice' : selectedVoice?.description || 'ElevenLabs voice'}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs ${settings?.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {settings?.enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
        </div>

        {/* Test Voice */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Test Voice</h2>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Enter text to hear how your Twin sounds..."
            rows={3}
            className="w-full bg-white/5 border border-[var(--border)] rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <div className="flex gap-3 mt-4">
            {playing ? (
              <button
                onClick={stopAudio}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                Stop
              </button>
            ) : (
              <button
                onClick={handleTest}
                disabled={!testText.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Play Test
              </button>
            )}
          </div>
        </div>

        {/* Your Cloned Voice */}
        {clonedVoiceId && (
          <div className="glass rounded-2xl p-6 border border-yellow-500/30 bg-yellow-500/5">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>🎤</span>
              Your Cloned Voice
            </h2>
            <button
              type="button"
              onClick={() => selectVoice(clonedVoiceId)}
              className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-4 ${
                selectedVoiceId === clonedVoiceId
                  ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500'
                  : 'bg-white/5 border border-[var(--border)] hover:border-yellow-500/50'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold">My Voice Clone</p>
                <p className="text-sm text-yellow-400">Your personalized AI voice</p>
              </div>
              {selectedVoiceId === clonedVoiceId && (
                <div className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                  Selected
                </div>
              )}
            </button>
          </div>
        )}

        {/* ElevenLabs Voices */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>🔊</span>
            ElevenLabs Voices
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {voices.map((voice, index) => {
              const voiceId = voice.id || voice.voice_id || `voice-${index}`;
              return (
                <button
                  type="button"
                  key={voiceId}
                  onClick={() => selectVoice(voiceId)}
                  className={`p-4 rounded-xl text-left transition-all ${
                    selectedVoiceId === voiceId
                      ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500'
                      : 'bg-white/5 border border-[var(--border)] hover:border-indigo-500/50'
                  }`}
                >
                  <p className="font-medium">{voice.name}</p>
                  <p className="text-xs text-muted mt-1">{voice.description || voice.accent || 'Voice'}</p>
                  {selectedVoiceId === voiceId && (
                    <p className="text-xs text-indigo-400 mt-2">✓ Selected</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Voice Settings */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Voice Parameters</h2>
          <div className="space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Voice Responses</p>
                <p className="text-sm text-muted">Enable AI voice responses</p>
              </div>
              <button
                onClick={() => setSettings((prev) => ({ ...prev, enabled: !prev?.enabled }))}
                className={`w-12 h-6 rounded-full transition-colors ${settings?.enabled ? 'bg-indigo-500' : 'bg-white/20'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-lg transform transition-transform ${settings?.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Stability */}
            <div>
              <div className="flex justify-between mb-2">
                <p className="font-medium">Stability</p>
                <span className="text-sm text-muted">{Math.round((settings?.stability || 0.5) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings?.stability || 0.5}
                onChange={(e) => setSettings((prev) => ({ ...prev, stability: parseFloat(e.target.value) }))}
                className="w-full accent-indigo-500"
              />
              <p className="text-xs text-muted mt-1">Higher = more consistent, Lower = more expressive</p>
            </div>

            {/* Similarity */}
            <div>
              <div className="flex justify-between mb-2">
                <p className="font-medium">Clarity + Similarity</p>
                <span className="text-sm text-muted">{Math.round((settings?.similarityBoost || 0.75) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings?.similarityBoost || 0.75}
                onChange={(e) => setSettings((prev) => ({ ...prev, similarityBoost: parseFloat(e.target.value) }))}
                className="w-full accent-indigo-500"
              />
            </div>

            {/* Speed */}
            <div>
              <div className="flex justify-between mb-2">
                <p className="font-medium">Speed</p>
                <span className="text-sm text-muted">{settings?.speed || 1.0}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings?.speed || 1.0}
                onChange={(e) => setSettings((prev) => ({ ...prev, speed: parseFloat(e.target.value) }))}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 rounded-xl font-medium transition-all"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Voice Cloning */}
        <div className="glass rounded-2xl p-6 border border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🎤</span>
            <h2 className="text-lg font-semibold">Clone Your Voice</h2>
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Premium</span>
          </div>
          <p className="text-sm text-muted mb-4">
            Record your voice or upload audio samples (at least 30 seconds total) to create a custom voice clone.
          </p>

          <div className="space-y-4">
            <input
              type="text"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="Voice name (e.g., 'My Voice')"
              className="w-full px-4 py-3 bg-white/5 border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
            />

            {/* Recording Section */}
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-sm font-medium mb-3">🎙️ Record Your Voice</p>
              
              {isRecording ? (
                <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 font-mono text-lg">{formatRecordingTime(recordingTime)}</span>
                  <span className="text-muted flex-1">Recording... Speak clearly!</span>
                  <button
                    onClick={stopRecording}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-medium transition-colors"
                  >
                    Stop
                  </button>
                </div>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={recordings.length >= 5}
                  className="w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed border-yellow-500/30 hover:border-yellow-500/50 rounded-xl transition-colors disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Click to Record</p>
                    <p className="text-xs text-muted">Read a paragraph or talk naturally for 30+ seconds</p>
                  </div>
                </button>
              )}

              {/* Sample text to read */}
              <div className="mt-3 p-3 bg-black/20 rounded-lg">
                <p className="text-xs text-muted mb-1">💡 Sample text to read:</p>
                <p className="text-sm italic text-muted">
                  "Merhaba, ben [adınız]. Bugün hava çok güzel. Teknoloji hayatımızı her geçen gün daha da kolaylaştırıyor. Yapay zeka ile neler yapabileceğimizi düşünmek bile heyecan verici."
                </p>
              </div>
            </div>

            {/* Recordings List */}
            {recordings.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Your Recordings ({formatRecordingTime(totalRecordingTime)} total)</p>
                {recordings.map((recording) => (
                  <div key={recording.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                    <button
                      onClick={() => playRecording(recording.url)}
                      className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center hover:bg-yellow-500/30 transition-colors"
                    >
                      <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      </svg>
                    </button>
                    <div className="flex-1">
                      <p className="text-sm">Recording {recordings.indexOf(recording) + 1}</p>
                      <p className="text-xs text-muted">{formatRecordingTime(recording.duration)}</p>
                    </div>
                    <button onClick={() => removeRecording(recording.id)} className="text-red-400 hover:text-red-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Or Upload Files */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-[var(--background)] text-sm text-muted">or upload files</span>
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border)] rounded-xl p-4 text-center cursor-pointer hover:border-yellow-500/50 transition-colors"
            >
              <svg className="w-6 h-6 mx-auto text-muted mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-xs text-muted">Upload audio files (MP3, WAV, WebM)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {cloneFiles.length > 0 && (
              <div className="space-y-2">
                {cloneFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-sm truncate">📁 {file.name}</span>
                    <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Progress indicator */}
            {(recordings.length > 0 || cloneFiles.length > 0) && (
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span>Audio samples</span>
                  <span className={totalRecordingTime >= 30 ? 'text-green-400' : 'text-yellow-400'}>
                    {totalRecordingTime >= 30 ? '✓ Ready' : `${30 - totalRecordingTime}s more needed`}
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${totalRecordingTime >= 30 ? 'bg-green-500' : 'bg-yellow-500'}`}
                    style={{ width: `${Math.min(100, (totalRecordingTime / 30) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleClone}
              disabled={cloning || !cloneName.trim() || (cloneFiles.length === 0 && recordings.length === 0) || totalRecordingTime < 30}
              className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 rounded-xl font-medium transition-all"
            >
              {cloning ? 'Cloning Voice...' : 'Clone My Voice'}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="glass rounded-xl p-4 bg-indigo-500/5 border border-indigo-500/20">
          <h4 className="font-medium text-indigo-400 mb-2">ℹ️ About Voice</h4>
          <ul className="text-sm text-muted space-y-1">
            <li>• Powered by ElevenLabs multilingual voice AI</li>
            <li>• Supports Turkish, English, and 28 other languages</li>
            <li>• Voice cloning requires clear audio samples</li>
            <li>• Changes apply to all chat responses</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

