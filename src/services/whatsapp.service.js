const prisma = require('../config/database');
const { parseWhatsAppExport, extractForAnalysis } = require('../utils/parsers/whatsapp.parser');
const memoryService = require('./memory.service');
const { model } = require('../config/gemini');

/**
 * Process WhatsApp export file
 * @param {string} userId - User ID
 * @param {Buffer} fileBuffer - File content buffer
 * @param {string} ownerName - Name of the user in the chat
 * @returns {Promise<Object>} Processing result
 */
const processWhatsAppExport = async (userId, fileBuffer, ownerName) => {
  // Get twin profile
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!twin) {
    throw new Error('Twin profile not found');
  }

  // Parse the export file
  const content = fileBuffer.toString('utf-8');
  const parsed = parseWhatsAppExport(content, ownerName);

  if (parsed.messageCount === 0) {
    throw new Error('No messages found in the file. Please check the format.');
  }

  // Create data source record
  const dataSource = await prisma.dataSource.create({
    data: {
      userId,
      type: 'whatsapp',
      name: `WhatsApp - ${parsed.participants.slice(0, 2).join(', ')}${parsed.participants.length > 2 ? '...' : ''}`,
      status: 'processing',
      totalItems: parsed.messageCount,
      metadata: {
        participants: parsed.participants,
        dateRange: parsed.dateRange,
        ownerName,
      },
    },
  });

  // Process in background
  processMessagesInBackground(twin.id, dataSource.id, parsed, ownerName).catch(async (error) => {
    await prisma.dataSource.update({
      where: { id: dataSource.id },
      data: { status: 'failed', lastError: error.message },
    });
  });

  return {
    dataSourceId: dataSource.id,
    messageCount: parsed.messageCount,
    participants: parsed.participants,
    dateRange: parsed.dateRange,
    status: 'processing',
  };
};

/**
 * Process messages in background and create memories
 */
const processMessagesInBackground = async (twinId, dataSourceId, parsed, ownerName) => {
  const { messages } = parsed;
  
  // Filter owner's messages (includes for partial match)
  const ownerMessages = messages.filter(
    (m) => m.sender.toLowerCase().includes(ownerName.toLowerCase())
  );

  // Extract data for AI analysis
  const analysisData = extractForAnalysis(messages, ownerName);
  
  // Analyze communication style and patterns with AI
  const analysis = await analyzeWhatsAppData(analysisData);
  
  let memoriesCreated = 0;

  // Create memories from significant messages
  const significantMessages = findSignificantMessages(ownerMessages);
  
  for (const msg of significantMessages) {
    try {
      await memoryService.createMemory(twinId, {
        content: `WhatsApp'ta şunu söyledim: "${msg.content}"`,
        summary: msg.content.slice(0, 100),
        category: categorizeMessage(msg.content),
        source: 'whatsapp',
        sourceId: dataSourceId,
        importance: calculateImportance(msg.content),
      });
      memoriesCreated++;
    } catch {
      // Continue on individual memory failures
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
            source: 'whatsapp',
          },
        });
      } catch {
        // Continue on failures
      }
    }
  }

  // Update communication style in twin profile
  if (analysis.communicationStyle) {
    await prisma.twinProfile.update({
      where: { id: twinId },
      data: {
        communicationStyle: analysis.communicationStyle,
        lastAnalyzedAt: new Date(),
      },
    });
  }

  // Update data source status
  await prisma.dataSource.update({
    where: { id: dataSourceId },
    data: {
      status: 'completed',
      processedItems: ownerMessages.length,
      memoriesCreated,
      processedAt: new Date(),
    },
  });
};

/**
 * Analyze WhatsApp data with AI
 */
