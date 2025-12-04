const prisma = require('../config/database');
const { model } = require('../config/gemini');
const ApiError = require('../utils/ApiError');

// Notification types and their triggers
const NOTIFICATION_TRIGGERS = {
  greeting: {
    cooldownHours: 20, // Once per day
    timeRange: { start: 7, end: 11 }, // Morning hours
  },
  check_in: {
    cooldownHours: 8,
    timeRange: { start: 17, end: 22 }, // Evening hours
  },
  insight: {
    cooldownHours: 24,
    minInsights: 1, // Need new insights
  },
  question: {
    cooldownHours: 12,
    maxPending: 3, // Don't spam questions
  },
  suggestion: {
    cooldownHours: 48,
  },
  milestone: {
    cooldownHours: 24,
  },
};

/**
 * Generate proactive notifications for a user
 */
const generateNotifications = async (userId) => {
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
    include: {
      insights: { orderBy: { createdAt: 'desc' }, take: 10 },
      memories: { orderBy: { createdAt: 'desc' }, take: 10 },
      questions: { where: { status: 'pending' }, take: 5 },
    },
  });

  if (!twin) {
    return [];
  }

  // Get user's recent activity
  const [lastConversation, recentNotifications, user] = await Promise.all([
    prisma.conversation.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.twinNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, createdAt: true },
    }),
  ]);

  const currentHour = new Date().getHours();
  const notifications = [];

  // Check each notification type
  for (const [type, config] of Object.entries(NOTIFICATION_TRIGGERS)) {
    // Check cooldown
    const lastOfType = recentNotifications.find((n) => n.type === type);
    if (lastOfType) {
      const hoursSince = (Date.now() - new Date(lastOfType.createdAt).getTime()) / (1000 * 60 * 60);
      if (hoursSince < config.cooldownHours) {
        continue;
      }
    }

    // Check time range if specified
    if (config.timeRange) {
      if (currentHour < config.timeRange.start || currentHour > config.timeRange.end) {
        continue;
      }
    }

    // Generate notification based on type
    let notification = null;

    switch (type) {
      case 'greeting':
        notification = await generateGreeting(user, twin, lastConversation);
        break;
      case 'check_in':
        notification = await generateCheckIn(user, twin, lastConversation);
        break;
      case 'insight':
        if (twin.insights.length >= (config.minInsights || 0)) {
          notification = await generateInsightNotification(twin);
        }
        break;
      case 'question':
        if (twin.questions.length < (config.maxPending || 5)) {
          notification = await generateQuestionNotification(twin, user);
        }
        break;
      case 'suggestion':
        notification = await generateSuggestion(twin, user);
        break;
      case 'milestone':
        notification = await checkMilestones(userId, twin);
        break;
    }

    if (notification) {
      notifications.push(notification);
    }
  }

  // Save notifications
  const created = [];
  for (const notif of notifications) {
    const saved = await prisma.twinNotification.create({
      data: {
        userId,
        ...notif,
      },
    });
    created.push(saved);
  }

  return created;
};

/**
 * Generate morning greeting
 */
