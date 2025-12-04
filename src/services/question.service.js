const prisma = require('../config/database');
const { model } = require('../config/gemini');
const embeddingService = require('./embedding.service');
const memoryService = require('./memory.service');
const ApiError = require('../utils/ApiError');

// Question categories and their importance
const QUESTION_CATEGORIES = {
  personality: {
    weight: 10,
    examples: [
      'How would your friends describe you in three words?',
      'What do you value most in life?',
      'How do you typically handle stress?',
    ],
  },
  preferences: {
    weight: 8,
    examples: [
      'What kind of music gets you going?',
      'Morning person or night owl?',
      'Coffee or tea?',
    ],
  },
  relationships: {
    weight: 9,
    examples: [
      'Who are the most important people in your life?',
      'How do you prefer to spend time with friends?',
      'What qualities do you value in a friend?',
    ],
  },
  experiences: {
    weight: 7,
    examples: [
      'What was a defining moment in your life?',
      'Tell me about your favorite travel memory',
      'What achievement are you most proud of?',
    ],
  },
  goals: {
    weight: 8,
    examples: [
      'Where do you see yourself in 5 years?',
      'What skill would you love to master?',
      'What is your biggest dream?',
    ],
  },
  daily_life: {
    weight: 6,
    examples: [
      'Walk me through your ideal day',
      'What does your morning routine look like?',
      'How do you like to unwind after work?',
    ],
  },
};

/**
 * Generate new questions for the twin
 */
const generateQuestions = async (userId, count = 5) => {
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
    include: {
      insights: { take: 50 },
      memories: { take: 100 },
      questions: {
        where: { status: 'pending' },
        take: 20,
      },
    },
  });

  if (!twin) {
    throw ApiError.notFound('Twin profile not found');
  }

  // Build context about what we already know
  const knownContext = buildKnownContext(twin);
  const existingQuestions = twin.questions.map((q) => q.question);

  // Generate questions using Gemini
  const prompt = `You are helping build a digital twin of a person. Based on what we know about them, generate ${count} thoughtful questions to learn more.

WHAT WE KNOW:
${knownContext || 'Very little - this is a new user!'}

EXISTING PENDING QUESTIONS (don't repeat these):
${existingQuestions.join('\n') || 'None'}

CATEGORIES TO COVER:
- personality: Who they are as a person
- preferences: What they like/dislike
- relationships: People in their life
- experiences: Past events and memories
- goals: Future aspirations
- daily_life: Routines and habits

GUIDELINES:
1. Ask open-ended questions that reveal personality
2. Be conversational and friendly, not clinical
3. Mix deep questions with lighter ones
4. Focus on areas we know least about
5. Questions should feel natural in a chat

Return a JSON array with exactly ${count} questions:
[
  {
    "question": "The actual question text",
    "category": "one of the categories above",
    "context": "Brief explanation of why this question is valuable"
  }
]

Only return the JSON array, no other text.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }
    
    const questions = JSON.parse(jsonMatch[0]);
    
    // Save questions to database
    const createdQuestions = [];
    for (const q of questions) {
      const priority = QUESTION_CATEGORIES[q.category]?.weight || 5;
      
      const question = await prisma.twinQuestion.create({
        data: {
          twinId: twin.id,
          question: q.question,
          category: q.category,
          context: q.context,
          priority,
        },
      });
      
      createdQuestions.push(question);
    }
    
    return createdQuestions;
  } catch (error) {
    console.error('Error generating questions:', error);
    throw ApiError.internal('Failed to generate questions');
  }
};

/**
 * Get next question to ask
 */
const getNextQuestion = async (userId) => {
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
  });

  if (!twin) {
    throw ApiError.notFound('Twin profile not found');
  }

  // Get pending questions, ordered by priority and creation date
  let question = await prisma.twinQuestion.findFirst({
    where: {
      twinId: twin.id,
      status: 'pending',
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  // If no pending questions, generate new ones
  if (!question) {
    const newQuestions = await generateQuestions(userId, 5);
    question = newQuestions[0];
  }

  return question;
};

/**
 * Get all pending questions
 */
const getPendingQuestions = async (userId, limit = 10) => {
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
  });

  if (!twin) {
    throw ApiError.notFound('Twin profile not found');
  }

  const questions = await prisma.twinQuestion.findMany({
    where: {
      twinId: twin.id,
      status: 'pending',
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
    take: limit,
  });

  // If no pending questions, generate new ones
  if (questions.length === 0) {
    return await generateQuestions(userId, 5);
  }

  return questions;
};

/**
 * Answer a question
 */
const answerQuestion = async (userId, questionId, answer) => {
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
  });

  if (!twin) {
    throw ApiError.notFound('Twin profile not found');
  }

  const question = await prisma.twinQuestion.findUnique({
    where: { id: questionId },
  });

  if (!question || question.twinId !== twin.id) {
    throw ApiError.notFound('Question not found');
  }

  // Update question with answer
  const updatedQuestion = await prisma.twinQuestion.update({
    where: { id: questionId },
    data: {
      answer,
      status: 'answered',
      answeredAt: new Date(),
    },
  });

  // Process the answer to extract insights
  await processAnswer(twin.id, question, answer);

  return updatedQuestion;
};

/**
 * Skip a question
 */
const skipQuestion = async (userId, questionId) => {
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
  });

  if (!twin) {
    throw ApiError.notFound('Twin profile not found');
  }

  const question = await prisma.twinQuestion.findUnique({
    where: { id: questionId },
  });

  if (!question || question.twinId !== twin.id) {
    throw ApiError.notFound('Question not found');
  }

  // If skipped too many times, mark as skipped
  const newSkippedCount = question.skippedCount + 1;
  const status = newSkippedCount >= 3 ? 'skipped' : 'pending';
  const priority = Math.max(1, question.priority - 2); // Lower priority

  return await prisma.twinQuestion.update({
    where: { id: questionId },
    data: {
      skippedCount: newSkippedCount,
      status,
      priority,
    },
  });
};

/**
 * Process answer and extract insights
 */
const processAnswer = async (twinId, question, answer) => {
  try {
    const prompt = `Analyze this Q&A to extract insights about the person.

