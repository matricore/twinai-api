const prisma = require('../config/database');
const { generateEmbedding, toVectorString } = require('./embedding.service');

/**
 * Create a new memory with embedding
 * @param {string} twinId - Twin profile ID
 * @param {Object} data - Memory data
 * @returns {Promise<Object>} Created memory
 */
const createMemory = async (twinId, { content, summary, category, source, sourceId, importance }) => {
  const embedding = await generateEmbedding(content);
  const vectorStr = toVectorString(embedding);

  let memory;

  if (vectorStr) {
    memory = await prisma.$queryRaw`
      INSERT INTO memories (id, twin_id, content, summary, category, source, source_id, importance, embedding, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${twinId},
        ${content},
        ${summary || null},
        ${category},
        ${source || null},
        ${sourceId || null},
        ${importance || 0.5},
        ${vectorStr}::vector,
        NOW(),
        NOW()
      )
      RETURNING id, content, summary, category, source, importance, created_at as "createdAt"
    `;
  } else {
    // Create memory without embedding if embedding fails
    memory = await prisma.$queryRaw`
      INSERT INTO memories (id, twin_id, content, summary, category, source, source_id, importance, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${twinId},
        ${content},
        ${summary || null},
        ${category},
        ${source || null},
        ${sourceId || null},
        ${importance || 0.5},
        NOW(),
        NOW()
      )
      RETURNING id, content, summary, category, source, importance, created_at as "createdAt"
    `;
  }

  return memory[0];
};

/**
 * Search memories by semantic similarity
 * @param {string} twinId - Twin profile ID
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object[]>} Similar memories with similarity scores
 */
const searchMemories = async (twinId, query, { limit = 5, category, minSimilarity = 0.5 } = {}) => {
  const queryEmbedding = await generateEmbedding(query);

  if (!queryEmbedding) {
    // Fallback to recent memories if embedding fails
    return getRecentMemories(twinId, limit);
  }

  const vectorStr = toVectorString(queryEmbedding);

  let sql = `
    SELECT 
      id,
      content,
      summary,
      category,
      source,
      importance,
      1 - (embedding <=> '${vectorStr}'::vector) as similarity,
      created_at as "createdAt"
    FROM memories
    WHERE twin_id = '${twinId}'
      AND embedding IS NOT NULL
      AND 1 - (embedding <=> '${vectorStr}'::vector) >= ${minSimilarity}
  `;

  if (category) {
    sql += ` AND category = '${category}'`;
  }

  sql += ` ORDER BY embedding <=> '${vectorStr}'::vector LIMIT ${limit}`;

  const memories = await prisma.$queryRawUnsafe(sql);

  // Update access count for retrieved memories
  if (memories.length) {
    const ids = memories.map((m) => m.id);
    await prisma.$executeRaw`
      UPDATE memories 
      SET access_count = access_count + 1, last_accessed_at = NOW()
      WHERE id = ANY(${ids})
    `;
  }

  return memories;
};

/**
 * Get recent memories for context
 * @param {string} twinId - Twin profile ID
 * @param {number} limit - Number of memories
 * @returns {Promise<Object[]>} Recent memories
 */
const getRecentMemories = async (twinId, limit = 10) => {
  return prisma.memory.findMany({
    where: { twinId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      content: true,
      summary: true,
      category: true,
      source: true,
      importance: true,
      createdAt: true,
    },
  });
};

/**
 * Get important memories (high importance + frequently accessed)
 * @param {string} twinId - Twin profile ID
 * @param {number} limit - Number of memories
 * @returns {Promise<Object[]>} Important memories
 */
const getImportantMemories = async (twinId, limit = 10) => {
  return prisma.memory.findMany({
    where: { twinId },
    orderBy: [{ importance: 'desc' }, { accessCount: 'desc' }],
    take: limit,
    select: {
      id: true,
      content: true,
      summary: true,
      category: true,
      importance: true,
      accessCount: true,
      createdAt: true,
    },
  });
};

/**
 * Delete a memory
 * @param {string} twinId - Twin profile ID
 * @param {string} memoryId - Memory ID
 */
const deleteMemory = async (twinId, memoryId) => {
  await prisma.memory.deleteMany({
    where: { id: memoryId, twinId },
  });
};

module.exports = {
  createMemory,
  searchMemories,
  getRecentMemories,
  getImportantMemories,
  deleteMemory,
};
