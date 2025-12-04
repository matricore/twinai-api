'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.getTwinDashboard();
      setData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted">Failed to load dashboard</p>
      </div>
    );
  }

  const { profile, dataSources, conversations } = data;

  // Calculate personality completeness
  const hasPersonality = Object.keys(profile.personalityTraits || {}).length > 0;
  const hasStyle = Object.keys(profile.communicationStyle || {}).length > 0;
  const hasInterests = (profile.interests || []).length > 0;
  const completeness = [hasPersonality, hasStyle, hasInterests, profile.stats.memories.total > 0].filter(Boolean).length * 25;

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <header className="px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-xl font-bold">Twin Dashboard</h1>
        <p className="text-sm text-muted">See what your Twin has learned about you</p>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<BrainIcon />}
            label="Memories"
            value={profile.stats.memories.total}
            color="indigo"
          />
          <StatCard
            icon={<LightbulbIcon />}
            label="Insights"
            value={profile.stats.insights.total}
            color="purple"
          />
          <StatCard
            icon={<ChatIcon />}
            label="Conversations"
            value={conversations.totalConversations}
            color="pink"
          />
          <StatCard
            icon={<DatabaseIcon />}
            label="Data Sources"
            value={dataSources.total}
            color="cyan"
          />
        </div>

        {/* Profile Completeness */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Twin Knowledge</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <span className="text-sm font-medium">{completeness}%</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <CompletionItem done={hasPersonality} label="Personality" />
            <CompletionItem done={hasStyle} label="Communication Style" />
            <CompletionItem done={hasInterests} label="Interests" />
            <CompletionItem done={profile.stats.memories.total > 0} label="Memories" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Interests */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <HeartIcon />
              Your Interests
            </h2>
            {profile.interests?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-full text-sm"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm">
                No interests detected yet. Chat more or import data!
              </p>
            )}
          </div>

          {/* Communication Style */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageIcon />
              Communication Style
            </h2>
            {Object.keys(profile.communicationStyle || {}).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(profile.communicationStyle).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-muted capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="font-medium capitalize">{String(value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm">
                Communication style not analyzed yet.
              </p>
            )}
          </div>
        </div>

        {/* Memory Distribution */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Memory Distribution</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(profile.stats.memories.byCategory || {}).map(([category, count]) => (
              <div key={category} className="text-center p-4 bg-white/5 rounded-xl">
                <div className="text-2xl font-bold text-indigo-400">{count}</div>
                <div className="text-sm text-muted capitalize">{category}</div>
              </div>
            ))}
            {Object.keys(profile.stats.memories.byCategory || {}).length === 0 && (
              <p className="text-muted text-sm col-span-full text-center py-4">
                No memories yet. Start chatting or import data!
              </p>
            )}
          </div>
        </div>

        {/* Data Sources */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Data Sources Overview</h2>
          {dataSources.total > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(dataSources.byType || {}).map(([type, stats]) => (
                <div key={type} className="p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <SourceIcon type={type} />
                    <span className="font-medium capitalize">{type}</span>
                  </div>
                  <div className="text-sm text-muted">
                    <p>{stats.items} items imported</p>
                    <p>{stats.memories} memories created</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm">
              No data sources connected. Import WhatsApp, Instagram, or Twitter data!
            </p>
          )}
        </div>

        {/* Recent Insights */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Insights</h2>
          {profile.stats.insights.total > 0 ? (
            <div className="space-y-3">
              {[
                ...(profile.insights.personality || []).slice(0, 3),
                ...(profile.insights.preference || []).slice(0, 3),
                ...(profile.insights.behavior || []).slice(0, 2),
              ].slice(0, 6).map((insight, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    insight.category === 'personality' ? 'bg-purple-400' :
                    insight.category === 'preference' ? 'bg-pink-400' :
                    'bg-cyan-400'
                  }`} />
                  <div>
                    <p className="font-medium">{insight.key}</p>
                    <p className="text-sm text-muted">{insight.value}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted capitalize">{insight.category}</span>
                      <span className="text-xs text-muted">•</span>
                      <span className="text-xs text-indigo-400">{Math.round(insight.confidence * 100)}% confidence</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm">
              No insights yet. Your Twin is still learning!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Components
function StatCard({ icon, label, value, color }) {
  const colors = {
    indigo: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/30 text-indigo-400',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400',
    pink: 'from-pink-500/20 to-pink-500/5 border-pink-500/30 text-pink-400',
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 text-cyan-400',
  };

  return (
    <div className={`p-4 rounded-xl bg-gradient-to-br border ${colors[color]}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/10 rounded-lg">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

function CompletionItem({ done, label }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      <span className={done ? 'text-white' : 'text-muted'}>{label}</span>
    </div>
  );
}

function SourceIcon({ type }) {
  switch (type) {
    case 'whatsapp':
      return <div className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center">W</div>;
    case 'instagram':
      return <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center">I</div>;
    case 'twitter':
      return <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">X</div>;
    default:
      return <div className="w-8 h-8 rounded-lg bg-white/10 text-muted flex items-center justify-center">?</div>;
  }
}

// Icons
function BrainIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  );
}