Question: ${question.question}
Category: ${question.category}
Answer: ${answer}

Extract key insights and facts. Return a JSON object:
{
  "insights": [
    {
      "key": "short_identifier",
      "value": "The insight or fact",
      "category": "personality|preference|behavior|relationship|goal",
      "confidence": 0.8
    }
  ],
  "memory": {
    "content": "A detailed memory to store",
    "summary": "Brief summary",
    "category": "fact|preference|experience|relationship|habit",
    "importance": 0.7
  },
  "interests": ["any", "new", "interests"],
  "personalityUpdate": {
    "trait": "value or null if not applicable"
  }
}

Only return the JSON, no other text.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    
    const data = JSON.parse(jsonMatch[0]);
    
    // Create insights
    if (data.insights?.length > 0) {
      for (const insight of data.insights) {
        const embedding = await embeddingService.generateEmbedding(
          `${insight.key}: ${insight.value}`
        );
        
        await prisma.$executeRaw`
          INSERT INTO insights (id, twin_id, category, key, value, confidence, source, embedding, created_at, updated_at)
          VALUES (
            ${require('crypto').randomUUID()},
            ${twinId},
            ${insight.category},
            ${insight.key},
            ${insight.value},
            ${insight.confidence},
            'question',
            ${embedding}::vector,
            NOW(),
            NOW()
          )
        `;
      }
    }
    
    // Create memory
    if (data.memory) {
      await memoryService.createMemory(
        twinId,
        {
          content: data.memory.content,
          summary: data.memory.summary,
          category: data.memory.category,
          source: 'question',
          importance: data.memory.importance,
        }
      );
    }
    
    // Update interests
    if (data.interests?.length > 0) {
      const twin = await prisma.twinProfile.findUnique({
        where: { id: twinId },
      });
      
      const currentInterests = twin.interests || [];
      const newInterests = [...new Set([...currentInterests, ...data.interests])];
      
      await prisma.twinProfile.update({
        where: { id: twinId },
        data: { interests: newInterests },
      });
    }
    
    // Update personality traits
    if (data.personalityUpdate && Object.keys(data.personalityUpdate).length > 0) {
      const twin = await prisma.twinProfile.findUnique({
        where: { id: twinId },
      });
      
      const traits = { ...(twin.personalityTraits || {}), ...data.personalityUpdate };
      
      await prisma.twinProfile.update({
        where: { id: twinId },
        data: { personalityTraits: traits },
      });
    }
    
  } catch (error) {
    console.error('Error processing answer:', error);
    // Don't throw - answer was saved, processing can fail silently
  }
};

