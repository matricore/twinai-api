const { model } = require('../config/gemini');
const { generateTwinSystemPrompt, generateAnalysisPrompt } = require('../utils/prompts/twin-system');

/**
 * Generate chat response from the AI twin
 * @param {Object} params - Chat parameters
 * @param {string} params.message - User's message
 * @param {Object} params.twinProfile - User's twin profile
 * @param {Array} params.history - Conversation history
 * @param {Array} params.relevantMemories - Semantically relevant memories
 * @returns {Promise<string>} AI response
 */
const generateChatResponse = async ({ message, twinProfile, history = [], relevantMemories = [] }) => {
  const systemPrompt = generateTwinSystemPrompt(twinProfile, relevantMemories);

  // Build conversation history for context
  const chatHistory = history.slice(-10).map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Anladım, kullanıcının dijital ikizi olarak hazırım.' }] },
      ...chatHistory,
    ],
  });

  const result = await chat.sendMessage(message);
  return result.response.text();
};

/**
 * Analyze message for user insights and memories
 * @param {string} message - Message to analyze
 * @param {Array} previousMessages - Recent conversation context
 * @returns {Promise<Object>} Analysis results with insights and memories
 */
const analyzeMessage = async (message, previousMessages = []) => {
  try {
    const prompt = generateAnalysisPrompt(message, { previousMessages });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { insights: [], memories: [], suggestedQuestions: [] };
  } catch {
    return { insights: [], memories: [], suggestedQuestions: [] };
  }
};

module.exports = {
  generateChatResponse,
  analyzeMessage,
};
