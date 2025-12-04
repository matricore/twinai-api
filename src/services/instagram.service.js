const prisma = require('../config/database');
const { parseInstagramExport, extractForAnalysis } = require('../utils/parsers/instagram.parser');
const memoryService = require('./memory.service');
const { model } = require('../config/gemini');

/**
 * Process Instagram data export
 * @param {string} userId - User ID
 * @param {Object} files - Parsed JSON files { filename: data }
 * @param {string} ownerName - Instagram username or display name
 * @returns {Promise<Object>} Processing result
 */
const processInstagramExport = async (userId, files, ownerName) => {
  // Get twin profile
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!twin) {
    throw new Error('Twin profile not found');
  }

  // Parse the export files
  const parsed = parseInstagramExport(files, ownerName);

  if (parsed.stats.totalItems === 0) {
    throw new Error('No data found in the uploaded files. Please check the format.');
  }

  // Create data source record
  const dataSource = await prisma.dataSource.create({
    data: {
      userId,
      type: 'instagram',
      name: `Instagram - ${parsed.profile?.username || ownerName}`,
      status: 'processing',
      totalItems: parsed.stats.totalItems,
      metadata: {
        profile: parsed.profile,
        stats: parsed.stats,
        ownerName,
      },
    },
  });

  // Process in background
  processInBackground(twin.id, dataSource.id, parsed, ownerName).catch(async (error) => {
    await prisma.dataSource.update({
      where: { id: dataSource.id },
      data: { status: 'failed', lastError: error.message },
    });
  });

  return {
    dataSourceId: dataSource.id,
    profile: parsed.profile,
    stats: parsed.stats,
    status: 'processing',
  };
};

/**
 * Process data in background and create memories
 */
const processInBackground = async (twinId, dataSourceId, parsed, ownerName) => {
  // Extract data for AI analysis
  const analysisData = extractForAnalysis(parsed, ownerName);
  
  // Analyze with AI
  const analysis = await analyzeInstagramData(analysisData);
  
  let memoriesCreated = 0;

  // Create memories from posts
  const significantPosts = parsed.posts
    .filter((p) => p.caption && p.caption.length > 20)
    .slice(0, 30);

  for (const post of significantPosts) {
    try {
      await memoryService.createMemory(twinId, {
        content: `Instagram'da paylaştım: "${post.caption}"`,
        summary: post.caption.slice(0, 100),
        category: categorizeContent(post.caption),
        source: 'instagram',
        sourceId: dataSourceId,
        importance: calculateImportance(post.caption),
      });
      memoriesCreated++;
    } catch {
      // Continue on individual failures
    }
  }

  // Create memories from user's DMs
  const ownerMessages = parsed.messages
    .filter((m) => m.isOwner && m.content && m.content.length > 30)
    .slice(0, 20);

  for (const msg of ownerMessages) {
    try {
      await memoryService.createMemory(twinId, {
        content: `Instagram DM'de söyledim: "${msg.content}"`,
        summary: msg.content.slice(0, 100),
        category: categorizeContent(msg.content),
        source: 'instagram',
        sourceId: dataSourceId,
        importance: 0.5,
      });
      memoriesCreated++;
    } catch {
      // Continue on failures
    }
  }

  // Create insights from analysis
  if (analysis.insights?.length) {
    for (const insight of analysis.insights) {
      try {
        await prisma.insight.create({
          data: {
            twinId,
            category: insight.category,
            key: insight.key,
            value: insight.value,
            confidence: insight.confidence,
            source: 'instagram',
          },
        });
      } catch {
        // Continue on failures
      }
    }
  }

  // Update interests in twin profile
  if (analysis.interests?.length) {
    const currentTwin = await prisma.twinProfile.findUnique({
      where: { id: twinId },
      select: { interests: true },
    });

    const newInterests = [...new Set([...(currentTwin.interests || []), ...analysis.interests])];

    await prisma.twinProfile.update({
      where: { id: twinId },
      data: {
        interests: newInterests,
        lastAnalyzedAt: new Date(),
      },
    });
  }

  // Update data source status
  await prisma.dataSource.update({
    where: { id: dataSourceId },
    data: {
      status: 'completed',
      processedItems: parsed.stats.totalItems,
      memoriesCreated,
      processedAt: new Date(),
    },
  });
};

/**
 * Analyze Instagram data with AI
 */
const analyzeInstagramData = async (data) => {
  const prompt = `Instagram verilerini analiz et ve kullanıcının kişiliğini belirle.

PROFİL:
${data.profile ? `Username: ${data.profile.username}, Bio: ${data.profile.bio}` : 'Profil bilgisi yok'}

POST BAŞLIKLARI (${data.sampleSize.posts} adet):
${data.postCaptions.slice(0, 20).map((c, i) => `${i + 1}. ${c}`).join('\n')}

DM MESAJLARI (${data.sampleSize.messages} adet):
${data.ownerMessages.slice(0, 15).map((m, i) => `${i + 1}. ${m}`).join('\n')}

YORUMLAR (${data.sampleSize.comments} adet):
${data.userComments.slice(0, 10).map((c, i) => `${i + 1}. ${c}`).join('\n')}

İSTATİSTİKLER:
- Toplam post: ${data.stats.postsCount}
- Toplam mesaj: ${data.stats.messagesCount}
- Beğeniler: ${data.stats.likesCount}

Şu formatta JSON döndür:
{
  "interests": ["ilgi alanı 1", "ilgi alanı 2", ...],
  "insights": [
    {
      "category": "personality|preference|behavior",
      "key": "tespit_edilen_özellik",
      "value": "açıklama",
      "confidence": 0.0-1.0
    }
  ],
  "communicationStyle": {
    "tone": "casual|formal|mixed",
    "emojiUsage": "none|low|medium|high",
    "topics": ["sık konuşulan konular"]
  },
  "summary": "Kullanıcının Instagram'daki genel profili (2-3 cümle)"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Instagram analysis error:', error.message);
  }
  
  return { interests: [], insights: [], communicationStyle: {}, summary: '' };
};

/**
 * Categorize content
 */
const categorizeContent = (content) => {
  const lower = content.toLowerCase();
  
  if (/seviyorum|sevmiyorum|favorite|favori|love|hate|beğen/i.test(lower)) {
    return 'preference';
  }
  if (/arkadaş|friend|aile|family|anne|baba|kardeş|sevgili/i.test(lower)) {
    return 'relationship';
  }
  if (/gittim|yaptım|went|did|yaşadım|bugün|dün|geçen/i.test(lower)) {
    return 'experience';
  }
  if (/her gün|always|alışkanlık|rutin|genelde/i.test(lower)) {
    return 'habit';
  }
  
  return 'fact';
};

/**
 * Calculate importance score
 */
const calculateImportance = (content) => {
  let score = 0.5;
  
  if (content.length > 100) score += 0.1;
  if (content.length > 200) score += 0.1;
  if (/seviyorum|love|❤️|💕/i.test(content)) score += 0.15;
  if (/önemli|important|special|özel/i.test(content)) score += 0.1;
  if (/hayat|life|dream|hayal|hedef|goal/i.test(content)) score += 0.1;
  
  return Math.min(score, 1);
};

module.exports = {
  processInstagramExport,
};

