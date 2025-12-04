const prisma = require('../config/database');
const { visionModel } = require('../config/gemini');
const memoryService = require('./memory.service');
const embeddingService = require('./embedding.service');
const ApiError = require('../utils/ApiError');
const fs = require('fs').promises;
const path = require('path');

/**
 * Analyze a photo and extract insights
 */
const analyzePhoto = async (userId, filePath, filename, description = null) => {
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
  });

  if (!twin) {
    throw ApiError.notFound('Twin profile not found');
  }

  // Read image file
  const imageData = await fs.readFile(filePath);
  const base64Image = imageData.toString('base64');
  const mimeType = getMimeType(filename);

  // Build prompt for analysis
  const prompt = `Analyze this photo to understand the person who owns it. Extract insights about their life, preferences, and personality.

${description ? `User's description: "${description}"` : ''}

Provide a detailed analysis in JSON format:
{
  "description": "Detailed description of what's in the photo",
  "category": "selfie|friends|family|travel|food|pet|hobby|work|event|nature|other",
  "emotions": ["detected", "emotions"],
  "location": {
    "type": "indoor|outdoor|unknown",
    "place": "specific place if identifiable, null otherwise"
  },
  "people": {
    "count": 0,
    "description": "description of people if any"
  },
  "objects": ["notable", "objects", "in", "photo"],
  "insights": [
    {
      "key": "insight_identifier",
      "value": "What this reveals about the person",
      "category": "personality|preference|relationship|lifestyle|interest",
      "confidence": 0.8
    }
  ],
  "memory": {
    "content": "A memory to store about this photo",
    "summary": "Brief summary",
    "importance": 0.7
  },
  "interests": ["any", "interests", "detected"],
  "mood": "overall mood of the photo"
}

Only return valid JSON, no other text.`;

  try {
    const result = await visionModel.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
      prompt,
    ]);

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Save photo record
    const photo = await prisma.photo.create({
      data: {
        userId,
        twinId: twin.id,
        filename,
        originalName: filename,
        mimeType,
        size: imageData.length,
        description: description || analysis.description,
        analysis,
        category: analysis.category || 'other',
      },
    });

    // Create insights
    if (analysis.insights?.length > 0) {
      for (const insight of analysis.insights) {
        try {
          const embedding = await embeddingService.generateEmbedding(
            `${insight.key}: ${insight.value}`
          );

          await prisma.$executeRaw`
            INSERT INTO insights (id, twin_id, category, key, value, confidence, source, embedding, created_at, updated_at)
            VALUES (
              ${require('crypto').randomUUID()},
              ${twin.id},
              ${insight.category},
              ${insight.key},
              ${insight.value},
              ${insight.confidence},
              'photo',
              ${embedding}::vector,
              NOW(),
              NOW()
            )
          `;
        } catch (e) {
          console.error('Error creating insight:', e);
        }
      }
    }

    // Create memory
    if (analysis.memory) {
      await memoryService.createMemory(twin.id, {
        content: analysis.memory.content,
        summary: analysis.memory.summary,
        category: 'experience',
        source: 'photo',
        sourceId: photo.id,
        importance: analysis.memory.importance || 0.6,
      });
    }

    // Update interests
    if (analysis.interests?.length > 0) {
      const currentInterests = twin.interests || [];
      const newInterests = [...new Set([...currentInterests, ...analysis.interests])];

      await prisma.twinProfile.update({
        where: { id: twin.id },
        data: { interests: newInterests },
      });
    }

    // Clean up temp file
    try {
      await fs.unlink(filePath);
    } catch (e) {
      // Ignore cleanup errors
    }

    return {
      photo,
      analysis,
      insightsCreated: analysis.insights?.length || 0,
    };
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(filePath);
    } catch (e) {
      // Ignore
    }
    console.error('Photo analysis error:', error);
    throw ApiError.internal('Failed to analyze photo');
  }
};

/**
 * Get user's photos
 */
const getPhotos = async (userId, limit = 20, offset = 0, category = null) => {
  const where = { userId };
  if (category) {
    where.category = category;
  }

  const [photos, total] = await Promise.all([
    prisma.photo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.photo.count({ where }),
  ]);

  return { photos, total };
};

/**
 * Get photo by ID
 */
const getPhoto = async (userId, photoId) => {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
  });

  if (!photo || photo.userId !== userId) {
    throw ApiError.notFound('Photo not found');
  }

  return photo;
};

/**
 * Delete photo
 */
const deletePhoto = async (userId, photoId) => {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
  });

  if (!photo || photo.userId !== userId) {
    throw ApiError.notFound('Photo not found');
  }

  await prisma.photo.delete({
    where: { id: photoId },
  });

  return { deleted: true };
};

/**
 * Get photo stats
 */
const getPhotoStats = async (userId) => {
  const photos = await prisma.photo.findMany({
    where: { userId },
    select: { category: true },
  });

  const byCategory = {};
  for (const photo of photos) {
    byCategory[photo.category] = (byCategory[photo.category] || 0) + 1;
  }

  return {
    total: photos.length,
    byCategory,
  };
};

/**
 * Get MIME type from filename
 */
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

module.exports = {
  analyzePhoto,
  getPhotos,
  getPhoto,
  deletePhoto,
  getPhotoStats,
};

