'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

export default function DataSourcesPage() {
  const [dataSources, setDataSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(null); // 'whatsapp' | 'instagram' | 'twitter' | null
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
    if (!selectedFile) return;
    if (showModal !== 'twitter' && !ownerName.trim()) return;

    setUploading(true);
    setUploadError('');

    try {
      if (showModal === 'whatsapp') {
        await api.uploadWhatsApp(selectedFile, ownerName.trim());
      } else if (showModal === 'instagram') {
        await api.uploadInstagram(selectedFile, ownerName.trim());
      } else if (showModal === 'twitter') {
        await api.uploadTwitter(selectedFile);
      }
      closeModal();
      loadDataSources();
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const closeModal = () => {
    setShowModal(null);
    setSelectedFile(null);
    setOwnerName('');
    setUploadError('');
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
      case 'instagram':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        );
      case 'twitter':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
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

  const getTypeColor = (type) => {
    switch (type) {
      case 'whatsapp':
        return 'bg-green-500/10 text-green-400';
      case 'instagram':
        return 'bg-pink-500/10 text-pink-400';
      case 'twitter':
        return 'bg-sky-500/10 text-sky-400';
      default:
        return 'bg-white/5 text-muted';
    }
  };

  const getModalConfig = () => {
    switch (showModal) {
      case 'whatsapp':
        return {
          title: 'Import WhatsApp Chat',
          nameLabel: 'Your Name in Chat',
          namePlaceholder: 'e.g., Tezcan',
          nameHelp: 'Enter your name as it appears in the chat export',
          fileType: '.txt',
          instructions: [
            'Open WhatsApp chat',
            'Tap ⋮ → More → Export chat',
            'Select "Without media"',
            'Save the .txt file',
          ],
        };
      case 'instagram':
        return {
          title: 'Import Instagram Data',
          nameLabel: 'Your Instagram Username',
          namePlaceholder: 'e.g., tezcan_',
          nameHelp: 'Enter your Instagram username',
          fileType: '.zip',
          instructions: [
            'Go to Instagram → Settings',
            'Accounts Center → Your Information and Permissions',
            'Download Your Information',
            'Select JSON format, download',
            'Upload the .zip file here',
          ],
        };
      case 'twitter':
        return {
          title: 'Import Twitter/X Data',
          nameLabel: null, // No name needed
          namePlaceholder: null,
          nameHelp: null,
          fileType: '.zip',
          instructions: [
            'Go to Twitter/X → Settings',
            'Your Account → Download an archive',
            'Request archive and wait for email',
            'Download and upload the .zip file here',
          ],
        };
      default:
        return null;
    }
  };

  const modalConfig = getModalConfig();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl font-bold">Data Sources</h1>
          <p className="text-sm text-muted">Import your data to help your Twin learn</p>
        </div>
      </header>

      {/* Import Options */}
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setShowModal('whatsapp')}
            className="flex items-center gap-3 px-4 py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            <span className="font-medium text-green-400">WhatsApp</span>
          </button>

          <button
            onClick={() => setShowModal('instagram')}
            className="flex items-center gap-3 px-4 py-3 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5 text-pink-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            <span className="font-medium text-pink-400">Instagram</span>
          </button>

          <button
            onClick={() => setShowModal('twitter')}
            className="flex items-center gap-3 px-4 py-3 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span className="font-medium text-sky-400">Twitter/X</span>
          </button>
        </div>
      </div>

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
            <p className="text-muted text-sm max-w-md">
              Import your WhatsApp, Instagram, or Twitter data to help your Twin understand you better.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {dataSources.map((ds) => (
              <div key={ds.id} className="glass rounded-xl p-4 group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getTypeColor(ds.type)}`}>
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
                        <span className="text-indigo-400">{ds.memoriesCreated} memories</span>
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
      {showModal && modalConfig && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl p-6 w-full max-w-md animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{modalConfig.title}</h2>
              <button onClick={closeModal} className="p-2 text-muted hover:text-white transition-colors">
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

              {modalConfig.nameLabel && (
                <div>
                  <label className="block text-sm font-medium mb-2">{modalConfig.nameLabel}</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder={modalConfig.namePlaceholder}
                    className="w-full px-4 py-3 bg-black/50 border border-[var(--border)] rounded-xl focus:outline-none focus:border-primary transition-colors"
                    required
                  />
                  <p className="text-xs text-muted mt-1">{modalConfig.nameHelp}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Export File ({modalConfig.fileType})
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={modalConfig.fileType}
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
                      <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-8 h-8 mx-auto text-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-muted">Click to select {modalConfig.fileType} file</p>
                    </div>
                  )}
                </button>
              </div>

              <div className="bg-white/5 rounded-lg p-4 text-sm text-muted">
                <p className="font-medium text-[var(--foreground)] mb-2">How to export:</p>
                <ol className="list-decimal list-inside space-y-1">
                  {modalConfig.instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>

              <button
                type="submit"
                disabled={uploading || !selectedFile || (modalConfig.nameLabel && !ownerName.trim())}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Import Data'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
