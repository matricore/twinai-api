const memoryService = require('../services/memory.service');
const prisma = require('../config/database');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { success, created, noContent } = require('../utils/response');

/**
 * Get twin ID for current user
 */
const getTwinId = async (userId) => {
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!twin) {
    throw ApiError.notFound('Twin profile not found');
  }
  return twin.id;
};

const createMemory = catchAsync(async (req, res) => {
  const twinId = await getTwinId(req.user.id);
  const memory = await memoryService.createMemory(twinId, {
    ...req.body,
    source: 'manual',
  });
  created(res, memory, 'Memory created');
});

const searchMemories = catchAsync(async (req, res) => {
  const twinId = await getTwinId(req.user.id);
  const { q, category, limit } = req.query;
  const memories = await memoryService.searchMemories(twinId, q, { limit, category });
  success(res, { memories, query: q });
});

const getMemories = catchAsync(async (req, res) => {
  const twinId = await getTwinId(req.user.id);
  const { category, page, limit, sort } = req.query;
  const skip = (page - 1) * limit;

  const where = { twinId };
  if (category) {
    where.category = category;
  }

  const orderBy = sort === 'important' 
    ? [{ importance: 'desc' }, { accessCount: 'desc' }]
    : { createdAt: 'desc' };

  const [memories, total] = await prisma.$transaction([
    prisma.memory.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        content: true,
        summary: true,
        category: true,
        source: true,
        importance: true,
        accessCount: true,
        createdAt: true,
      },
    }),
    prisma.memory.count({ where }),
  ]);

  success(res, {
    memories,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const deleteMemory = catchAsync(async (req, res) => {
  const twinId = await getTwinId(req.user.id);
  await memoryService.deleteMemory(twinId, req.params.id);
  noContent(res);
});

module.exports = {
  createMemory,
  searchMemories,
  getMemories,
  deleteMemory,
};

