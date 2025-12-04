const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');

/**
 * Get comprehensive twin profile with stats
 */
const getTwinProfile = async (userId) => {
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
    include: {
      insights: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      memories: {
        select: {
          id: true,
          category: true,
          source: true,
          importance: true,
          createdAt: true,
        },
      },
    },
  });

  if (!twin) {
    throw ApiError.notFound('Twin profile not found');
  }

  // Calculate memory stats
  const memoryStats = {
    total: twin.memories.length,
    byCategory: {},
    bySource: {},
    avgImportance: 0,
  };

  let totalImportance = 0;
  for (const memory of twin.memories) {
    // By category
    memoryStats.byCategory[memory.category] = (memoryStats.byCategory[memory.category] || 0) + 1;
    // By source
    if (memory.source) {
      memoryStats.bySource[memory.source] = (memoryStats.bySource[memory.source] || 0) + 1;
    }
    totalImportance += memory.importance || 0;
  }
  memoryStats.avgImportance = twin.memories.length > 0 
    ? (totalImportance / twin.memories.length).toFixed(2) 
    : 0;

  // Calculate insight stats
  const insightStats = {
    total: twin.insights.length,
    byCategory: {},
    avgConfidence: 0,
  };

  let totalConfidence = 0;
  for (const insight of twin.insights) {
    insightStats.byCategory[insight.category] = (insightStats.byCategory[insight.category] || 0) + 1;
    totalConfidence += insight.confidence || 0;
  }
  insightStats.avgConfidence = twin.insights.length > 0 
    ? (totalConfidence / twin.insights.length).toFixed(2) 
    : 0;

  // Group insights by category for display
  const groupedInsights = {
    personality: twin.insights.filter((i) => i.category === 'personality'),
    preference: twin.insights.filter((i) => i.category === 'preference'),
    behavior: twin.insights.filter((i) => i.category === 'behavior'),
    other: twin.insights.filter((i) => !['personality', 'preference', 'behavior'].includes(i.category)),
  };

  return {
    id: twin.id,
    personalityTraits: twin.personalityTraits,
    communicationStyle: twin.communicationStyle,
    interests: twin.interests,
    preferences: twin.preferences,
    learnedFacts: twin.learnedFacts,
    lastAnalyzedAt: twin.lastAnalyzedAt,
    createdAt: twin.createdAt,
    stats: {
      memories: memoryStats,
      insights: insightStats,
    },
    insights: groupedInsights,
  };
};

/**
 * Get data sources summary
 */
const getDataSourcesSummary = async (userId) => {
  const dataSources = await prisma.dataSource.findMany({
    where: { userId },
    select: {
      id: true,
      type: true,
      name: true,
      status: true,
      totalItems: true,
      memoriesCreated: true,
      processedAt: true,
    },
  });

  const summary = {
    total: dataSources.length,
    completed: dataSources.filter((ds) => ds.status === 'completed').length,
    totalItems: dataSources.reduce((sum, ds) => sum + (ds.totalItems || 0), 0),
    totalMemories: dataSources.reduce((sum, ds) => sum + (ds.memoriesCreated || 0), 0),
    byType: {},
  };

  for (const ds of dataSources) {
    if (!summary.byType[ds.type]) {
      summary.byType[ds.type] = { count: 0, items: 0, memories: 0 };
    }
    summary.byType[ds.type].count++;
    summary.byType[ds.type].items += ds.totalItems || 0;
    summary.byType[ds.type].memories += ds.memoriesCreated || 0;
  }

  return summary;
};

/**
 * Get conversation stats
 */
const getConversationStats = async (userId) => {
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    select: {
      id: true,
      createdAt: true,
      _count: { select: { messages: true } },
    },
  });

  const totalMessages = await prisma.message.count({
    where: { conversation: { userId } },
  });

  const userMessages = await prisma.message.count({
    where: { conversation: { userId }, role: 'user' },
  });

  return {
    totalConversations: conversations.length,
    totalMessages,
    userMessages,
    assistantMessages: totalMessages - userMessages,
    avgMessagesPerConversation: conversations.length > 0 
      ? (totalMessages / conversations.length).toFixed(1) 
      : 0,
  };
};

module.exports = {
  getTwinProfile,
  getDataSourcesSummary,
  getConversationStats,
};

