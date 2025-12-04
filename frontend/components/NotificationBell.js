'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    loadNotifications();
    // Poll for new notifications every 2 minutes
    const interval = setInterval(loadNotifications, 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await api.getNotifications(10);
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    setLoading(true);
    try {
      if (!notification.isRead) {
        await api.markNotificationRead(notification.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
      }

      // Navigate based on action type
      switch (notification.actionType) {
        case 'chat':
          router.push('/chat');
          break;
        case 'question':
          router.push('/questions');
          break;
        case 'dashboard':
          router.push('/dashboard');
          break;
        case 'memory':
          router.push('/memories');
          break;
        default:
          break;
      }
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to handle notification:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'greeting':
        return '👋';
      case 'check_in':
        return '🌙';
      case 'insight':
        return '💡';
      case 'question':
        return '❓';
      case 'suggestion':
        return '💭';
      case 'milestone':
        return '🎯';
      default:
        return '🔔';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'greeting':
        return 'bg-yellow-500/20 border-yellow-500/30';
      case 'check_in':
        return 'bg-purple-500/20 border-purple-500/30';
      case 'insight':
        return 'bg-cyan-500/20 border-cyan-500/30';
      case 'question':
        return 'bg-pink-500/20 border-pink-500/30';
      case 'milestone':
        return 'bg-green-500/20 border-green-500/30';
      default:
        return 'bg-indigo-500/20 border-indigo-500/30';
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-white/5 rounded-lg transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 glass rounded-xl border border-[var(--border)] shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                  <svg className="w-6 h-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-muted text-sm">No notifications yet</p>
                <p className="text-xs text-muted mt-1">Your Twin will reach out soon!</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    disabled={loading}
                    className={`w-full p-4 text-left hover:bg-white/5 transition-colors ${
                      !notification.isRead ? 'bg-indigo-500/5' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`w-10 h-10 rounded-lg ${getTypeColor(notification.type)} border flex items-center justify-center flex-shrink-0`}>
                        <span className="text-lg">{getTypeIcon(notification.type)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{notification.title}</p>
                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-muted line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-muted mt-1">{formatTime(notification.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