const generateGreeting = async (user, twin, lastConversation) => {
  const name = user?.name?.split(' ')[0] || 'there';
  const daysSinceChat = lastConversation
    ? Math.floor((Date.now() - new Date(lastConversation.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const interests = twin.interests?.slice(0, 3).join(', ') || '';
  
  const prompt = `Generate a friendly, personalized morning greeting for ${name}.
Context:
- Days since last chat: ${daysSinceChat}
- Their interests: ${interests}
- Personality: ${JSON.stringify(twin.personalityTraits || {})}

Make it warm, brief (1-2 sentences), and slightly personalized based on their interests.
Return JSON: { "title": "short title", "message": "greeting message" }`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
    
    return {
      type: 'greeting',
      title: json.title || `Good morning, ${name}! ☀️`,
      message: json.message || `How are you today? I'm here if you want to chat!`,
      actionType: 'chat',
    };
  } catch {
    return {
      type: 'greeting',
      title: `Good morning, ${name}! ☀️`,
      message: daysSinceChat > 3 
        ? `It's been a while! I'd love to catch up with you.`
        : `Hope you're having a great day! I'm here if you need anything.`,
      actionType: 'chat',
    };
  }
};

/**
 * Generate evening check-in
 */
const generateCheckIn = async (user, twin, lastConversation) => {
  const name = user?.name?.split(' ')[0] || '';
  
  const prompts = [
    `Hey${name ? ` ${name}` : ''}! How was your day? 🌙`,
    `Evening${name ? `, ${name}` : ''}! Anything interesting happen today?`,
    `Hope you had a good day${name ? `, ${name}` : ''}! Want to share what's on your mind?`,
  ];

  return {
    type: 'check_in',
    title: 'Evening Check-in 🌙',
    message: prompts[Math.floor(Math.random() * prompts.length)],
    actionType: 'chat',
  };
};

/**
 * Generate insight notification
 */
const generateInsightNotification = async (twin) => {
  const recentInsight = twin.insights[0];
  if (!recentInsight) return null;

  return {
    type: 'insight',
    title: '💡 New Insight',
    message: `I learned something about you: "${recentInsight.value}"`,
    context: `Discovered from ${recentInsight.source || 'our conversations'}`,
    actionType: 'dashboard',
  };
};

/**
 * Generate follow-up question
 */
const generateQuestionNotification = async (twin, user) => {
  const interests = twin.interests || [];
  const name = user?.name?.split(' ')[0] || '';

  const questionPrompts = [
    interests.length > 0 
      ? `I noticed you're into ${interests[0]}. What got you interested in that?`
      : `What's something you're really passionate about?`,
    `What's been the highlight of your week so far?`,
    `Is there anything you've been wanting to talk about?`,
  ];

  return {
    type: 'question',
    title: '❓ Quick Question',
    message: questionPrompts[Math.floor(Math.random() * questionPrompts.length)],
    actionType: 'chat',
  };
};

/**
 * Generate suggestion
 */
const generateSuggestion = async (twin, user) => {
  const interests = twin.interests || [];
  
  if (interests.length === 0) {
    return {
      type: 'suggestion',
      title: '💡 Suggestion',
      message: 'Try answering some questions to help me understand you better!',
      actionType: 'question',
    };
  }

  return null; // Skip if no relevant suggestion
};

/**
 * Check for milestones
 */
const checkMilestones = async (userId, twin) => {
  const [messageCount, memoryCount, photoCount] = await Promise.all([
    prisma.message.count({ where: { conversation: { userId } } }),
    prisma.memory.count({ where: { twinId: twin.id } }),
    prisma.photo.count({ where: { userId } }).catch(() => 0),
  ]);

  const milestones = [
    { threshold: 10, type: 'messages', message: '🎉 We\'ve exchanged 10 messages! Getting to know you.' },
    { threshold: 50, type: 'messages', message: '🎉 50 messages! Our conversations are really helping me understand you.' },
    { threshold: 100, type: 'messages', message: '🎉 100 messages! We\'ve come a long way together.' },
    { threshold: 10, type: 'memories', message: '🧠 I\'ve learned 10 things about you!' },
    { threshold: 50, type: 'memories', message: '🧠 50 memories! I\'m really getting to know you.' },
    { threshold: 5, type: 'photos', message: '📸 5 photos analyzed! Your life looks interesting.' },
  ];

  for (const milestone of milestones) {
    const count = milestone.type === 'messages' ? messageCount :
                  milestone.type === 'memories' ? memoryCount : photoCount;
    
    if (count >= milestone.threshold && count < milestone.threshold + 5) {
      // Check if already notified
      const existing = await prisma.twinNotification.findFirst({
        where: {
          userId,
          type: 'milestone',
          message: { contains: milestone.threshold.toString() },
        },
      });
      
      if (!existing) {
        return {
          type: 'milestone',
          title: 'Milestone Reached! 🎯',
          message: milestone.message,
          actionType: 'dashboard',
        };
      }
    }
  }

  return null;
};

/**
 * Get unread notifications
 */
const getNotifications = async (userId, limit = 20) => {
  // First, try to generate new notifications
  await generateNotifications(userId).catch(() => {});

  const notifications = await prisma.twinNotification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const unreadCount = await prisma.twinNotification.count({
    where: { userId, isRead: false },
  });

  return { notifications, unreadCount };
};

/**
 * Mark notification as read
 */
const markAsRead = async (userId, notificationId) => {
  const notification = await prisma.twinNotification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    throw ApiError.notFound('Notification not found');
  }

  return prisma.twinNotification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
};

/**
 * Mark all as read
 */
const markAllAsRead = async (userId) => {
  await prisma.twinNotification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
};

/**
 * Delete notification
 */
const deleteNotification = async (userId, notificationId) => {
  const notification = await prisma.twinNotification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    throw ApiError.notFound('Notification not found');
  }

  await prisma.twinNotification.delete({ where: { id: notificationId } });
};

module.exports = {
  generateNotifications,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};

