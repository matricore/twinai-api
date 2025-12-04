const { genAI } = require('../config/gemini');

// Gemini embedding model (768 dimensions)
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

/**
 * Generate embedding vector for text
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} 768-dimensional vector
 */
const generateEmbedding = async (text) => {
  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('Embedding error:', error.message);
    // Return null if embedding fails - graceful degradation
    return null;
  }
};

/**
 * Generate embeddings for multiple texts
 * @param {string[]} texts - Array of texts
 * @returns {Promise<number[][]>} Array of embeddings
 */
const generateEmbeddings = async (texts) => {
  const results = await Promise.all(
    texts.map((text) => generateEmbedding(text))
  );
  return results;
};

/**
 * Format embedding array for PostgreSQL vector type
 * @param {number[]} embedding - Embedding array
 * @returns {string} PostgreSQL vector string
 */
const toVectorString = (embedding) => {
  if (!embedding) {
    return null;
  }
  return `[${embedding.join(',')}]`;
};

module.exports = {
  generateEmbedding,
  generateEmbeddings,
  toVectorString,
};
