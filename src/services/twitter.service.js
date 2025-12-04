const prisma = require('../config/database');
const { parseTwitterExport, extractForAnalysis } = require('../utils/parsers/twitter.parser');
const memoryService = require('./memory.service');
const { model } = require('../config/gemini');

/**
 * Process Twitter data export
 * @param {string} userId - User ID
 * @param {Object} files - Raw file contents { filename: content }
 * @returns {Promise<Object>} Processing result
 */
const processTwitterExport = async (userId, files) => {
  // Get twin profile
  const twin = await prisma.twinProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!twin) {
    throw new Error('Twin profile not found');
  }

  // Parse the export files
  const parsed = parseTwitterExport(files);

  if (parsed.stats.totalItems === 0) {
    throw new Error('No data found in the uploaded files. Please check the format.');
  }

  const displayName = parsed.profile?.displayName || parsed.account?.username || 'Twitter User';

  // Create data source record
  const dataSource = await prisma.dataSource.create({
    data: {
      userId,
      type: 'twitter',
      name: `Twitter - @${parsed.account?.username || displayName}`,
      status: 'processing',
      totalItems: parsed.stats.totalItems,
      metadata: {
        profile: parsed.profile,
        account: { username: parsed.account?.username },
        stats: parsed.stats,
      },
    },
  });

  // Process in background
  processInBackground(twin.id, dataSource.id, parsed).catch(async (error) => {
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
const processInBackground = async (twinId, dataSourceId, parsed) => {
  // Extract data for AI analysis
  const analysisData = extractForAnalysis(parsed);
  
  // Analyze with AI
  const analysis = await analyzeTwitterData(analysisData);
  
  let memoriesCreated = 0;

  // Create memories from original tweets
  const significantTweets = parsed.tweets
    .filter((t) => !t.isReply && t.content.length > 30)
    .slice(0, 30);

  for (const tweet of significantTweets) {
    try {
      await memoryService.createMemory(twinId, {
        content: `Twitter'da paylaştım: "${tweet.content}"`,
        summary: tweet.content.slice(0, 100),
        category: categorizeContent(tweet.content),
        source: 'twitter',
        sourceId: dataSourceId,
        importance: calculateImportance(tweet),
      });
      memoriesCreated++;
    } catch {
      // Continue on individual failures
    }
  }

  // Create memories from meaningful replies
  const meaningfulReplies = parsed.tweets
    .filter((t) => t.isReply && t.content.length > 50)
    .slice(0, 15);

  for (const reply of meaningfulReplies) {
    try {
      await memoryService.createMemory(twinId, {
        content: `Twitter'da @${reply.replyTo}'a cevap verdim: "${reply.content}"`,
        summary: reply.content.slice(0, 100),
        category: 'fact',
        source: 'twitter',
        sourceId: dataSourceId,
        importance: 0.4,
      });
      memoriesCreated++;
    } catch {
      // Continue on failures
    }
  }

  // Create memories from DMs
  const ownerDMs = parsed.directMessages
    .filter((m) => m.isOwner && m.content.length > 40)
    .slice(0, 15);

  for (const dm of ownerDMs) {
    try {
      await memoryService.createMemory(twinId, {
        content: `Twitter DM'de söyledim: "${dm.content}"`,
        summary: dm.content.slice(0, 100),
        category: categorizeContent(dm.content),
        source: 'twitter',
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
            source: 'twitter',
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
 * Analyze Twitter data with AI
 */
const analyzeTwitterData = async (data) => {
  const prompt = `Twitter/X verilerini analiz et ve kullanıcının kişiliğini belirle.

PROFİL:
${data.profile ? `@${data.account?.username}, Bio: ${data.profile.bio}` : 'Profil bilgisi yok'}

TWEET'LER (${data.sampleSize.tweets} adet):
${data.originalTweets.slice(0, 20).map((t, i) => `${i + 1}. ${t}`).join('\n')}

YANITLAR (${data.sampleSize.replies} adet):
${data.replies.slice(0, 10).map((r, i) => `${i + 1}. ${r}`).join('\n')}

KULLANILAN HASHTAG'LER:
${data.hashtags.slice(0, 20).join(', ')}

BEĞENİLEN İÇERİKLER (${data.sampleSize.liked} adet):
${data.likedContent.slice(0, 10).map((l, i) => `${i + 1}. ${l}`).join('\n')}

İSTATİSTİKLER:
- Toplam tweet: ${data.stats.tweetsCount}
- Orijinal tweet: ${data.stats.originalTweetsCount}
- Yanıtlar: ${data.stats.repliesCount}
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
  "twitterStyle": {
    "tone": "serious|humorous|informative|casual|provocative",
    "engagement": "low|medium|high",
    "topTopics": ["konu1", "konu2"],
    "tweetFrequency": "rare|occasional|regular|frequent"
  },
  "summary": "Kullanıcının Twitter'daki genel profili (2-3 cümle)"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Twitter analysis error:', error.message);
  }
  
  return { interests: [], insights: [], twitterStyle: {}, summary: '' };
};

/**
 * Categorize content
 */
const categorizeContent = (content) => {
  const lower = content.toLowerCase();
  
  if (/düşünüyorum|bence|think|believe|opinion/i.test(lower)) {
    return 'preference';
  }
  if (/seviyorum|sevmiyorum|love|hate|favorite|favori/i.test(lower)) {
    return 'preference';
  }
  if (/yaptım|gittim|izledim|okudum|did|went|watched|read/i.test(lower)) {
    return 'experience';
  }
  if (/her gün|always|genelde|usually|alışkanlık/i.test(lower)) {
    return 'habit';
  }
  
  return 'fact';
};

/**
 * Calculate importance score
 */
const calculateImportance = (tweet) => {
  let score = 0.5;
  
  // Longer tweets often more thoughtful
  if (tweet.content.length > 100) score += 0.1;
  if (tweet.content.length > 200) score += 0.1;
  
  // Engagement indicates importance
  if (tweet.likes > 10) score += 0.1;
  if (tweet.likes > 50) score += 0.1;
  if (tweet.retweets > 5) score += 0.05;
  
  // Personal statements
  if (/ben|benim|my|I\'m|I am/i.test(tweet.content)) score += 0.1;
  
  return Math.min(score, 1);
};

module.exports = {
  processTwitterExport,
};

