'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function QuestionsPage() {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [questionRes, statsRes] = await Promise.all([
        api.getNextQuestion(),
        api.getQuestionStats(),
      ]);
      setCurrentQuestion(questionRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async () => {
    if (!answer.trim() || !currentQuestion) return;

    setSubmitting(true);
    try {
      await api.answerQuestion(currentQuestion.id, answer.trim());
      setAnswer('');
      // Load next question
      const [questionRes, statsRes] = await Promise.all([
        api.getNextQuestion(),
        api.getQuestionStats(),
      ]);
      setCurrentQuestion(questionRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to answer:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!currentQuestion) return;

    setSubmitting(true);
    try {
      await api.skipQuestion(currentQuestion.id);
      const questionRes = await api.getNextQuestion();
      setCurrentQuestion(questionRes.data);
    } catch (error) {
      console.error('Failed to skip:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getAnsweredQuestions(20, 0);
      setHistory(res.data.questions);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    if (!showHistory && history.length === 0) {
      loadHistory();
    }
    setShowHistory(!showHistory);
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
        <h1 className="text-xl font-bold">Twin Questions</h1>
        <p className="text-sm text-muted">Help your Twin understand you better</p>
      </header>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.answered}</div>
              <div className="text-sm text-muted">Answered</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
              <div className="text-sm text-muted">Pending</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-400">{stats.skipped}</div>
              <div className="text-sm text-muted">Skipped</div>
            </div>
          </div>
        )}

        {/* Current Question Card */}
        {currentQuestion ? (
          <div className="glass rounded-2xl p-6 space-y-6">
            {/* Category Badge */}
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(currentQuestion.category)}`}>
                {formatCategory(currentQuestion.category)}
              </span>
              {currentQuestion.skippedCount > 0 && (
                <span className="text-xs text-muted">
                  Skipped {currentQuestion.skippedCount}x
                </span>
              )}
            </div>

            {/* Question */}
            <div className="py-4">
              <h2 className="text-2xl font-semibold leading-relaxed">
                {currentQuestion.question}
              </h2>
              {currentQuestion.context && (
                <p className="text-sm text-muted mt-2 italic">
                  💡 {currentQuestion.context}
                </p>
              )}
            </div>

            {/* Answer Input */}
            <div className="space-y-4">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer here..."
                rows={4}
                className="w-full bg-white/5 border border-[var(--border)] rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                disabled={submitting}
              />

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleAnswer}
                  disabled={!answer.trim() || submitting}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Submit Answer
                    </>
                  )}
                </button>
                <button
                  onClick={handleSkip}
                  disabled={submitting}
                  className="py-3 px-6 bg-white/5 hover:bg-white/10 border border-[var(--border)] rounded-xl font-medium transition-all disabled:opacity-50"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold">All caught up!</h3>
            <p className="text-muted">
              No pending questions. Your Twin is learning from your conversations and data.
            </p>
            <button
              onClick={async () => {
                setLoading(true);
                await api.generateQuestions(5);
                await loadData();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Generate More Questions
            </button>
          </div>
        )}

        {/* History Toggle */}
        <div className="flex justify-center">
          <button
            onClick={toggleHistory}
            className="flex items-center gap-2 text-sm text-muted hover:text-white transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showHistory ? 'Hide History' : 'Show Answer History'}
          </button>
        </div>

        {/* History */}
        {showHistory && (
          <div className="space-y-4">
            <h3 className="font-semibold">Your Answers</h3>
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-3">
                {history.map((q) => (
                  <div key={q.id} className="glass rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(q.category)}`}>
                        {formatCategory(q.category)}
                      </span>
                      <span className="text-xs text-muted">
                        {new Date(q.answeredAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="font-medium">{q.question}</p>
                    <p className="text-sm text-muted bg-white/5 rounded-lg p-3">
                      {q.answer}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted py-4">No answers yet</p>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="glass rounded-xl p-4 bg-indigo-500/5 border border-indigo-500/20">
          <h4 className="font-medium text-indigo-400 mb-2">💡 Tips for Better Answers</h4>
          <ul className="text-sm text-muted space-y-1">
            <li>• Be honest and authentic - your Twin learns from real you</li>
            <li>• Details matter - specific examples help more than general statements</li>
            <li>• It's okay to skip - come back to questions you're unsure about</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function getCategoryColor(category) {
  const colors = {
    personality: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    preferences: 'bg-pink-500/20 text-pink-300 border border-pink-500/30',
    relationships: 'bg-red-500/20 text-red-300 border border-red-500/30',
    experiences: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    goals: 'bg-green-500/20 text-green-300 border border-green-500/30',
    daily_life: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  };
  return colors[category] || 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
}

function formatCategory(category) {
  const labels = {
    personality: '🧠 Personality',
    preferences: '❤️ Preferences',
    relationships: '👥 Relationships',
    experiences: '⭐ Experiences',
    goals: '🎯 Goals',
    daily_life: '☀️ Daily Life',
  };
  return labels[category] || category;
}

