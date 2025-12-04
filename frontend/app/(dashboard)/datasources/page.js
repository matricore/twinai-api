'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

export default function DataSourcesPage() {
  const [dataSources, setDataSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadDataSources();
  }, []);

  const loadDataSources = async () => {
    setLoading(true);
    try {
      const response = await api.getDataSources();
      setDataSources(response.data.dataSources);
    } catch (error) {
      console.error('Failed to load data sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadError('');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !ownerName.trim()) return;

    setUploading(true);
    setUploadError('');

    try {
      await api.uploadWhatsApp(selectedFile, ownerName.trim());
      setShowUploadModal(false);
      setSelectedFile(null);
      setOwnerName('');
      loadDataSources();
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteDataSource = async (id) => {
    if (!confirm('Are you sure? This will also delete all memories from this source.')) return;

    try {
      await api.deleteDataSource(id);
      setDataSources((prev) => prev.filter((ds) => ds.id !== id));
    } catch (error) {
      console.error('Failed to delete data source:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-500/10';
      case 'processing':
        return 'text-yellow-400 bg-yellow-500/10';
      case 'failed':
        return 'text-red-400 bg-red-500/10';
      default:
        return 'text-muted bg-white/5';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'whatsapp':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl font-bold">Data Sources</h1>
          <p className="text-sm text-muted">Import your data to help your Twin learn</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-lg font-medium transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Import Data
        </button>
      </header>

      {/* Data Sources List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : dataSources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">No data sources yet</h2>
            <p className="text-muted text-sm max-w-md mb-4">
              Import your WhatsApp chats, photos, or social media data to help your Twin understand you better.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl font-medium transition-all"
            >
              Import WhatsApp Chat
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {dataSources.map((ds) => (
              <div key={ds.id} className="glass rounded-xl p-4 group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center">
                    {getTypeIcon(ds.type)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{ds.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                      <span className={`px-2 py-1 rounded-md capitalize ${getStatusColor(ds.status)}`}>
                        {ds.status}
                      </span>
                      <span>{ds.totalItems} items</span>
                      {ds.memoriesCreated > 0 && (
                        <span className="text-indigo-400">{ds.memoriesCreated} memories created</span>
                      )}
                      <span>{new Date(ds.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteDataSource(ds.id)}
                    className="p-2 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl p-6 w-full max-w-md animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Import WhatsApp Chat</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                  setOwnerName('');
                  setUploadError('');
                }}
                className="p-2 text-muted hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              {uploadError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {uploadError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Your Name in Chat</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g., Tezcan"
                  className="w-full px-4 py-3 bg-black/50 border border-[var(--border)] rounded-xl focus:outline-none focus:border-primary transition-colors"
                  required
                />
                <p className="text-xs text-muted mt-1">Enter your name as it appears in the chat export</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Chat Export File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-8 bg-black/50 border-2 border-dashed border-[var(--border)] rounded-xl hover:border-primary transition-colors text-center"
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{selectedFile.name}</span>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-8 h-8 mx-auto text-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-muted">Click to select .txt file</p>
                    </div>
                  )}
                </button>
              </div>

              <div className="bg-white/5 rounded-lg p-4 text-sm text-muted">
                <p className="font-medium text-[var(--foreground)] mb-2">How to export:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open WhatsApp chat</li>
                  <li>Tap ⋮ → More → Export chat</li>
                  <li>Select &quot;Without media&quot;</li>
                  <li>Save the .txt file</li>
                </ol>
              </div>

              <button
                type="submit"
                disabled={uploading || !selectedFile || !ownerName.trim()}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Import Chat'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

