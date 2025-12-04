'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

const categories = [
  { value: '', label: 'All' },
  { value: 'fact', label: 'Facts' },
  { value: 'preference', label: 'Preferences' },
  { value: 'experience', label: 'Experiences' },
  { value: 'relationship', label: 'Relationships' },
  { value: 'habit', label: 'Habits' },
];

export default function MemoriesPage() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadMemories();
  }, [selectedCategory]);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const response = await api.getMemories(1, 50, selectedCategory || null);
      setMemories(response.data.memories);
    } catch (error) {
      console.error('Failed to load memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    try {
      const response = await api.searchMemories(searchQuery);
      setSearchResults(response.data.memories);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const deleteMemory = async (id) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;
    
    try {
      await api.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      if (searchResults) {
        setSearchResults((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  const displayMemories = searchResults || memories;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-xl font-bold">Memories</h1>
        <p className="text-sm text-muted">What your Twin has learned about you</p>
      </header>

      {/* Search & Filter */}
      <div className="px-6 py-4 border-b border-[var(--border)] space-y-4">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories semantically..."
              className="w-full px-4 py-3 pl-10 bg-[var(--card)] border border-[var(--border)] rounded-xl focus:outline-none focus:border-primary transition-colors"
            />
            <svg className="w-5 h-5 text-muted absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
          {searchResults && (
            <button
              type="button"
              onClick={clearSearch}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-[var(--border)] rounded-xl transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        {!searchResults && (
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 text-sm rounded-full transition-all ${
                  selectedCategory === cat.value
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                    : 'bg-white/5 hover:bg-white/10 text-muted hover:text-white border border-[var(--border)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Memories List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">No memories yet</h2>
            <p className="text-muted text-sm max-w-md">
              {searchResults
                ? 'No memories found matching your search.'
                : 'Start chatting with your Twin or import data to create memories.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {searchResults && (
              <p className="text-sm text-muted mb-2">
                Found {searchResults.length} memories matching &quot;{searchQuery}&quot;
              </p>
            )}
            {displayMemories.map((memory) => (
              <div
                key={memory.id}
                className="glass rounded-xl p-4 hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-[var(--foreground)]">{memory.content}</p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted">
                      <span className="px-2 py-1 bg-white/5 rounded-md capitalize">{memory.category}</span>
                      {memory.source && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          {memory.source}
                        </span>
                      )}
                      {memory.similarity && (
                        <span className="text-indigo-400">
                          {Math.round(memory.similarity * 100)}% match
                        </span>
                      )}
                      <span>{new Date(memory.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMemory(memory.id)}
                    className="p-2 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