const analyzeWhatsAppData = async (data) => {
  const prompt = `WhatsApp mesajlarını analiz et ve kullanıcının iletişim tarzını belirle.

MESAJ İSTATİSTİKLERİ:
- Toplam mesaj: ${data.totalMessages}
- Aktif gün sayısı: ${data.activeDays}
- Günlük ortalama mesaj: ${data.avgMessagesPerDay.toFixed(1)}

ÖRNEK MESAJLAR:
${data.sampleMessages.slice(0, 30).map((m, i) => `${i + 1}. ${m}`).join('\n')}

Şu formatta JSON döndür:
{
  "communicationStyle": {
    "formality": "formal|informal|mixed",
    "expressiveness": "low|medium|high",
    "emojiUsage": "none|low|medium|high",
    "averageMessageLength": "short|medium|long",
    "responseStyle": "quick|thoughtful|varied",
    "dominantTone": "serious|casual|humorous|supportive"
  },
  "insights": [
    {
      "category": "behavior|personality|preference",
      "key": "tespit_edilen_özellik",
      "value": "açıklama",
      "confidence": 0.0-1.0
    }
  ],
  "summary": "Kullanıcının genel iletişim özeti (1-2 cümle)"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return empty analysis on failure
  }
  
  return { communicationStyle: {}, insights: [], summary: '' };
};

/**
 * Find significant messages worth remembering
 */
const findSignificantMessages = (messages) => {
  return messages.filter((msg) => {
    const content = msg.content.toLowerCase();
    const length = msg.content.length;
    
    // Skip very short messages
    if (length < 20) return false;
    
    // Skip media placeholders
    if (content.includes('omitted') || content.includes('dahil edilmedi')) return false;
    
    // Keep messages with personal information indicators
    const personalIndicators = [
      'seviyorum', 'sevmiyorum', 'love', 'hate',
      'favori', 'favorite', 'en iyi', 'best',
      'her zaman', 'always', 'asla', 'never',
      'bence', 'düşünüyorum', 'think', 'believe',
      'planım', 'plan', 'hedef', 'goal',
      'doğum', 'birthday', 'yıldönümü', 'anniversary',
    ];
    
    if (personalIndicators.some((ind) => content.includes(ind))) {
      return true;
    }
    
    // Keep longer, substantive messages
    if (length > 100) return true;
    
    // Random sampling for variety (10% of remaining)
    return Math.random() < 0.1;
  }).slice(0, 50); // Limit to 50 memories per import
};

/**
 * Categorize message content
 */
const categorizeMessage = (content) => {
  const lower = content.toLowerCase();
  
  if (/seviyorum|sevmiyorum|favorite|favori|love|hate/i.test(lower)) {
    return 'preference';
  }
  if (/plan|hedef|goal|yapacağım|will do/i.test(lower)) {
    return 'habit';
  }
  if (/arkadaş|friend|aile|family|anne|baba|kardeş/i.test(lower)) {
    return 'relationship';
  }
  if (/gittim|yaptım|went|did|yaşadım|experienced/i.test(lower)) {
    return 'experience';
  }
  
  return 'fact';
};

/**
 * Calculate importance score for a message
 */
const calculateImportance = (content) => {
  let score = 0.5;
  
  // Longer messages are often more important
  if (content.length > 200) score += 0.1;
  if (content.length > 500) score += 0.1;
  
  // Personal statements
  if (/seviyorum|love|nefret|hate/i.test(content)) score += 0.15;
  
  // Future plans
  if (/plan|hedef|goal|yapacağım/i.test(content)) score += 0.1;
  
  // Strong opinions
  if (/kesinlikle|definitely|asla|never|her zaman|always/i.test(content)) score += 0.1;
  
  return Math.min(score, 1);
};

/**
 * Get user's data sources
 */
const getDataSources = async (userId, type = null) => {
  const where = { userId };
  if (type) {
    where.type = type;
  }
  
  return prisma.dataSource.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      name: true,
      status: true,
      totalItems: true,
      processedItems: true,
      memoriesCreated: true,
      metadata: true,
      processedAt: true,
      createdAt: true,
    },
  });
};

/**
 * Delete a data source and its memories
 */
const deleteDataSource = async (userId, dataSourceId) => {
  const dataSource = await prisma.dataSource.findFirst({
    where: { id: dataSourceId, userId },
  });

  if (!dataSource) {
    throw new Error('Data source not found');
  }

  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  // Delete associated memories
  if (twin) {
    await prisma.memory.deleteMany({
      where: { twinId: twin.id, sourceId: dataSourceId },
    });
  }

  // Delete data source
  await prisma.dataSource.delete({
    where: { id: dataSourceId },
  });
};

module.exports = {
  processWhatsAppExport,
  getDataSources,
  deleteDataSource,
};

