'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

const CATEGORIES = [
  { value: null, label: 'All', icon: '📷' },
  { value: 'selfie', label: 'Selfies', icon: '🤳' },
  { value: 'friends', label: 'Friends', icon: '👥' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'food', label: 'Food', icon: '🍕' },
  { value: 'pet', label: 'Pets', icon: '🐾' },
  { value: 'hobby', label: 'Hobbies', icon: '🎨' },
  { value: 'work', label: 'Work', icon: '💼' },
  { value: 'event', label: 'Events', icon: '🎉' },
  { value: 'nature', label: 'Nature', icon: '🌿' },
];

export default function PhotosPage() {
  const [photos, setPhotos] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const loadData = async () => {
    try {
      const [photosRes, statsRes] = await Promise.all([
        api.getPhotos(50, 0, selectedCategory),
        api.getPhotoStats(),
      ]);
      setPhotos(photosRes.data.photos);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Analyzing ${i + 1}/${files.length}: ${file.name}`);
      
      try {
        await api.uploadPhoto(file);
        successCount++;
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      }
    }

    setUploadProgress('');
    setUploading(false);
    fileInputRef.current.value = '';
    
    if (successCount > 0) {
      loadData();
    }
  };

  const handleDelete = async (photoId) => {
    if (!confirm('Delete this photo?')) return;
    
    try {
      await api.deletePhoto(photoId);
      setPhotos(photos.filter(p => p.id !== photoId));
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto(null);
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <header className="px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Photo Analysis</h1>
            <p className="text-sm text-muted">Upload photos to help your Twin understand your life</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 rounded-xl font-medium transition-all"
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            Upload Photos
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
        {uploadProgress && (
          <div className="mt-2 text-sm text-indigo-400">{uploadProgress}</div>
        )}
      </header>

      <div className="p-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-indigo-400">{stats.total}</div>
              <div className="text-sm text-muted">Total Photos</div>
            </div>
            {Object.entries(stats.byCategory || {}).slice(0, 3).map(([cat, count]) => (
              <div key={cat} className="glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-purple-400">{count}</div>
                <div className="text-sm text-muted capitalize">{cat}</div>
              </div>
            ))}
          </div>
        )}

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value || 'all'}
              onClick={() => setSelectedCategory(cat.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                selectedCategory === cat.value
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                  : 'bg-white/5 hover:bg-white/10 text-muted'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Photo Grid */}
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer glass"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                  <span className="text-4xl">
                    {getCategoryEmoji(photo.category)}
                  </span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-sm font-medium truncate">{photo.description || 'Analyzed photo'}</p>
                    <p className="text-xs text-muted capitalize">{photo.category}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass rounded-2xl p-12 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold">No photos yet</h3>
            <p className="text-muted max-w-md mx-auto">
              Upload photos to help your Twin understand your life, interests, and the people around you.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Your First Photo
            </button>
          </div>
        )}

        {/* Tips */}
        <div className="glass rounded-xl p-4 bg-indigo-500/5 border border-indigo-500/20">
          <h4 className="font-medium text-indigo-400 mb-2">📸 Photo Analysis Tips</h4>
          <ul className="text-sm text-muted space-y-1">
            <li>• Selfies help understand your appearance and style</li>
            <li>• Group photos reveal your social connections</li>
            <li>• Travel/food/hobby photos show your interests</li>
            <li>• Your Twin learns from every photo you share</li>
          </ul>
        </div>
      </div>

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getCategoryEmoji(selectedPhoto.category)}</span>
                  <div>
                    <h3 className="font-semibold capitalize">{selectedPhoto.category}</h3>
                    <p className="text-xs text-muted">
                      {new Date(selectedPhoto.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Description */}
              {selectedPhoto.description && (
                <p className="text-muted">{selectedPhoto.description}</p>
              )}

              {/* Analysis */}
              {selectedPhoto.analysis && (
                <div className="space-y-4">
                  {/* Emotions */}
                  {selectedPhoto.analysis.emotions?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted mb-2">Emotions Detected</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedPhoto.analysis.emotions.map((e, i) => (
                          <span key={i} className="px-3 py-1 bg-pink-500/20 border border-pink-500/30 rounded-full text-sm">
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Objects */}
                  {selectedPhoto.analysis.objects?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted mb-2">Objects Detected</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedPhoto.analysis.objects.map((o, i) => (
                          <span key={i} className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-sm">
                            {o}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Insights */}
                  {selectedPhoto.analysis.insights?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted mb-2">Insights Learned</h4>
                      <div className="space-y-2">
                        {selectedPhoto.analysis.insights.map((insight, i) => (
                          <div key={i} className="p-3 bg-white/5 rounded-lg">
                            <p className="font-medium">{insight.key}</p>
                            <p className="text-sm text-muted">{insight.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  {selectedPhoto.analysis.location?.place && (
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {selectedPhoto.analysis.location.place}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
                <button
                  onClick={() => {
                    handleDelete(selectedPhoto.id);
                  }}
                  className="px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getCategoryEmoji(category) {
  const emojis = {
    selfie: '🤳',
    friends: '👥',
    family: '👨‍👩‍👧‍👦',
    travel: '✈️',
    food: '🍕',
    pet: '🐾',
    hobby: '🎨',
    work: '💼',
    event: '🎉',
    nature: '🌿',
    other: '📷',
  };
  return emojis[category] || '📷';
}

