const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');
const geminiService = require('./gemini.service');
const memoryService = require('./memory.service');
const { generateEmbedding, toVectorString } = require('./embedding.service');

/**
 * Send message and get AI response with memory-augmented context
 */
const sendMessage = async (userId, { message, conversationId }) => {
  // Get or create conversation
  let conversation;

  if (conversationId) {
    conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { role: true, content: true },
        },
      },
    });

    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }
  } else {
    conversation = await prisma.conversation.create({
      data: { userId },
      include: { messages: true },
    });
  }

  // Get twin profile
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
  });

  if (!twin) {
    throw ApiError.notFound('Twin profile not found');
  }

  // Search relevant memories based on user's message
  let relevantMemories = [];
  try {
    relevantMemories = await memoryService.searchMemories(twin.id, message, {
      limit: 5,
      minSimilarity: 0.4,
    });
  } catch {
    // Continue without memories if search fails
  }

  // Generate AI response with memory context
  const history = conversation.messages.reverse();
  const aiResponse = await geminiService.generateChatResponse({
    message,
    twinProfile: twin,
    history,
    relevantMemories,
  });

  // Save user message
  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: message,
    },
  });

  // Save assistant message
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: aiResponse,
    },
  });

  // Background: Generate embedding and update user message
  generateEmbedding(message).then((embedding) => {
    if (embedding) {
      const vectorStr = toVectorString(embedding);
      prisma.$executeRawUnsafe(
        `UPDATE messages SET embedding = '${vectorStr}'::vector WHERE id = '${userMessage.id}'`
      ).catch(() => {});
    }
  });

  // Background: Analyze message and store memories
  analyzeAndStoreMemories(twin.id, message, history).catch(() => {});

  // Update conversation title if first message
  if (!conversationId) {
    const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
    prisma.conversation
      .update({
        where: { id: conversation.id },
        data: { title },
      })
      .catch(() => {});
  }

  return {
    conversationId: conversation.id,
    messageId: assistantMessage.id,
    reply: aiResponse,
    memoriesUsed: relevantMemories.length,
  };
};

/**
 * Analyze message and store memories/insights (background task)
 */
const analyzeAndStoreMemories = async (twinId, message, history) => {
  const analysis = await geminiService.analyzeMessage(
    message,
    history.slice(-5).map((m) => ({ role: m.role, content: m.content }))
  );

  // Store insights
  if (analysis.insights?.length) {
    const insightData = analysis.insights
      .filter((i) => i.confidence > 0.6)
      .map((i) => ({
        twinId,
        category: i.category,
        key: i.key,
        value: i.value,
        confidence: i.confidence,
        source: 'chat',
      }));

    if (insightData.length) {
      await prisma.insight.createMany({ data: insightData });
    }
  }

  // Store memories
  if (analysis.memories?.length) {
    for (const mem of analysis.memories.filter((m) => m.importance > 0.5)) {
      try {
        await memoryService.createMemory(twinId, {
          content: mem.content,
          summary: mem.summary,
          category: mem.category,
          source: 'chat',
          importance: mem.importance,
        });
      } catch {
        // Continue if memory creation fails
      }
    }
  }
};

/**
 * Get user's conversations
 */
const getConversations = async (userId, { page, limit }) => {
  const skip = (page - 1) * limit;

  const [conversations, total] = await prisma.$transaction([
    prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversation.count({ where: { userId } }),
  ]);

  return {
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      messageCount: c._count.messages,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get single conversation with messages
 */
const getConversation = async (userId, conversationId) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) {
    throw ApiError.notFound('Conversation not found');
  }

  return conversation;
};

/**
 * Delete conversation
 */
const deleteConversation = async (userId, conversationId) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true },
  });

  if (!conversation) {
    throw ApiError.notFound('Conversation not found');
  }

  await prisma.conversation.delete({ where: { id: conversationId } });
};

/**
 * Search through conversation history using semantic search
 */
const searchConversations = async (userId, query, limit = 10) => {
  const queryEmbedding = await generateEmbedding(query);
  
  if (!queryEmbedding) {
    return [];
  }

  const vectorStr = toVectorString(queryEmbedding);

  const results = await prisma.$queryRawUnsafe(`
    SELECT 
      m.id,
      m.content,
      m.role,
      m.created_at as "createdAt",
      c.id as "conversationId",
      c.title as "conversationTitle",
      1 - (m.embedding <=> '${vectorStr}'::vector) as similarity
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.user_id = '${userId}'
      AND m.embedding IS NOT NULL
      AND m.role = 'user'
    ORDER BY m.embedding <=> '${vectorStr}'::vector
    LIMIT ${limit}
  `);

  return results;
};

module.exports = {
  sendMessage,
  getConversations,
  getConversation,
  deleteConversation,
  searchConversations,
};