/**
 * Get question stats
 */
const getQuestionStats = async (userId) => {
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
  });

  if (!twin) {
    throw ApiError.notFound('Twin profile not found');
  }

  const [pending, answered, skipped] = await Promise.all([
    prisma.twinQuestion.count({ where: { twinId: twin.id, status: 'pending' } }),
    prisma.twinQuestion.count({ where: { twinId: twin.id, status: 'answered' } }),
    prisma.twinQuestion.count({ where: { twinId: twin.id, status: 'skipped' } }),
  ]);

  // Get answered by category
  const answeredByCategory = await prisma.twinQuestion.groupBy({
    by: ['category'],
    where: { twinId: twin.id, status: 'answered' },
    _count: true,
  });

  return {
    pending,
    answered,
    skipped,
    total: pending + answered + skipped,
    byCategory: answeredByCategory.reduce((acc, item) => {
      acc[item.category] = item._count;
      return acc;
    }, {}),
  };
};

/**
 * Get answered questions history
 */
const getAnsweredQuestions = async (userId, limit = 20, offset = 0) => {
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
  });

  if (!twin) {
    throw ApiError.notFound('Twin profile not found');
  }

  const [questions, total] = await Promise.all([
    prisma.twinQuestion.findMany({
      where: { twinId: twin.id, status: 'answered' },
      orderBy: { answeredAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.twinQuestion.count({
      where: { twinId: twin.id, status: 'answered' },
    }),
  ]);

  return { questions, total };
};

/**
 * Build context about what we already know
 */
function buildKnownContext(twin) {
  const parts = [];
  
  // Personality traits
  if (Object.keys(twin.personalityTraits || {}).length > 0) {
    parts.push(`Personality: ${JSON.stringify(twin.personalityTraits)}`);
  }
  
  // Interests
  if (twin.interests?.length > 0) {
    parts.push(`Interests: ${twin.interests.join(', ')}`);
  }
  
  // Communication style
  if (Object.keys(twin.communicationStyle || {}).length > 0) {
    parts.push(`Communication style: ${JSON.stringify(twin.communicationStyle)}`);
  }
  
  // Recent insights
  if (twin.insights?.length > 0) {
    const insightSummary = twin.insights
      .slice(0, 10)
      .map((i) => `${i.key}: ${i.value}`)
      .join('\n');
    parts.push(`Recent insights:\n${insightSummary}`);
  }
  
  // Memory categories
  if (twin.memories?.length > 0) {
    const categories = {};
    for (const m of twin.memories) {
      categories[m.category] = (categories[m.category] || 0) + 1;
    }
    parts.push(`Memory categories: ${JSON.stringify(categories)}`);
  }
  
  return parts.join('\n\n');
}

module.exports = {
  generateQuestions,
  getNextQuestion,
  getPendingQuestions,
  answerQuestion,
  skipQuestion,
  getQuestionStats,
  getAnsweredQuestions,
};

